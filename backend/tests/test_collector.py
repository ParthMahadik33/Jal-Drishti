"""
Tests for JalDrishti Standalone Scheduled Collector Worker & Ingestion Engines.
All tests run against the isolated test database from conftest.py.
"""

import os
import pytest
from unittest.mock import patch
from backend.models import (
    SourceRegistryRecord,
    IngestionRunRecord,
    GeographicFeature,
    RainfallObservationRecord,
    CollectorHeartbeat,
)
from backend.services.collector.weather_collector import collect_weather_data
from backend.services.collector.osm_collector import (
    collect_osm_features,
    parse_osm_element_geometry,
    classify_osm_feature,
)
from backend.services.collector.registry_service import (
    acquire_source_lock,
    release_source_lock,
    is_source_collecting,
    update_collector_heartbeat,
)
from backend.collector import (
    acquire_worker_lock,
    release_worker_lock,
    LOCK_FILE_PATH,
    calculate_next_scheduled_runs,
)


@pytest.fixture(autouse=True)
def cleanup_lock():
    if os.path.exists(LOCK_FILE_PATH):
        try:
            os.remove(LOCK_FILE_PATH)
        except Exception:
            pass
    yield
    if os.path.exists(LOCK_FILE_PATH):
        try:
            os.remove(LOCK_FILE_PATH)
        except Exception:
            pass


def test_source_lock_concurrency():
    source_id = "test-source-lock"
    # Acquire
    assert acquire_source_lock(source_id) is True
    assert is_source_collecting(source_id) is True

    # Overlapping attempt rejected
    assert acquire_source_lock(source_id) is False

    # Release
    release_source_lock(source_id)
    assert is_source_collecting(source_id) is False
    assert acquire_source_lock(source_id) is True
    release_source_lock(source_id)


def test_worker_file_lock_lifecycle():
    release_worker_lock()
    assert not os.path.exists(LOCK_FILE_PATH)

    # First acquisition
    assert acquire_worker_lock() is True
    assert os.path.exists(LOCK_FILE_PATH)

    # Re-acquisition in same process
    assert acquire_worker_lock() is True

    # Release
    release_worker_lock()
    assert not os.path.exists(LOCK_FILE_PATH)


def test_weather_collector_mock_success(db_session):
    mock_payload = {
        "elevation": 14.0,
        "current": {
            "time": "2026-10-18T23:30",
            "precipitation": 12.4,
            "rain": 12.4,
            "weather_code": 63,
        },
        "current_units": {"precipitation": "mm", "rain": "mm"},
        "hourly": {
            "time": ["2026-10-18T22:00", "2026-10-18T23:00", "2026-10-19T00:00"],
            "precipitation": [5.0, 12.4, 8.0],
            "rain": [5.0, 12.4, 8.0],
            "precipitation_probability": [80, 95, 75],
        },
        "hourly_units": {"precipitation": "mm", "precipitation_probability": "%"},
    }

    with patch("backend.services.collector.weather_collector.fetch_from_open_meteo_api", return_value=mock_payload):
        result = collect_weather_data(db_session, force=True)
        assert result["status"] == "Success"
        assert result["records_retrieved"] >= 1
        assert result["data_timestamp"] == "2026-10-18T23:30"

        # Check DB source record updated
        source = db_session.query(SourceRegistryRecord).filter_by(id="open-meteo").first()
        assert source.status == "Active"
        assert source.last_success_at is not None
        assert source.error_summary is None

        # Check ingestion run logged
        run = db_session.query(IngestionRunRecord).filter_by(source_id="open-meteo").order_by(IngestionRunRecord.id.desc()).first()
        assert run.status == "Success"
        assert run.records_retrieved >= 1


def test_weather_collector_api_failure_marks_stale(db_session):
    with patch("backend.services.collector.weather_collector.fetch_from_open_meteo_api", side_effect=RuntimeError("Gateway 504 Timeout")):
        result = collect_weather_data(db_session, force=True)
        assert result["status"] == "Failed"
        assert "Gateway 504 Timeout" in result["error"]

        source = db_session.query(SourceRegistryRecord).filter_by(id="open-meteo").first()
        # If no prior observation in clean test DB, status is Error; if prior exists, Stale
        assert source.status in ("Stale", "Error")


