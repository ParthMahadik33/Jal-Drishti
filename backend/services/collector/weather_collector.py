"""
Open-Meteo Weather Data Collector for JalDrishti.
Collects, validates, deduplicates, and persists weather observations with provenance tracking.
"""

from datetime import datetime, timezone
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from backend.config import settings
from backend.models import RainfallObservationRecord, SourceRegistryRecord, utc_now
from backend.services.weather import (
    fetch_from_open_meteo_api,
    parse_provider_response,
    persist_observation_to_db,
    get_latest_persisted_observation,
    SPATIAL_COVERAGE_EXPLANATION,
)
from backend.services.collector.registry_service import (
    acquire_source_lock,
    release_source_lock,
    start_ingestion_run,
    finish_ingestion_run,
    get_source_by_id,
)

logger = logging.getLogger("jaldrishti.collector.weather")


def sanitize_error(err_str: str) -> str:
    """Removes sensitive query params or secrets from error messages."""
    import re
    cleaned = re.sub(r'apikey=[^&\s]+', 'apikey=REDACTED', err_str, flags=re.IGNORECASE)
    cleaned = re.sub(r'key=[^&\s]+', 'key=REDACTED', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'password=[^&\s]+', 'password=REDACTED', cleaned, flags=re.IGNORECASE)
    return cleaned


def collect_weather_data(db: Session, force: bool = False) -> Dict[str, Any]:
    """
    Executes a scheduled or manual weather collection from Open-Meteo.
    Ensures single-flight execution, logs ingestion runs, and safely persists observations.
    """
    source_id = "open-meteo"
    if not acquire_source_lock(source_id):
        raise RuntimeError(f"Collection already in progress for source '{source_id}'.")

    lat = settings.DEFAULT_PILOT_LATITUDE
    lon = settings.DEFAULT_PILOT_LONGITUDE
    run = start_ingestion_run(
        db,
        source_id,
        run_metadata={
            "provider": "Open-Meteo",
            "requested_lat": lat,
            "requested_lon": lon,
            "model": "Open-Meteo Best Match (Operational Composite)",
        },
    )

    try:
        # Check if source is enabled
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

        # 1. Fetch raw API payload
        raw_json = fetch_from_open_meteo_api(lat, lon)
        parsed = parse_provider_response(raw_json, lat, lon, zone_id=None)

        provider_ts = parsed["provider_timestamp"]
        past_count = len(parsed.get("past_records", []))
        forecast_count = len(parsed.get("forecast_records", []))
        total_retrieved = 1 + past_count + forecast_count  # current + past hourly + forecast hourly

        # 2. Check for duplicate observation to prevent database bloat
        existing_stmt = (
            select(RainfallObservationRecord)
            .where(
                RainfallObservationRecord.provider_timestamp == provider_ts,
                RainfallObservationRecord.latitude == lat,
                RainfallObservationRecord.longitude == lon,
            )
            .limit(1)
        )
        existing = db.execute(existing_stmt).scalar_one_or_none()

        records_inserted = 0
        records_updated = 0
        records_unchanged = 0

        if existing:
            # Check if precipitation changed or forecast updated
            if (
                existing.current_precipitation_mm == parsed["current_precipitation_mm"]
                and existing.current_rain_mm == parsed["current_rain_mm"]
            ):
                records_unchanged = 1
            else:
                existing.current_precipitation_mm = parsed["current_precipitation_mm"]
                existing.current_rain_mm = parsed["current_rain_mm"]
                existing.current_weather_code = parsed.get("current_weather_code")
                existing.hourly_records = {
                    "past": parsed["past_records"],
                    "forecast": parsed["forecast_records"],
                    "total_past_mm": parsed["total_past_rainfall_mm"],
                    "peak_mm": parsed["peak_precipitation_mm"],
                }
                db.add(existing)
                db.commit()
                records_updated = 1
        else:
            persist_observation_to_db(db, parsed, zone_id=None)
            records_inserted = 1

        # 3. Finalize run record
        finish_ingestion_run(
            db,
            run.id,
            status="Success",
            records_retrieved=total_retrieved,
            records_inserted=records_inserted,
            records_updated=records_updated,
            records_rejected=0,
            records_unchanged=records_unchanged,
            error_message=None,
            last_data_timestamp=provider_ts,
            run_metadata={
                "current_precip_mm": parsed["current_precipitation_mm"],
                "units": parsed["units"],
                "data_status": parsed["data_status"],
            },
        )

        return {
            "status": "Success",
            "source_id": source_id,
            "run_id": run.id,
            "records_retrieved": total_retrieved,
            "records_inserted": records_inserted,
            "records_updated": records_updated,
            "records_unchanged": records_unchanged,
            "data_timestamp": provider_ts,
        }

    except Exception as exc:
        sanitized = sanitize_error(str(exc))
        logger.error(f"Weather collection failed: {sanitized}")

        fallback = get_latest_persisted_observation(db, lat, lon)
        status_override = "Stale" if fallback else "Error"
        err_msg = (
            f"API refresh failed; retained observation from {fallback['retrieved_at']}. ({sanitized})"
            if fallback
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
            "fallback_available": fallback is not None,
        }

    finally:
        release_source_lock(source_id)
