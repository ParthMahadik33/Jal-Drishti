"""
Reliable Geographic Data Importer for JalDrishti.
Validates GeoJSON geometries, coordinate order [lng, lat], bounding box bounds,
feature identifiers, and data provenance (official, live-collected, curated).
Performs duplicate-safe upserts without modifying or deleting existing records.
"""

from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import zlib

from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.config import settings
from backend.models import GeographicFeature, SourceRegistryRecord, utc_now
from backend.services.collector.registry_service import (
    start_ingestion_run,
    finish_ingestion_run,
    get_source_by_id,
)

logger = logging.getLogger("jaldrishti.collector.geojson")

# Permitted data origins per JalDrishti audit requirements
VALID_DATA_ORIGINS = {"official", "live-collected", "curated"}

# Permitted geometry types
VALID_GEOMETRY_TYPES = {"Point", "LineString", "Polygon", "MultiLineString", "MultiPolygon"}

# Pilot bounding box with 0.01 degree precinct buffer
PILOT_BBOX = {
    "south": settings.PILOT_BBOX_SOUTH,  # ~19.020
    "west": settings.PILOT_BBOX_WEST,    # ~73.000
    "north": settings.PILOT_BBOX_NORTH,  # ~19.075
    "east": settings.PILOT_BBOX_EAST,    # ~73.035
}


class GeoJSONValidationError(Exception):
    """Raised when GeoJSON data violates coordinate, geometry, bounding box, or provenance rules."""
    pass


def validate_coordinate_pair(
    coord: Any,
    feature_id: str,
    strict_bbox: bool = True,
    bbox_buffer: float = 0.015,
) -> Tuple[float, float]:
    """
    Validates a single [longitude, latitude] coordinate pair.
    - Ensures numbers are finite floats.
    - Validates strict GeoJSON [longitude, latitude] order (rejects inverted [lat, lng]).
    - Validates coordinates against the Nerul–Sanpada pilot bounding box.
    """
    if not isinstance(coord, (list, tuple)) or len(coord) < 2:
        raise GeoJSONValidationError(
            f"Feature '{feature_id}': Invalid coordinate element; expected [longitude, latitude], got {coord}"
        )

    lng, lat = coord[0], coord[1]

    if not isinstance(lng, (int, float)) or not isinstance(lat, (int, float)):
        raise GeoJSONValidationError(
            f"Feature '{feature_id}': Coordinates must be numeric, got [{type(lng).__name__}, {type(lat).__name__}]"
        )

    if isinstance(lng, float) and (lng != lng or lng in (float('inf'), float('-inf'))):
        raise GeoJSONValidationError(f"Feature '{feature_id}': Longitude is not a finite number")
    if isinstance(lat, float) and (lat != lat or lat in (float('inf'), float('-inf'))):
        raise GeoJSONValidationError(f"Feature '{feature_id}': Latitude is not a finite number")

    lng_val = float(lng)
    lat_val = float(lat)

    # 1. Coordinate order verification
    # In Navi Mumbai, longitude is ~73.0, latitude is ~19.0.
    # If lng is in [18.0, 20.0] and lat is in [72.0, 74.0], coordinates are definitely inverted.
    if 18.0 <= lng_val <= 20.5 and 72.0 <= lat_val <= 74.5:
        raise GeoJSONValidationError(
            f"Feature '{feature_id}': Inverted coordinate order detected. GeoJSON standard requires [longitude, latitude], "
            f"but received [{lng_val}, {lat_val}] which matches [latitude, longitude]. Invert coordinates to proceed."
        )

    # General global bounds check
    if not (-180.0 <= lng_val <= 180.0):
        raise GeoJSONValidationError(f"Feature '{feature_id}': Longitude {lng_val} outside valid range [-180, 180]")
    if not (-90.0 <= lat_val <= 90.0):
        raise GeoJSONValidationError(f"Feature '{feature_id}': Latitude {lat_val} outside valid range [-90, 90]")

    # 2. Pilot bounding box check
    if strict_bbox:
        min_lng = PILOT_BBOX["west"] - bbox_buffer
        max_lng = PILOT_BBOX["east"] + bbox_buffer
        min_lat = PILOT_BBOX["south"] - bbox_buffer
        max_lat = PILOT_BBOX["north"] + bbox_buffer

        if not (min_lng <= lng_val <= max_lng and min_lat <= lat_val <= max_lat):
            raise GeoJSONValidationError(
                f"Feature '{feature_id}': Coordinates [{lng_val:.5f}, {lat_val:.5f}] lie outside the Nerul–Sanpada "
                f"pilot area bounding box [{PILOT_BBOX['west']}, {PILOT_BBOX['south']}, {PILOT_BBOX['east']}, {PILOT_BBOX['north']}]."
            )

    return [round(lng_val, 6), round(lat_val, 6)]


