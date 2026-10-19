from unittest.mock import patch
import pytest
from backend.services.weather import (
    parse_provider_response,
    get_weather_observation,
    clear_weather_cache,
    resolve_coordinates_for_zone,
    persist_observation_to_db,
    get_latest_persisted_observation,
    SPATIAL_COVERAGE_EXPLANATION,
)
from backend.models import Zone, RainfallObservationRecord


# Realistic recorded Open-Meteo fixture for Navi Mumbai
RECORDED_OPEN_METEO_FIXTURE = {
    "latitude": 19.045,
    "longitude": 73.015,
    "generationtime_ms": 0.12,
    "utc_offset_seconds": 19800,
    "timezone": "Asia/Kolkata",
    "timezone_abbreviation": "IST",
    "elevation": 12.0,
    "current_units": {
        "time": "iso8601",
        "interval": "seconds",
        "precipitation": "mm",
        "rain": "mm",
        "weather_code": "wmo code",
    },
    "current": {
        "time": "2026-10-18T18:00",
        "interval": 900,
        "precipitation": 3.8,
        "rain": 3.8,
        "weather_code": 61,
    },
    "hourly_units": {
        "time": "iso8601",
        "precipitation": "mm",
        "rain": "mm",
        "precipitation_probability": "%",
    },
    "hourly": {
        "time": [
            "2026-10-18T14:00",
            "2026-10-18T15:00",
            "2026-10-18T16:00",
            "2026-10-18T17:00",
            "2026-10-18T18:00",
            "2026-10-18T19:00",
            "2026-10-18T20:00",
            "2026-10-18T21:00",
            "2026-10-18T22:00",
        ],
        "precipitation": [0.0, 1.2, 5.4, 8.0, 3.8, 2.1, 0.4, 0.0, 0.0],
        "rain": [0.0, 1.2, 5.4, 8.0, 3.8, 2.1, 0.4, 0.0, 0.0],
        "precipitation_probability": [10, 40, 75, 85, 60, 45, 20, 10, 5],
    },
}


@pytest.fixture(autouse=True)
def reset_cache_each_test():
    clear_weather_cache()
    yield
    clear_weather_cache()


def test_parse_open_meteo_fixture_success():
    """Verify clean parsing of recorded Open-Meteo NWP payload."""
    parsed = parse_provider_response(
        raw_json=RECORDED_OPEN_METEO_FIXTURE,
        latitude=19.045,
        longitude=73.015,
        zone_id="NZ-SAN-01",
    )

    assert parsed["provider"] == "Open-Meteo"
    assert parsed["latitude"] == 19.045
    assert parsed["longitude"] == 73.015
    assert parsed["current_precipitation_mm"] == 3.8
    assert parsed["current_weather_code"] == 61
    assert "rain" in parsed["weather_description"].lower()
    assert parsed["data_status"] == "Weather Model"
    assert parsed["is_simulated"] is False
    assert parsed["units"]["precipitation"] == "mm"
    assert parsed["units"]["time"] == "ISO8601 (Asia/Kolkata)"

    # Verify partition of past vs forecast
    assert len(parsed["past_records"]) > 0
    assert len(parsed["forecast_records"]) > 0

    # Records <= 18:00 must be marked is_forecast=False
    for past_item in parsed["past_records"]:
        assert past_item["is_forecast"] is False

    # Records > 18:00 must be marked is_forecast=True
    for fc_item in parsed["forecast_records"]:
        assert fc_item["is_forecast"] is True


def test_parse_malformed_or_missing_fields():
    """Verify that absent hourly lists or null values do not cause crashes."""
    sparse_fixture = {
        "current": {"time": "2026-10-18T12:00", "precipitation": None},
        "hourly": {},
    }
    parsed = parse_provider_response(sparse_fixture, 19.045, 73.015)

    assert parsed["current_precipitation_mm"] == 0.0
    assert parsed["current_weather_code"] is None
    assert parsed["past_records"] == []
    assert parsed["forecast_records"] == []
    assert parsed["total_past_rainfall_mm"] == 0.0


def test_weather_cache_freshness_within_ttl(db_session):
    """Verify that subsequent requests within TTL hit in-memory cache without calling API."""
    with patch("backend.services.weather.fetch_from_open_meteo_api") as mock_fetch:
        mock_fetch.return_value = RECORDED_OPEN_METEO_FIXTURE

        # First request: cache miss -> calls API
        obs1 = get_weather_observation(db_session, zone_id="NZ-SAN-01", force_refresh=False)
        assert mock_fetch.call_count == 1
        assert obs1["is_cached"] is False

        # Second request: cache hit -> does NOT call API
        obs2 = get_weather_observation(db_session, zone_id="NZ-SAN-01", force_refresh=False)
        assert mock_fetch.call_count == 1
        assert obs2["is_cached"] is True
        assert obs2["is_stale"] is False


