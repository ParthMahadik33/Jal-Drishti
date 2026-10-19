"""
OpenStreetMap / Overpass Geographic Feature Collector for JalDrishti.
Collects, validates, deduplicates, and upserts bounded geographic features
for the Nerul–Sanpada pilot area into SQLite with GeoJSON [lng, lat] coordinate order.
"""

from datetime import datetime, timezone
import json
import logging
import time
from typing import Dict, Any, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.config import settings
from backend.models import GeographicFeature, SourceRegistryRecord, utc_now
from backend.services.collector.registry_service import (
    acquire_source_lock,
    release_source_lock,
    start_ingestion_run,
    finish_ingestion_run,
    get_source_by_id,
)

logger = logging.getLogger("jaldrishti.collector.osm")


def build_overpass_query(south: float, west: float, north: float, east: float, timeout_sec: int = 30) -> str:
    """
    Constructs an Overpass QL query bounded to the pilot area.
    Filters highway, waterway, railway, amenity, and drainage elements.
    """
    return f"""
    [out:json][timeout:{timeout_sec}];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|service|path|footway"]({south},{west},{north},{east});
      way["waterway"]({south},{west},{north},{east});
      way["natural"="water"]({south},{west},{north},{east});
      way["railway"~"rail|subway|light_rail"]({south},{west},{north},{east});
      node["railway"="station"]({south},{west},{north},{east});
      node["amenity"~"hospital|clinic|school|fire_station|police"]({south},{west},{north},{east});
      way["amenity"~"hospital|clinic|school|fire_station|police"]({south},{west},{north},{east});
      way["man_made"="culvert"]({south},{west},{north},{east});
    );
    out geom;
    """


def classify_osm_feature(tags: Dict[str, Any]) -> Tuple[str, str]:
    """
    Determines category and feature_type from OSM tags.
    Returns: (category, feature_type)
    """
    if "waterway" in tags:
        val = str(tags["waterway"])
        if val in ("drain", "ditch"):
            return "drainage", val
        return "waterway", val

    if tags.get("natural") == "water":
        return "waterway", "water_body"

    if tags.get("man_made") == "culvert" or "drainage" in tags:
        return "drainage", tags.get("man_made") or tags.get("drainage") or "culvert"

    if "highway" in tags:
        return "highway", str(tags["highway"])

    if "railway" in tags:
        return "railway", str(tags["railway"])

    if "amenity" in tags:
        return "amenity", str(tags["amenity"])

    return "other", "generic"


def parse_osm_element_geometry(element: Dict[str, Any]) -> Tuple[Optional[str], Optional[Any]]:
    """
    Extracts GeoJSON [lng, lat] geometry from Overpass element.
    Returns: (geometry_type, coordinates_json)
    """
    elem_type = element.get("type")
    tags = element.get("tags", {})

    if elem_type == "node":
        lat = element.get("lat")
        lon = element.get("lon")
        if lat is None or lon is None:
            return None, None
        # GeoJSON is strictly [longitude, latitude]
        return "Point", [round(lon, 6), round(lat, 6)]

    elif elem_type == "way":
        geom_points = element.get("geometry", [])
        if not geom_points or len(geom_points) < 2:
            return None, None

        coords = [[round(p["lon"], 6), round(p["lat"], 6)] for p in geom_points if "lon" in p and "lat" in p]
        if len(coords) < 2:
            return None, None

        # Check if polygon (closed way with polygon-like tag)
        is_closed = coords[0] == coords[-1]
        is_polygon_tag = "natural" in tags or "amenity" in tags or tags.get("area") == "yes"

        if is_closed and len(coords) >= 4 and is_polygon_tag:
            return "Polygon", [coords]
        else:
            return "LineString", coords

    return None, None


def fetch_from_overpass_api(
    south: float,
    west: float,
    north: float,
    east: float,
    url: Optional[str] = None,
    timeout_sec: Optional[int] = None,
    max_retries: int = 0,
) -> Dict[str, Any]:
    """
    Queries Overpass API with mirror failover without repeatedly hammering public servers.
    """
    primary_url = url or settings.OVERPASS_API_URL
    timeout = timeout_sec or settings.OVERPASS_REQUEST_TIMEOUT_SECONDS
    query = build_overpass_query(south, west, north, east, timeout_sec=int(timeout))

    headers = {
        "User-Agent": "JalDrishti-Collector/1.0 (Navi Mumbai Urban Flood Resilience; contact: support@jaldrishti.org)",
        "Accept": "application/json",
    }

    # Available public Overpass mirrors
    endpoints = [primary_url]
    if "kumi.systems" not in primary_url:
        endpoints.append("https://overpass.kumi.systems/api/interpreter")
    if "overpass-api.de" not in primary_url:
        endpoints.append("https://overpass-api.de/api/interpreter")

    last_exc = None
    for endpoint in endpoints:
        for attempt in range(max_retries + 1):
            try:
                with httpx.Client(timeout=timeout) as client:
                    response = client.post(endpoint, data={"data": query}, headers=headers)
                    response.raise_for_status()
                    return response.json()
            except Exception as exc:
                last_exc = exc
                if attempt < max_retries:
                    sleep_time = 0.5 * (2 ** attempt)
                    time.sleep(sleep_time)
                else:
                    break

    raise RuntimeError(f"Overpass API failed across all mirrors: {last_exc}") from last_exc