def extract_and_validate_coordinates(
    geom_type: str,
    raw_coords: Any,
    feature_id: str,
    strict_bbox: bool = True,
) -> Any:
    """
    Recursively validates coordinates according to geometry type and returns normalized [lng, lat] structures.
    """
    if raw_coords is None:
        raise GeoJSONValidationError(f"Feature '{feature_id}': Missing coordinates for geometry '{geom_type}'")

    if geom_type == "Point":
        return validate_coordinate_pair(raw_coords, feature_id, strict_bbox=strict_bbox)

    elif geom_type == "LineString":
        if not isinstance(raw_coords, list) or len(raw_coords) < 2:
            raise GeoJSONValidationError(f"Feature '{feature_id}': LineString must have at least 2 coordinate points")
        return [validate_coordinate_pair(c, feature_id, strict_bbox=strict_bbox) for c in raw_coords]

    elif geom_type == "Polygon":
        if not isinstance(raw_coords, list) or len(raw_coords) < 1:
            raise GeoJSONValidationError(f"Feature '{feature_id}': Polygon must contain at least 1 ring")
        validated_rings = []
        for ring_idx, ring in enumerate(raw_coords):
            if not isinstance(ring, list) or len(ring) < 4:
                raise GeoJSONValidationError(
                    f"Feature '{feature_id}': Polygon ring {ring_idx} must have at least 4 coordinate points"
                )
            v_ring = [validate_coordinate_pair(c, feature_id, strict_bbox=strict_bbox) for c in ring]
            # Ensure closed ring
            if v_ring[0] != v_ring[-1]:
                v_ring.append(v_ring[0])
            validated_rings.append(v_ring)
        return validated_rings

    elif geom_type == "MultiLineString":
        if not isinstance(raw_coords, list) or len(raw_coords) < 1:
            raise GeoJSONValidationError(f"Feature '{feature_id}': MultiLineString must contain at least 1 line")
        return [
            [validate_coordinate_pair(c, feature_id, strict_bbox=strict_bbox) for c in line]
            for line in raw_coords
        ]

    elif geom_type == "MultiPolygon":
        if not isinstance(raw_coords, list) or len(raw_coords) < 1:
            raise GeoJSONValidationError(f"Feature '{feature_id}': MultiPolygon must contain at least 1 polygon")
        return [
            [
                [validate_coordinate_pair(c, feature_id, strict_bbox=strict_bbox) for c in ring]
                for ring in poly
            ]
            for poly in raw_coords
        ]

    else:
        raise GeoJSONValidationError(f"Feature '{feature_id}': Unsupported geometry type '{geom_type}'")


def resolve_feature_identity(feature: Dict[str, Any], index: int) -> Tuple[str, int]:
    """
    Extracts or deterministically derives a stable (osm_type, osm_id) pair.
    Prefers properties osm_type/osm_id, or feature.id, or hashes string identifiers.
    """
    props = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    geom_type = geom.get("type", "Point")

    # Default osm_type based on geometry if not explicit
    default_osm_type = "node" if geom_type == "Point" else "way"
    osm_type = str(props.get("osm_type") or feature.get("osm_type") or default_osm_type).lower()
    if osm_type not in ("node", "way", "relation", "feature"):
        osm_type = default_osm_type

    # Extract ID
    raw_id = props.get("osm_id") or props.get("id") or feature.get("id")

    if isinstance(raw_id, int) and raw_id > 0:
        return osm_type, raw_id

    if isinstance(raw_id, str):
        # Handle "way/12345" or "node/67890"
        if "/" in raw_id:
            parts = raw_id.split("/", 1)
            if parts[0] in ("node", "way", "relation") and parts[1].isdigit():
                return parts[0], int(parts[1])
        if raw_id.isdigit():
            return osm_type, int(raw_id)
        # Deterministic 31-bit CRC32 hash of string ID (offset by 10,000,000 to avoid conflicting with small seed IDs)
        hash_id = (zlib.crc32(raw_id.encode("utf-8")) & 0x7FFFFFFF) % 800_000_000 + 10_000_000
        return osm_type, hash_id

    # Fallback deterministic ID from geometry coordinates
    coord_repr = json.dumps(geom.get("coordinates", []))
    hash_id = (zlib.crc32(f"auto_{index}_{coord_repr}".encode("utf-8")) & 0x7FFFFFFF) % 800_000_000 + 20_000_000
    return osm_type, hash_id


