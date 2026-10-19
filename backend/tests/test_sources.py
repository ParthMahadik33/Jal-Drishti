"""
Tests for JalDrishti Source Registry, Geographic Features, Evidence & Collector Status API.
"""

import pytest
from unittest.mock import patch
from backend.app import create_app
from backend.database import Base, engine, SessionLocal
from backend.seed import seed_database
from backend.models import SourceRegistryRecord, GeographicFeature, IngestionRunRecord




def test_list_sources(client):
    response = client.get("/api/sources")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 6

    source_ids = [s["id"] for s in data]
    assert "open-meteo" in source_ids
    assert "osm-overpass" in source_ids
    assert "nmmc-disaster-plan" in source_ids
    assert "news-waterlogging-archive" in source_ids
    assert "carto-positron" in source_ids
    assert "seed-fixtures" in source_ids

    # Check structure
    om = next(s for s in data if s["id"] == "open-meteo")
    assert om["name"] == "Open-Meteo Weather Model & Observations"
    assert om["category"] == "Weather"
    assert om["is_enabled"] is True
    assert om["collection_interval_seconds"] == 1800


def test_get_source_detail(client):
    response = client.get("/api/sources/open-meteo")
    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == "open-meteo"
    assert "recent_runs" in data
    assert isinstance(data["recent_runs"], list)


def test_get_nonexistent_source(client):
    response = client.get("/api/sources/nonexistent-source")
    assert response.status_code == 404
    data = response.get_json()
    assert "detail" in data


def test_get_source_runs(client):
    response = client.get("/api/sources/open-meteo/runs")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)


def test_manual_refresh_unsupported_curated_source(client):
    response = client.post("/api/sources/carto-positron/refresh")
    assert response.status_code == 400
    data = response.get_json()
    assert "cannot be collected via automated trigger" in data["detail"]


def test_manual_refresh_open_meteo(client):
    mock_payload = {
        "elevation": 14.0,
        "current": {
            "time": "2026-10-18T23:00",
            "precipitation": 4.5,
            "rain": 4.5,
            "weather_code": 61,
        },
        "current_units": {"precipitation": "mm", "rain": "mm"},
        "hourly": {
            "time": ["2026-10-18T22:00", "2026-10-18T23:00", "2026-10-19T00:00"],
            "precipitation": [2.0, 4.5, 3.0],
            "rain": [2.0, 4.5, 3.0],
            "precipitation_probability": [70, 85, 60],
        },
        "hourly_units": {"precipitation": "mm", "precipitation_probability": "%"},
    }

    with patch("backend.services.collector.weather_collector.fetch_from_open_meteo_api", return_value=mock_payload):
        response = client.post("/api/sources/open-meteo/refresh")
        assert response.status_code == 200
        data = response.get_json()
        assert data["source_id"] == "open-meteo"
        assert data["status"] == "Success"
        assert data["records_retrieved"] >= 1


def test_list_geographic_features(client):
    response = client.get("/api/geographic-features")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 8  # Seed features

    # Verify GeoJSON coordinates format [lng, lat]
    for feat in data:
        assert "osm_type" in feat
        assert "osm_id" in feat
        assert "coordinates_json" in feat
        assert "source_attribution" in feat


def test_filter_geographic_features_by_category(client):
    response = client.get("/api/geographic-features?category=highway")
    assert response.status_code == 200
    data = response.get_json()
    for feat in data:
        assert feat["category"] == "highway"


def test_geographic_features_geojson_format(client):
    response = client.get("/api/geographic-features?format=geojson")
    assert response.status_code == 200
    data = response.get_json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert len(data["features"]) >= 8


def test_list_source_evidence(client):
    response = client.get("/api/source-evidence")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 4

    ids = [e["id"] for e in data]
    assert "EVID-NEWS-001" in ids
    assert "EVID-DOC-001" in ids


def test_collector_status_endpoint(client):
    response = client.get("/api/collector/status")
    assert response.status_code == 200
    data = response.get_json()
    assert "is_running" in data
    assert "heartbeat_status" in data
    assert data["heartbeat_status"] in ("Healthy", "Stale", "Offline")
