"""
Source Registry, Collection Health & Provenance Endpoints for JalDrishti.
"""

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, abort
from typing import Optional

from backend.database import get_db
from backend.models import utc_now
from backend.schemas import (
    SourceRead,
    SourceDetailRead,
    IngestionRunRead,
    GeographicFeatureRead,
    SourceEvidenceRead,
    CollectorStatusRead,
    SourceRefreshResponse,
)
from backend.services.collector.registry_service import (
    get_registered_sources,
    get_source_by_id,
    get_source_runs,
    get_geographic_features,
    get_source_evidence,
    get_collector_heartbeat,
    is_source_collecting,
)
from backend.services.collector.weather_collector import collect_weather_data
from backend.services.collector.osm_collector import collect_osm_features

sources_bp = Blueprint("sources", __name__, url_prefix="/api")


@sources_bp.route("/sources", methods=["GET"])
def list_sources():
    """Returns all registered sources with freshness and run metrics."""
    db = get_db()
    sources = get_registered_sources(db)
    serialized = [SourceRead.model_validate(s).model_dump(mode="json") for s in sources]
    return jsonify(serialized), 200


@sources_bp.route("/sources/<source_id>", methods=["GET"])
def get_source_detail(source_id: str):
    """Returns metadata and recent ingestion runs for a single source."""
    db = get_db()
    source = get_source_by_id(db, source_id)
    if not source:
        abort(404, description=f"Source '{source_id}' not found in registry.")

    runs = get_source_runs(db, source_id, limit=10)
    data = SourceRead.model_validate(source).model_dump(mode="json")
    data["recent_runs"] = [IngestionRunRead.model_validate(r).model_dump(mode="json") for r in runs]
    return jsonify(data), 200


@sources_bp.route("/sources/<source_id>/runs", methods=["GET"])
def get_source_run_history(source_id: str):
    """Returns recent ingestion runs for the given source ID."""
    db = get_db()
    source = get_source_by_id(db, source_id)
    if not source:
        abort(404, description=f"Source '{source_id}' not found in registry.")

    limit = request.args.get("limit", default=20, type=int)
    runs = get_source_runs(db, source_id, limit=min(limit, 100))
    serialized = [IngestionRunRead.model_validate(r).model_dump(mode="json") for r in runs]
    return jsonify(serialized), 200


@sources_bp.route("/sources/<source_id>/refresh", methods=["POST"])
def manual_refresh_source(source_id: str):
    """
    Triggers an immediate manual collection for an enabled source.
    Rejects overlapping executions with 409 Conflict.
    """
    db = get_db()
    source = get_source_by_id(db, source_id)
    if not source:
        abort(404, description=f"Source '{source_id}' not found in registry.")

    if source_id not in ("open-meteo", "osm-overpass"):
        abort(
            400,
            description=f"Source '{source_id}' is a curated or basemap feed and cannot be collected via automated trigger.",
        )

    if not source.is_enabled:
        abort(400, description=f"Source '{source_id}' is currently disabled in the registry.")

    if is_source_collecting(source_id):
        abort(409, description=f"Collection already in progress for source '{source_id}'.")

    try:
        if source_id == "open-meteo":
            outcome = collect_weather_data(db, force=True)
        elif source_id == "osm-overpass":
            outcome = collect_osm_features(db, force=True)
        else:
            abort(400, description=f"No automated collection handler for '{source_id}'.")

        status = outcome.get("status", "Unknown")
        resp = SourceRefreshResponse(
            source_id=source_id,
            status=status,
            message=f"Manual refresh completed with status: {status}.",
            run_id=outcome.get("run_id"),
            records_retrieved=outcome.get("records_retrieved", 0),
            records_inserted=outcome.get("records_inserted", 0),
            records_updated=outcome.get("records_updated", 0),
        )
        return jsonify(resp.model_dump(mode="json")), 200

    except RuntimeError as rexc:
        abort(409, description=str(rexc))
    except Exception as exc:
        abort(500, description=f"Collection execution error: {str(exc)}")


from backend.services.collector.geojson_importer import (
    import_geojson_dataset,
    GeoJSONValidationError,
)