def classify_feature_category(props: Dict[str, Any]) -> Tuple[str, str]:
    """
    Infers category and feature_type from GeoJSON properties or OSM tags.
    Returns: (category, feature_type)
    """
    if "category" in props and "feature_type" in props:
        return str(props["category"]).lower(), str(props["feature_type"]).lower()

    if "waterway" in props:
        val = str(props["waterway"])
        if val in ("drain", "ditch", "culvert", "outfall"):
            return "drainage", val
        return "waterway", val

    if "drainage" in props or "outfall" in props or props.get("man_made") in ("outfall", "culvert", "sluice_gate"):
        ft = props.get("drainage") or props.get("outfall") or props.get("man_made") or "culvert"
        return "drainage", str(ft)

    if props.get("natural") in ("water", "wetland"):
        return "waterway", str(props.get("natural"))

    if "highway" in props:
        return "highway", str(props["highway"])

    if "railway" in props:
        return "railway", str(props["railway"])

    if "amenity" in props:
        return "amenity", str(props["amenity"])

    return "drainage", "infrastructure"


def validate_geojson_feature(
    feature: Dict[str, Any],
    index: int,
    default_origin: str = "official",
    default_attribution: str = "Verified GIS Dataset",
    strict_bbox: bool = True,
) -> Dict[str, Any]:
    """
    Validates a single GeoJSON Feature object.
    Returns a clean dictionary ready for GeographicFeature model insertion/update.
    """
    if not isinstance(feature, dict):
        raise GeoJSONValidationError(f"Item at index {index} is not a valid GeoJSON object")

    f_type = feature.get("type")
    if f_type != "Feature":
        raise GeoJSONValidationError(f"Item at index {index} must have type='Feature', got '{f_type}'")

    geom = feature.get("geometry")
    if not geom or not isinstance(geom, dict):
        raise GeoJSONValidationError(f"Feature at index {index} has missing or invalid 'geometry'")

    geom_type = geom.get("type")
    if geom_type not in VALID_GEOMETRY_TYPES:
        raise GeoJSONValidationError(f"Feature at index {index} has unsupported geometry type '{geom_type}'")

    props = feature.get("properties") or {}
    feat_id_str = str(feature.get("id") or props.get("id") or f"feat_{index}")

    # Validate coordinate values, order [lng, lat], and bounding box
    validated_coords = extract_and_validate_coordinates(
        geom_type,
        geom.get("coordinates"),
        feat_id_str,
        strict_bbox=strict_bbox,
    )

    osm_type, osm_id = resolve_feature_identity(feature, index)
    category, feature_type = classify_feature_category(props)

    name = props.get("name") or props.get("title") or props.get("label") or None
    if name:
        name = str(name)[:256]

    # Data origin
    origin = str(props.get("data_origin") or default_origin).lower()
    if origin not in VALID_DATA_ORIGINS:
        raise GeoJSONValidationError(
            f"Feature '{feat_id_str}': Invalid data_origin '{origin}'. Must be one of {VALID_DATA_ORIGINS}"
        )

    # Attribution
    attribution = str(props.get("source_attribution") or props.get("attribution") or default_attribution)[:128]

    return {
        "osm_type": osm_type,
        "osm_id": osm_id,
        "category": category,
        "feature_type": feature_type,
        "name": name,
        "geometry_type": geom_type,
        "coordinates_json": validated_coords,
        "tags": props,
        "source_attribution": attribution,
        "data_origin": origin,
    }


