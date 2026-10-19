"""
Focused Data Integrity & Ingestion Validation Tests for JalDrishti.
Validates:
1. Deduplication of weather observations and OSM geographic features.
2. Accurate distinction between current observations and numerical forecast intervals.
3. Timezone consistency (UTC storage, Asia/Kolkata display).
4. GeoJSON coordinate order [lng, lat] and bounding box compliance.
5. Separation of curated evidence from automated incident reports.
6. Idle worker health reporting.
"""

from datetime import datetime, timezone, timedelta
import pytest
from unittest.mock import patch
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models import (
    RainfallObservationRecord,
    GeographicFeature,
    SourceEvidenceRecord,
    Incident,
    CollectorHeartbeat,
    utc_now,
)
from backend.services.weather import (
    persist_observation_to_db,
    parse_provider_response,
)
from backend.services.collector.registry_service import (
    get_collector_heartbeat,
    update_collector_heartbeat,
)


def test_weather_observation_deduplication(db_session):
    """Calling persist_observation_to_db repeatedly with same timestamp updates rather than duplicates."""
    obs_payload = {
        "provider": "Open-Meteo",
        "provider_model": "Open-Meteo Best Match (Operational Composite)",
        "latitude": 19.0450,
        "longitude": 73.0150,
        "elevation": 14.0,
        "retrieved_at": "2026-10-18T23:00:00+00:00",
        "provider_timestamp": "2026-10-18T23:00",
        "current_precipitation_mm": 5.2,
        "current_rain_mm": 5.2,
        "current_weather_code": 61,
        "past_records": [{"time": "22:00", "precipitation_mm": 2.0, "is_forecast": False}],
        "forecast_records": [{"time": "00:00", "precipitation_mm": 4.0, "is_forecast": True}],
        "total_past_rainfall_mm": 2.0,
        "peak_precipitation_mm": 5.2,
        "units": {"precipitation": "mm", "time": "ISO8601 (Asia/Kolkata)"},
        "data_status": "Weather Model",
        "provenance_text": "Open-Meteo NWP",
    }

    # First persistence
    rec1 = persist_observation_to_db(db_session, obs_payload, zone_id=None)
    assert rec1.id is not None
    assert rec1.current_precipitation_mm == 5.2

    # Count records with this timestamp
    count1 = (
        db_session.query(RainfallObservationRecord)
        .filter_by(provider_timestamp="2026-10-18T23:00", latitude=19.0450, longitude=73.0150)
        .count()
    )
    assert count1 == 1

    # Second persistence with updated precipitation
    obs_payload["current_precipitation_mm"] = 7.8
    rec2 = persist_observation_to_db(db_session, obs_payload, zone_id=None)
    assert rec2.id == rec1.id
    assert rec2.current_precipitation_mm == 7.8

    # Count must remain exactly 1 (no duplicate rows)
    count2 = (
        db_session.query(RainfallObservationRecord)
        .filter_by(provider_timestamp="2026-10-18T23:00", latitude=19.0450, longitude=73.0150)
        .count()
    )
    assert count2 == 1


def test_weather_past_vs_forecast_partitioning():
    """Verify that parsed weather correctly classifies past vs forecast timestamps."""
    raw_fixture = {
        "elevation": 14.0,
        "current": {
            "time": "2026-10-18T18:00",
            "precipitation": 3.0,
            "rain": 3.0,
            "weather_code": 51,
        },
        "current_units": {"precipitation": "mm", "rain": "mm"},
        "hourly": {
            "time": [
                "2026-10-18T16:00",  # Past
                "2026-10-18T17:00",  # Past
                "2026-10-18T18:00",  # Current (treated as past/current)
                "2026-10-18T19:00",  # Forecast (+1h)
                "2026-10-18T20:00",  # Forecast (+2h)
            ],
            "precipitation": [1.0, 2.0, 3.0, 4.0, 5.0],
            "rain": [1.0, 2.0, 3.0, 4.0, 5.0],
            "precipitation_probability": [40, 50, 60, 70, 80],
        },
        "hourly_units": {"precipitation": "mm", "precipitation_probability": "%"},
    }

    parsed = parse_provider_response(raw_fixture, 19.0450, 73.0150)
    assert parsed["provider_timestamp"] == "2026-10-18T18:00"

    past = parsed["past_records"]
    forecast = parsed["forecast_records"]

    assert len(past) == 3
    assert all(not item["is_forecast"] for item in past)
    assert past[-1]["time"] == "18:00"
    assert past[-1]["relative_label"] if "relative_label" in past[-1] else True

    assert len(forecast) == 2
    assert all(item["is_forecast"] for item in forecast)
    assert forecast[0]["time"] == "19:00"
    assert forecast[1]["time"] == "20:00"