def test_osm_collector_duplicate_safe_upsert(db_session):
    mock_overpass_payload = {
        "elements": [
            {
                "type": "way",
                "id": 990001,
                "geometry": [
                    {"lat": 19.0400, "lon": 73.0100},
                    {"lat": 19.0420, "lon": 73.0120},
                ],
                "tags": {
                    "highway": "primary",
                    "name": "Palm Beach Road Test Segment",
                },
            },
            {
                "type": "node",
                "id": 990002,
                "lat": 19.0350,
                "lon": 73.0250,
                "tags": {
                    "amenity": "hospital",
                    "name": "Sanpada General Hospital",
                },
            },
            {
                "type": "way",
                "id": 990003,
                "geometry": [
                    {"lat": 19.0450, "lon": 73.0150},
                    {"lat": 19.0460, "lon": 73.0160},
                ],
                "tags": {
                    "waterway": "drain",
                    "name": "Nerul Stormwater Drain #5",
                },
            },
        ]
    }

    test_ids = [990001, 990002, 990003]
    db_session.query(GeographicFeature).filter(GeographicFeature.osm_id.in_(test_ids)).delete(synchronize_session=False)
    db_session.commit()

    # First collection run: 3 inserts
    res1 = collect_osm_features(db_session, force=True, override_payload=mock_overpass_payload)
    assert res1["status"] == "Success"
    assert res1["records_inserted"] == 3
    assert res1["records_updated"] == 0
    assert res1["records_unchanged"] == 0

    # Check features in database have [lng, lat] GeoJSON coordinates
    feat = db_session.query(GeographicFeature).filter_by(osm_id=990002).first()
    assert feat is not None
    assert feat.coordinates_json == [73.0250, 19.0350]  # [lng, lat]
    assert feat.category == "amenity"

    # Second collection run with identical payload: 0 inserts, 3 unchanged!
    res2 = collect_osm_features(db_session, force=True, override_payload=mock_overpass_payload)
    assert res2["status"] == "Success"
    assert res2["records_inserted"] == 0
    assert res2["records_updated"] == 0
    assert res2["records_unchanged"] == 3

    # Third collection run with tag modification: 1 updated, 2 unchanged
    mock_overpass_payload["elements"][0]["tags"]["name"] = "Palm Beach Road Expanded"
    res3 = collect_osm_features(db_session, force=True, override_payload=mock_overpass_payload)
    assert res3["status"] == "Success"
    assert res3["records_inserted"] == 0
    assert res3["records_updated"] == 1
    assert res3["records_unchanged"] == 2

    # Cleanup test IDs only
    db_session.query(GeographicFeature).filter(GeographicFeature.osm_id.in_(test_ids)).delete(synchronize_session=False)
    db_session.commit()


def test_osm_geometry_and_classification():
    # Node
    node_elem = {"type": "node", "lat": 19.03, "lon": 73.02, "tags": {"amenity": "school"}}
    geom_type, coords = parse_osm_element_geometry(node_elem)
    assert geom_type == "Point"
    assert coords == [73.02, 19.03]  # Strictly [lng, lat]

    cat, feat_type = classify_osm_feature(node_elem["tags"])
    assert cat == "amenity"
    assert feat_type == "school"

    # Drainage
    drain_elem = {"type": "way", "tags": {"waterway": "drain"}}
    cat, feat_type = classify_osm_feature(drain_elem["tags"])
    assert cat == "drainage"
    assert feat_type == "drain"


def test_collector_heartbeat_and_schedule_calculation(db_session):
    hb = update_collector_heartbeat(
        db_session,
        worker_id="test-worker",
        is_running=True,
        active_job="open-meteo",
        next_scheduled_runs={"open-meteo": "2026-10-18T23:59:00Z"},
        pid=12345,
    )
    assert hb.worker_id == "test-worker"
    assert hb.is_running is True
    assert hb.active_job == "open-meteo"
    assert hb.pid == 12345

    # Check schedule calculation
    schedule = calculate_next_scheduled_runs(db_session)
    assert "open-meteo" in schedule
    assert "osm-overpass" in schedule