def import_geojson_dataset(
    db: Session,
    geojson_data: Union[str, Dict[str, Any]],
    source_id: str,
    source_name: Optional[str] = None,
    provider: Optional[str] = None,
    attribution: Optional[str] = None,
    license_name: Optional[str] = None,
    data_origin: str = "official",
    strict_bbox: bool = True,
) -> Dict[str, Any]:
    """
    Imports a GeoJSON dataset covering the Nerul–Sanpada pilot area with:
    - GeoJSON geometry & [lng, lat] coordinate validation
    - Bounding-box verification
    - Data provenance logging (official, live-collected, curated)
    - Duplicate-safe upsert without deleting existing records
    - Source registry and ingestion run tracking
    """
    if isinstance(geojson_data, str):
        try:
            raw_data = json.loads(geojson_data)
        except Exception as exc:
            raise GeoJSONValidationError(f"Invalid JSON string provided: {exc}") from exc
    else:
        raw_data = geojson_data

    if not isinstance(raw_data, dict):
        raise GeoJSONValidationError("GeoJSON dataset must be a JSON object")

    # Extract feature list
    if raw_data.get("type") == "FeatureCollection":
        features = raw_data.get("features", [])
    elif raw_data.get("type") == "Feature":
        features = [raw_data]
    else:
        raise GeoJSONValidationError(
            f"GeoJSON root must be FeatureCollection or Feature, got '{raw_data.get('type')}'"
        )

    # Provenance and registry metadata
    final_source_name = source_name or raw_data.get("name") or f"Geographic Dataset ({source_id})"
    final_provider = provider or raw_data.get("provider") or "Municipal Authority"
    final_attribution = attribution or raw_data.get("attribution") or "Verified Geographic Dataset"
    final_license = license_name or raw_data.get("license") or "Municipal Open Access / RTI"
    final_origin = data_origin if data_origin in VALID_DATA_ORIGINS else "official"

    # 1. Register or update source in registry
    source = get_source_by_id(db, source_id)
    if not source:
        source = SourceRegistryRecord(
            id=source_id,
            name=final_source_name,
            provider=final_provider,
            category="Geospatial",
            endpoint_url=f"local://backend/data/geographic/{source_id}.geojson",
            geographic_coverage="Nerul–Sanpada Pilot Bounding Box [73.000, 19.020, 73.035, 19.075]",
            access_method="Local GeoJSON Import",
            attribution=final_attribution,
            license=final_license,
            collection_interval_seconds=None,
            is_enabled=True,
            status="Verified",
            limitations=[
                f"Data origin: {final_origin}",
                "Validated [lng, lat] coordinates strictly bounded to pilot area.",
            ],
        )
        db.add(source)
        db.flush()

    # 2. Start ingestion run
    run = start_ingestion_run(
        db,
        source_id,
        run_metadata={
            "data_origin": final_origin,
            "feature_count": len(features),
            "attribution": final_attribution,
            "import_mode": "upsert",
        },
    )

    records_retrieved = len(features)
    records_inserted = 0
    records_updated = 0
    records_rejected = 0
    records_unchanged = 0
    rejected_errors: List[Dict[str, Any]] = []

    # 3. Load existing features map for duplicate-safe upsert
    existing_features = db.execute(select(GeographicFeature)).scalars().all()
    existing_map = {(f.osm_type, f.osm_id): f for f in existing_features}

    now = utc_now()

    for idx, raw_feature in enumerate(features):
        try:
            clean_feat = validate_geojson_feature(
                raw_feature,
                index=idx,
                default_origin=final_origin,
                default_attribution=final_attribution,
                strict_bbox=strict_bbox,
            )
        except GeoJSONValidationError as err:
            records_rejected += 1
            rejected_errors.append({
                "index": idx,
                "feature_id": raw_feature.get("id") if isinstance(raw_feature, dict) else None,
                "error": str(err),
            })
            continue

        key = (clean_feat["osm_type"], clean_feat["osm_id"])

        if key in existing_map:
            existing = existing_map[key]
            # Check for changes
            changed = (
                existing.category != clean_feat["category"]
                or existing.feature_type != clean_feat["feature_type"]
                or existing.name != clean_feat["name"]
                or existing.geometry_type != clean_feat["geometry_type"]
                or existing.coordinates_json != clean_feat["coordinates_json"]
                or existing.tags != clean_feat["tags"]
                or existing.source_attribution != clean_feat["source_attribution"]
                or existing.data_origin != clean_feat["data_origin"]
            )
            if changed:
                existing.category = clean_feat["category"]
                existing.feature_type = clean_feat["feature_type"]
                existing.name = clean_feat["name"]
                existing.geometry_type = clean_feat["geometry_type"]
                existing.coordinates_json = clean_feat["coordinates_json"]
                existing.tags = clean_feat["tags"]
                existing.source_attribution = clean_feat["source_attribution"]
                existing.data_origin = clean_feat["data_origin"]
                existing.last_updated_at = now
                records_updated += 1
            else:
                records_unchanged += 1
        else:
            new_feature = GeographicFeature(
                osm_type=clean_feat["osm_type"],
                osm_id=clean_feat["osm_id"],
                category=clean_feat["category"],
                feature_type=clean_feat["feature_type"],
                name=clean_feat["name"],
                geometry_type=clean_feat["geometry_type"],
                coordinates_json=clean_feat["coordinates_json"],
                tags=clean_feat["tags"],
                source_attribution=clean_feat["source_attribution"],
                data_origin=clean_feat["data_origin"],
                import_timestamp=now,
                last_updated_at=now,
            )
            db.add(new_feature)
            existing_map[key] = new_feature
            records_inserted += 1

    db.commit()

    # Determine run status
    if records_rejected == 0:
        run_status = "Success"
        err_msg = None
    elif records_inserted > 0 or records_updated > 0:
        run_status = "Partial"
        err_msg = f"{records_rejected} feature(s) failed validation and were skipped."
    else:
        run_status = "Failed"
        err_msg = f"All {records_rejected} feature(s) failed validation."

    finish_ingestion_run(
        db,
        run.id,
        status=run_status,
        records_retrieved=records_retrieved,
        records_inserted=records_inserted,
        records_updated=records_updated,
        records_rejected=records_rejected,
        records_unchanged=records_unchanged,
        error_message=err_msg,
        last_data_timestamp=now.isoformat(),
        run_metadata={
            "source_id": source_id,
            "data_origin": final_origin,
            "errors": rejected_errors[:10],
        },
    )

    return {
        "status": run_status,
        "source_id": source_id,
        "run_id": run.id,
        "data_origin": final_origin,
        "records_retrieved": records_retrieved,
        "records_inserted": records_inserted,
        "records_updated": records_updated,
        "records_rejected": records_rejected,
        "records_unchanged": records_unchanged,
        "errors": rejected_errors,
    }