def collect_osm_features(
    db: Session,
    force: bool = False,
    override_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Collects bounded geographic features for Nerul-Sanpada, parses GeoJSON coordinates [lng, lat],
    and upserts into SQLite without creating duplicates.
    """
    source_id = "osm-overpass"
    if not acquire_source_lock(source_id):
        raise RuntimeError(f"Collection already in progress for source '{source_id}'.")

    run = start_ingestion_run(
        db,
        source_id,
        run_metadata={
            "provider": "OpenStreetMap Overpass",
            "bbox": {
                "south": settings.PILOT_BBOX_SOUTH,
                "west": settings.PILOT_BBOX_WEST,
                "north": settings.PILOT_BBOX_NORTH,
                "east": settings.PILOT_BBOX_EAST,
            },
        },
    )

    try:
        source = get_source_by_id(db, source_id)
        if source and not source.is_enabled and not force:
            finish_ingestion_run(
                db,
                run.id,
                status="Failed",
                records_retrieved=0,
                error_message="Source is currently disabled in registry.",
            )
            return {"status": "Disabled", "source_id": source_id, "run_id": run.id}

        # 1. Fetch raw payload (or use injected fixture for testing)
        if override_payload is not None:
            raw_json = override_payload
        else:
            raw_json = fetch_from_overpass_api(
                settings.PILOT_BBOX_SOUTH,
                settings.PILOT_BBOX_WEST,
                settings.PILOT_BBOX_NORTH,
                settings.PILOT_BBOX_EAST,
            )

        elements = raw_json.get("elements", [])
        records_retrieved = len(elements)
        records_inserted = 0
        records_updated = 0
        records_rejected = 0
        records_unchanged = 0

        # Load existing features in bulk for faster comparison
        existing_features = db.execute(select(GeographicFeature)).scalars().all()
        existing_map = {(f.osm_type, f.osm_id): f for f in existing_features}

        now = utc_now()
        for elem in elements:
            elem_type = elem.get("type")
            elem_id = elem.get("id")
            if not elem_type or not elem_id:
                records_rejected += 1
                continue

            geom_type, coords = parse_osm_element_geometry(elem)
            if not geom_type or not coords:
                records_rejected += 1
                continue

            tags = elem.get("tags", {})
            category, feature_type = classify_osm_feature(tags)
            name = tags.get("name") or tags.get("name:en")

            key = (elem_type, elem_id)
            if key in existing_map:
                existing = existing_map[key]
                # Compare fields for changes
                changed = (
                    existing.category != category
                    or existing.feature_type != feature_type
                    or existing.name != name
                    or existing.geometry_type != geom_type
                    or existing.coordinates_json != coords
                    or existing.tags != tags
                )
                if changed:
                    existing.category = category
                    existing.feature_type = feature_type
                    existing.name = name
                    existing.geometry_type = geom_type
                    existing.coordinates_json = coords
                    existing.tags = tags
                    existing.last_updated_at = now
                    records_updated += 1
                else:
                    records_unchanged += 1
            else:
                new_feature = GeographicFeature(
                    osm_type=elem_type,
                    osm_id=elem_id,
                    category=category,
                    feature_type=feature_type,
                    name=name,
                    geometry_type=geom_type,
                    coordinates_json=coords,
                    tags=tags,
                    source_attribution="OpenStreetMap contributors (ODbL)",
                    data_origin="live-collected",
                    import_timestamp=now,
                    last_updated_at=now,
                )
                db.add(new_feature)
                records_inserted += 1

        db.commit()

        # Finalize run
        finish_ingestion_run(
            db,
            run.id,
            status="Success",
            records_retrieved=records_retrieved,
            records_inserted=records_inserted,
            records_updated=records_updated,
            records_rejected=records_rejected,
            records_unchanged=records_unchanged,
            error_message=None,
            last_data_timestamp=now.isoformat(),
            run_metadata={
                "bbox_south": settings.PILOT_BBOX_SOUTH,
                "bbox_north": settings.PILOT_BBOX_NORTH,
            },
        )

        return {
            "status": "Success",
            "source_id": source_id,
            "run_id": run.id,
            "records_retrieved": records_retrieved,
            "records_inserted": records_inserted,
            "records_updated": records_updated,
            "records_rejected": records_rejected,
            "records_unchanged": records_unchanged,
        }

    except Exception as exc:
        sanitized = str(exc)
        logger.error(f"OSM Overpass collection failed: {sanitized}")

        # Count if existing features are preserved
        existing_count = db.execute(select(GeographicFeature)).scalars().all()
        status_override = "Stale" if len(existing_count) > 0 else "Error"
        err_msg = (
            f"Overpass refresh failed; retained {len(existing_count)} mapped features. ({sanitized})"
            if len(existing_count) > 0
            else sanitized
        )

        finish_ingestion_run(
            db,
            run.id,
            status="Failed",
            records_retrieved=0,
            records_inserted=0,
            records_updated=0,
            records_rejected=0,
            records_unchanged=0,
            error_message=err_msg,
            source_status_override=status_override,
        )

        return {
            "status": "Failed",
            "source_id": source_id,
            "run_id": run.id,
            "error": sanitized,
            "retained_features": len(existing_count),
        }

    finally:
        release_source_lock(source_id)