@sources_bp.route("/geographic-features", methods=["GET"])
def list_geographic_features():
    """
    Returns stored geographic features, optionally filtered by category.
    Supports GeoJSON FeatureCollection export via format=geojson.
    """
    db = get_db()
    category = request.args.get("category", default=None, type=str)
    limit = request.args.get("limit", default=500, type=int)
    fmt = request.args.get("format", default=None, type=str)

    features = get_geographic_features(db, category=category, limit=min(limit, 1000))

    if fmt == "geojson":
        geojson_features = []
        for f in features:
            geojson_features.append({
                "type": "Feature",
                "id": f.id,
                "geometry": {
                    "type": f.geometry_type,
                    "coordinates": f.coordinates_json,
                },
                "properties": {
                    "osm_type": f.osm_type,
                    "osm_id": f.osm_id,
                    "category": f.category,
                    "feature_type": f.feature_type,
                    "name": f.name,
                    "tags": f.tags,
                    "source_attribution": f.source_attribution,
                    "data_origin": f.data_origin,
                    "import_timestamp": f.import_timestamp.isoformat(),
                },
            })
        return jsonify({
            "type": "FeatureCollection",
            "features": geojson_features,
        }), 200

    serialized = [GeographicFeatureRead.model_validate(f).model_dump(mode="json") for f in features]
    return jsonify(serialized), 200


@sources_bp.route("/geographic-features/import", methods=["POST"])
@sources_bp.route("/sources/import-geojson", methods=["POST"])
def import_geojson_features():
    """
    Imports and validates a GeoJSON dataset covering the Nerul–Sanpada pilot area.
    Validates [lng, lat] coordinate order, pilot bounding box, and provenance.
    Performs duplicate-safe upserts without deleting existing records.
    """
    db = get_db()
    payload = request.get_json(silent=True)
    if not payload or not isinstance(payload, dict):
        abort(400, description="Invalid request body. Expected JSON object with GeoJSON data and metadata.")

    # Extract GeoJSON content (can be at root or under 'geojson')
    geojson_content = payload.get("geojson") or payload
    source_id = payload.get("source_id") or geojson_content.get("source_id")
    if not source_id:
        abort(400, description="Missing required field 'source_id' for dataset provenance tracking.")

    source_name = payload.get("source_name") or payload.get("name")
    provider = payload.get("provider")
    attribution = payload.get("attribution") or payload.get("source_attribution")
    license_name = payload.get("license") or payload.get("license_name")
    data_origin = payload.get("data_origin", "official")
    strict_bbox = payload.get("strict_bbox", True)

    try:
        result = import_geojson_dataset(
            db=db,
            geojson_data=geojson_content,
            source_id=source_id,
            source_name=source_name,
            provider=provider,
            attribution=attribution,
            license_name=license_name,
            data_origin=data_origin,
            strict_bbox=strict_bbox,
        )
        return jsonify(result), 200
    except GeoJSONValidationError as vexc:
        abort(422, description=str(vexc))
    except Exception as exc:
        abort(500, description=f"GeoJSON import execution error: {str(exc)}")


@sources_bp.route("/source-evidence", methods=["GET"])
def list_source_evidence():
    """Returns curated historical news and municipal plan evidence."""
    db = get_db()
    limit = request.args.get("limit", default=100, type=int)
    evidence = get_source_evidence(db, limit=min(limit, 200))
    serialized = [SourceEvidenceRead.model_validate(e).model_dump(mode="json") for e in evidence]
    return jsonify(serialized), 200


@sources_bp.route("/collector/status", methods=["GET"])
def get_collector_status():
    """
    Reports whether the standalone scheduled worker is running, its heartbeat,
    and its next scheduled runs.
    """
    db = get_db()
    heartbeat = get_collector_heartbeat(db)
    now = utc_now()

    if not heartbeat:
        status_obj = CollectorStatusRead(
            worker_id="none",
            is_running=False,
            last_heartbeat_at=None,
            heartbeat_age_seconds=None,
            heartbeat_status="Offline",
            active_job=None,
            next_scheduled_runs={},
            started_at=None,
            pid=None,
        )
        return jsonify(status_obj.model_dump(mode="json")), 200

    last_hb = heartbeat.last_heartbeat_at
    if last_hb.tzinfo is None:
        last_hb = last_hb.replace(tzinfo=timezone.utc)

    age_seconds = max(0, int((now - last_hb).total_seconds()))

    from backend.collector import is_process_running
    process_alive = is_process_running(heartbeat.pid) if heartbeat.pid else False

    if heartbeat.is_running and process_alive and age_seconds <= 30:
        hb_status = "Healthy"
        is_alive = True
    elif heartbeat.is_running and process_alive and age_seconds <= 120:
        hb_status = "Stale"
        is_alive = True
    else:
        hb_status = "Offline"
        is_alive = False

    status_obj = CollectorStatusRead(
        worker_id=heartbeat.worker_id,
        is_running=is_alive,
        last_heartbeat_at=last_hb,
        heartbeat_age_seconds=age_seconds,
        heartbeat_status=hb_status,
        active_job=heartbeat.active_job if is_alive else None,
        next_scheduled_runs=heartbeat.next_scheduled_runs if is_alive else {},
        started_at=heartbeat.started_at,
        pid=heartbeat.pid if is_alive else None,
    )
    return jsonify(status_obj.model_dump(mode="json")), 200