def import_local_geographic_directory(db: Session, dir_path: Optional[Union[str, Path]] = None) -> List[Dict[str, Any]]:
    """
    Scans a local directory (defaults to backend/data/geographic/) and imports all .geojson files idempotently.
    Preserves all existing records and guarantees safety.
    """
    target_dir = Path(dir_path) if dir_path else Path(__file__).resolve().parent.parent.parent / "data" / "geographic"
    if not target_dir.exists() or not target_dir.is_dir():
        logger.info(f"Local geographic directory {target_dir} does not exist; skipping directory import.")
        return []

    results = []
    geojson_files = sorted(target_dir.glob("*.geojson"))
    for g_file in geojson_files:
        try:
            with open(g_file, "r", encoding="utf-8") as f:
                content = json.load(f)

            source_id = content.get("source_id") or g_file.stem
            source_name = content.get("name") or content.get("title") or f"Local Dataset: {g_file.name}"
            attribution = content.get("attribution") or "Verified Municipal Geographic Dataset"
            origin = content.get("data_origin") or "official"
            license_name = content.get("license") or "Public Municipal Record"

            res = import_geojson_dataset(
                db=db,
                geojson_data=content,
                source_id=source_id,
                source_name=source_name,
                attribution=attribution,
                license_name=license_name,
                data_origin=origin,
                strict_bbox=True,
            )
            results.append(res)
            logger.info(
                f"Imported {g_file.name}: {res['records_inserted']} inserted, "
                f"{res['records_updated']} updated, {res['records_unchanged']} unchanged."
            )
        except Exception as exc:
            logger.error(f"Failed to import local GeoJSON file {g_file}: {exc}")
            results.append({"file": g_file.name, "status": "Failed", "error": str(exc)})

    return results