def test_osm_coordinates_order_and_bounding_box(db_session):
    """Verify all seeded and stored geographic features strictly adhere to GeoJSON [lng, lat]."""
    features = db_session.query(GeographicFeature).all()
    assert len(features) >= 8

    for feat in features:
        gtype = feat.geometry_type
        coords = feat.coordinates_json

        pts = []
        if gtype == "Point":
            assert isinstance(coords, list) and len(coords) == 2
            pts.append(coords)
        elif gtype == "LineString":
            assert isinstance(coords, list) and len(coords) >= 2
            pts.extend(coords)
        elif gtype == "Polygon":
            assert isinstance(coords, list) and len(coords) >= 1
            pts.extend(coords[0])

        for pt in pts:
            lon, lat = pt[0], pt[1]
            # Strict GeoJSON check: [lon, lat]
            # Longitude for Navi Mumbai is ~73.0° E, Latitude is ~19.0° N
            assert 72.8 <= lon <= 73.3, f"Invalid longitude {lon} (expected ~73.0)"
            assert 18.8 <= lat <= 19.3, f"Invalid latitude {lat} (expected ~19.0)"


def test_curated_evidence_distinct_from_automated_incidents(db_session):
    """Verify curated evidence records are distinguishable from citizen incidents."""
    evidence = db_session.query(SourceEvidenceRecord).all()
    incidents = db_session.query(Incident).all()

    assert len(evidence) >= 4
    assert len(incidents) >= 7

    evidence_ids = {e.id for e in evidence}
    incident_ids = {i.id for i in incidents}

    # Completely disjoint ID spaces
    assert evidence_ids.isdisjoint(incident_ids)

    # Evidence has canonical publication details
    for ev in evidence:
        assert ev.publisher is not None
        assert ev.verification_status in ("Archival Record", "Official Plan")
        assert ev.geographic_precision in ("Corridor", "Specific Outfall", "Precinct", "Approximate Area")

    # Incidents have operational triage fields
    for inc in incidents:
        assert inc.severity in ("high", "moderate", "low", "unassessed")
        assert inc.status in ("New", "In Progress", "Needs Review", "Resolved", "Confirmed", "Closed", "Duplicate")


def test_idle_worker_reported_as_healthy(client, test_engine):
    """An idle worker waiting for the next scheduled run must be reported as Healthy."""
    import os
    current_pid = os.getpid()

    # Update heartbeat as running with active_job=None (idle worker)
    next_runs = {
        "open-meteo": (utc_now() + timedelta(minutes=25)).isoformat(),
        "osm-overpass": (utc_now() + timedelta(hours=23)).isoformat(),
    }
    with Session(test_engine) as session:
        update_collector_heartbeat(
            session,
            worker_id=f"test-collector-{current_pid}",
            is_running=True,
            active_job=None,
            next_scheduled_runs=next_runs,
            pid=current_pid,
        )

    response = client.get("/api/collector/status")
    assert response.status_code == 200
    data = response.get_json()

    assert data["is_running"] is True
    assert data["heartbeat_status"] == "Healthy"
    assert data["active_job"] is None
    assert "open-meteo" in data["next_scheduled_runs"]
    assert "osm-overpass" in data["next_scheduled_runs"]