def test_weather_forced_refresh_bypasses_cache(db_session):
    """Verify that force_refresh=True bypasses in-memory cache and invokes API."""
    with patch("backend.services.weather.fetch_from_open_meteo_api") as mock_fetch:
        mock_fetch.return_value = RECORDED_OPEN_METEO_FIXTURE

        get_weather_observation(db_session, zone_id="NZ-SAN-01", force_refresh=False)
        assert mock_fetch.call_count == 1

        # Force refresh
        obs_forced = get_weather_observation(db_session, zone_id="NZ-SAN-01", force_refresh=True)
        assert mock_fetch.call_count == 2
        assert obs_forced["is_cached"] is False


def test_weather_persistence_survives_across_db_sessions(db_session):
    """Verify observations are persisted in SQLite and can be retrieved on fallback."""
    with patch("backend.services.weather.fetch_from_open_meteo_api") as mock_fetch:
        mock_fetch.return_value = RECORDED_OPEN_METEO_FIXTURE
        # Populate DB
        get_weather_observation(db_session, zone_id="NZ-SAN-01", force_refresh=True)

    # Clear memory cache to simulate restart
    clear_weather_cache()

    # Verify record in SQLite table
    persisted = get_latest_persisted_observation(db_session, 19.045, 73.015)
    assert persisted is not None
    assert persisted["current_precipitation_mm"] == 3.8
    assert len(persisted["past_records"]) > 0

    # Simulate provider failure: fallback to persisted record
    with patch("backend.services.weather.fetch_from_open_meteo_api", side_effect=RuntimeError("Connection timeout")):
        fallback_obs = get_weather_observation(db_session, zone_id="NZ-SAN-01", force_refresh=True)
        assert fallback_obs["is_stale"] is True
        assert "Cached NWP Model" in fallback_obs["provenance_text"]
        assert fallback_obs["current_precipitation_mm"] == 3.8


def test_weather_provider_timeout_without_prior_records_raises(db_session):
    """Verify that when no prior records exist and provider fails, an informative error is raised."""
    clear_weather_cache()
    from sqlalchemy import delete
    db_session.execute(delete(RainfallObservationRecord))
    db_session.commit()

    with patch("backend.services.weather.fetch_from_open_meteo_api", side_effect=RuntimeError("Provider 504 Gateway Timeout")):
        with pytest.raises(RuntimeError) as exc_info:
            get_weather_observation(db_session, zone_id="NON_EXISTENT_ZONE", force_refresh=True)
        assert "Unable to retrieve weather data" in str(exc_info.value)


def test_missing_or_zero_coordinates_handled_safely(db_session):
    """Verify zone with missing or (0,0) coordinates returns limitation error."""
    # Create temporary unmapped zone
    unmapped = Zone(
        id="NZ-UNMAPPED-09",
        code="NZ-UNMAPPED-09",
        name="Unmapped Floodplain",
        ward="Sanpada",
        latitude=0.0,
        longitude=0.0,
        risk_score=40,
    )
    db_session.add(unmapped)
    db_session.commit()

    with pytest.raises(ValueError) as exc:
        get_weather_observation(db_session, zone_id="NZ-UNMAPPED-09")
    assert "lacks verified GPS coordinates" in str(exc.value)


def test_distinction_between_forecast_stored_and_simulated(db_session):
    """Ensure data provenance explicitly flags weather model vs physical vs simulated."""
    with patch("backend.services.weather.fetch_from_open_meteo_api") as mock_fetch:
        mock_fetch.return_value = RECORDED_OPEN_METEO_FIXTURE
        obs = get_weather_observation(db_session, zone_id="NZ-SAN-01")

    # NWP model data is NOT simulated (it's real weather model output)
    assert obs["is_simulated"] is False
    assert obs["data_status"] == "Weather Model"
    assert "Not rain-gauge observed" in obs["provenance_text"]

    # Hourly records clearly separate past from future forecast
    for past in obs["past_records"]:
        assert past["is_forecast"] is False
    for fc in obs["forecast_records"]:
        assert fc["is_forecast"] is True


def test_api_rainfall_endpoints(client):
    """Integration test for /api/rainfall/current, /api/rainfall/history, and /api/rainfall/refresh."""
    with patch("backend.services.weather.fetch_from_open_meteo_api") as mock_fetch:
        mock_fetch.return_value = RECORDED_OPEN_METEO_FIXTURE

        # 1. GET /api/rainfall/current
        res_curr = client.get("/api/rainfall/current?zone_id=NZ-SAN-01")
        assert res_curr.status_code == 200
        data_curr = res_curr.json()
        assert data_curr["provider"] == "Open-Meteo"
        assert data_curr["current_precipitation_mm"] == 3.8
        assert data_curr["data_status"] == "Weather Model"

        # 2. GET /api/rainfall/history
        res_hist = client.get("/api/rainfall/history?zone_id=NZ-SAN-01")
        assert res_hist.status_code == 200
        data_hist = res_hist.json()
        assert len(data_hist["past_records"]) > 0
        assert len(data_hist["forecast_records"]) > 0
        assert "spatial_coverage_notes" in data_hist

        # 3. POST /api/rainfall/refresh
        res_ref = client.post("/api/rainfall/refresh?zone_id=NZ-SAN-01")
        assert res_ref.status_code == 200
        data_ref = res_ref.json()
        assert data_ref["is_cached"] is False
