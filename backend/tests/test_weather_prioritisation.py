"""
JalDrishti v5 — Weather-Aware Risk and Priority Engine Tests

Tests the deterministic integration between regional atmospheric weather signals
and local municipal triage evidence without overstating predictive accuracy.

Validates:
1. Low versus elevated precipitation scenarios.
2. Rainfall forecast versus past observations.
3. Shared regional weather across multiple zones.
4. Different local incident histories under identical weather conditions.
5. Stale, unavailable and simulated weather data handling.
6. Missing susceptibility inputs and safe defaults.
7. Stable deterministic ranking under identical inputs.
8. Recurrence and resource-scenario preservation.
9. Correct Open-Meteo Best Match model/source attribution.
"""

from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.models import Zone, Incident, MaintenanceAction
from backend.services.prioritisation import (
    calculate_zone_priority_and_risk,
    assess_regional_weather_urgency,
    evaluate_all_pilot_zones,
    run_greedy_resource_scenario,
    ENGINE_VERSION,
)


@pytest.fixture
def dry_weather_snapshot():
    """Recorded fixture representing dry regional conditions."""
    return {
        "provider": "Open-Meteo",
        "provider_model": "Open-Meteo Best Match (Operational Composite)",
        "latitude": 19.045,
        "longitude": 73.015,
        "provider_timestamp": "2026-10-18T18:00",
        "retrieved_at": "2026-10-18T18:05:00+00:00",
        "current_precipitation_mm": 0.0,
        "current_intensity_mm_hr": 0.0,
        "total_past_rainfall_mm": 1.2,
        "is_simulated": False,
        "is_stale": False,
        "past_records": [
            {"time": "16:00", "precipitation_mm": 0.2, "is_forecast": False},
            {"time": "17:00", "precipitation_mm": 1.0, "is_forecast": False},
            {"time": "18:00", "precipitation_mm": 0.0, "is_forecast": False},
        ],
        "forecast_records": [
            {"time": "19:00", "precipitation_mm": 0.0, "is_forecast": True},
            {"time": "20:00", "precipitation_mm": 0.0, "is_forecast": True},
            {"time": "21:00", "precipitation_mm": 0.0, "is_forecast": True},
        ],
    }


@pytest.fixture
def elevated_storm_weather_snapshot():
    """Recorded fixture representing heavy convective spell (42 mm volume, 22 mm/hr peak)."""
    return {
        "provider": "Open-Meteo",
        "provider_model": "Open-Meteo Best Match (Operational Composite)",
        "latitude": 19.045,
        "longitude": 73.015,
        "provider_timestamp": "2026-10-18T18:00",
        "retrieved_at": "2026-10-18T18:05:00+00:00",
        "current_precipitation_mm": 18.5,
        "current_intensity_mm_hr": 18.5,
        "total_past_rainfall_mm": 24.0,
        "is_simulated": False,
        "is_stale": False,
        "past_records": [
            {"time": "16:00", "precipitation_mm": 4.0, "is_forecast": False},
            {"time": "17:00", "precipitation_mm": 8.0, "is_forecast": False},
            {"time": "18:00", "precipitation_mm": 12.0, "is_forecast": False},
        ],
        "forecast_records": [
            {"time": "19:00", "precipitation_mm": 22.0, "is_forecast": True},
            {"time": "20:00", "precipitation_mm": 10.0, "is_forecast": True},
            {"time": "21:00", "precipitation_mm": 4.0, "is_forecast": True},
        ],
    }


def test_correct_model_attribution_and_metadata():
    """Verify that Open-Meteo Best Match is accurately attributed without fabricated labels."""
    snapshot = {
        "provider": "Open-Meteo",
        "provider_model": "Open-Meteo Best Match (Operational Composite)",
        "provider_timestamp": "2026-10-18T18:00",
        "retrieved_at": "2026-10-18T18:02:00+00:00",
        "is_simulated": False,
        "is_stale": False,
    }
    urgency = assess_regional_weather_urgency(snapshot)
    assert urgency["weather_source"] == "Open-Meteo Best Match (Operational Composite)"
    assert "Open-Meteo Best Match" in urgency["weather_source"]
    assert "ECMWF/GFS Blend" not in urgency["weather_source"]
    assert urgency["is_shared_regional_signal"] is True
    assert "cluster_scope_note" in urgency


def test_low_versus_elevated_precipitation_scenarios(db_session: Session, dry_weather_snapshot, elevated_storm_weather_snapshot):
    """Verify that elevated precipitation increases regional urgency band and score without fabricating street variance."""
    zone = db_session.get(Zone, "NZ-NER-02")
    assert zone is not None

    dry_urgency = assess_regional_weather_urgency(dry_weather_snapshot)
    elevated_urgency = assess_regional_weather_urgency(elevated_storm_weather_snapshot)

    assert dry_urgency["urgency_band"] == "Low"
    assert elevated_urgency["urgency_band"] in ("Elevated", "Critical")
    assert elevated_urgency["urgency_score"] > dry_urgency["urgency_score"]
    assert elevated_urgency["forecast_6h_volume_mm"] == 36.0


def test_shared_regional_weather_across_multiple_zones(db_session: Session, elevated_storm_weather_snapshot):
    """Verify that all zones in the pilot cluster receive the identical shared regional weather signal."""
    zones = db_session.execute(select(Zone)).scalars().all()
    assert len(zones) >= 4

    urgency_scores = []
    urgency_bands = []

    for zone in zones:
        res = calculate_zone_priority_and_risk(
            zone=zone,
            incidents=[],
            maintenance_actions=[],
            weather_snapshot=elevated_storm_weather_snapshot,
        )
        assert res["regional_weather"] is not None
        assert res["regional_weather"]["is_shared_regional_signal"] is True
        urgency_scores.append(res["regional_weather"]["urgency_score"])
        urgency_bands.append(res["regional_weather"]["urgency_band"])

    # All zones must share the exact same regional atmospheric urgency
    assert len(set(urgency_scores)) == 1
    assert len(set(urgency_bands)) == 1


def test_different_local_incident_histories_under_same_weather(db_session: Session, elevated_storm_weather_snapshot):
    """
    Verify that under the identical regional storm, local operational priority is differentiated
    by active unclosed incidents, severity, and recurrence evidence.
    """
    zone_quiet = db_session.get(Zone, "NZ-SAN-04")
    zone_hot = db_session.get(Zone, "NZ-NER-02")
    assert zone_quiet and zone_hot

    now = datetime.now(timezone.utc)
    hot_incident = Incident(
        id="TEST-INC-HOT-01",
        zone_id=zone_hot.id,
        location_name="Sector 19 Substation",
        latitude=19.0418,
        longitude=73.0185,
        reported_at=now,
        category="Deep Inundation",
        severity="high",
        status="New",
        report_count=4,
    )

    eval_quiet = calculate_zone_priority_and_risk(
        zone=zone_quiet,
        incidents=[],
        maintenance_actions=[],
        eval_time=now,
        weather_snapshot=elevated_storm_weather_snapshot,
    )

    eval_hot = calculate_zone_priority_and_risk(
        zone=zone_hot,
        incidents=[hot_incident],
        maintenance_actions=[],
        eval_time=now,
        weather_snapshot=elevated_storm_weather_snapshot,
    )

    # Both share the same regional weather signal
    assert eval_quiet["regional_weather"]["urgency_score"] == eval_hot["regional_weather"]["urgency_score"]
    # But local operational priority is starkly differentiated by real on-the-ground reports
    assert eval_quiet["priority_score"] == 0
    assert eval_hot["priority_score"] >= 45
    assert eval_hot["priority_band"] in ("High", "Urgent")
    assert "high-severity" in eval_hot["ranking_reasons"][0]


def test_stale_unavailable_and_simulated_weather_data():
    """Verify that stale, simulated, and unavailable feeds are disclosed with transparent confidence limits."""
    # 1. Unavailable
    unavail = assess_regional_weather_urgency(None)
    assert unavail["weather_status"] == "Unavailable"
    assert unavail["urgency_band"] == "Unavailable"
    assert unavail["urgency_score"] is None
    assert unavail["confidence"] == "None"
    assert any("Weather telemetry feed is unreachable" in c for c in unavail["confidence_limitations"])

    # 2. Stale
    stale_snapshot = {
        "provider": "Open-Meteo",
        "provider_model": "Open-Meteo Best Match",
        "current_precipitation_mm": 5.0,
        "is_stale": True,
        "is_simulated": False,
    }
    stale_res = assess_regional_weather_urgency(stale_snapshot)
    assert stale_res["weather_status"] == "Stale"
    assert stale_res["confidence"] == "Low"
    assert any("stale" in c.lower() for c in stale_res["confidence_limitations"])

    # 3. Simulated
    sim_snapshot = {
        "provider": "Open-Meteo",
        "provider_model": "Open-Meteo Best Match",
        "current_precipitation_mm": 12.0,
        "is_stale": False,
        "is_simulated": True,
    }
    sim_res = assess_regional_weather_urgency(sim_snapshot)
    assert sim_res["weather_status"] == "Simulated"
    assert any("demonstration" in c.lower() for c in sim_res["confidence_limitations"])


def test_forecast_versus_past_observations():
    """Verify distinction between past accumulation and forward forecast volume."""
    # Forecast only (e.g., incoming storm front before rain arrives)
    incoming_front = {
        "provider_model": "Open-Meteo Best Match",
        "current_precipitation_mm": 0.0,
        "current_intensity_mm_hr": 0.0,
        "total_past_rainfall_mm": 0.0,
        "past_records": [],
        "forecast_records": [
            {"time": "19:00", "precipitation_mm": 15.0, "is_forecast": True},
            {"time": "20:00", "precipitation_mm": 20.0, "is_forecast": True},
        ],
    }
    res = assess_regional_weather_urgency(incoming_front)
    assert res["recent_6h_volume_mm"] == 0.0
    assert res["forecast_6h_volume_mm"] == 35.0
    assert res["weather_status"] == "Forecast-Derived"
    assert res["urgency_band"] in ("Elevated", "Critical")


def test_missing_susceptibility_inputs_handled_safely(db_session: Session):
    """Verify that zones missing risk_factors or terrain_factor default gracefully without crashes."""
    zone_sparse = Zone(
        id="NZ-SPARSE-99",
        code="NZ-SPARSE-99",
        name="Sparse Unconfigured Basin",
        ward="Nerul",
        latitude=19.045,
        longitude=73.015,
        risk_factors=None,
        terrain_factor=None,
        missing_signals=None,
    )
    db_session.add(zone_sparse)
    db_session.commit()

    res = calculate_zone_priority_and_risk(
        zone=zone_sparse,
        incidents=[],
        maintenance_actions=[],
        weather_snapshot=None,
    )
    assert res["risk_score"] > 0
    assert res["priority_score"] == 0
    assert isinstance(res["factors"], dict)
    assert res["regional_weather"]["weather_status"] == "Unavailable"


def test_stable_deterministic_ranking_under_identical_inputs(db_session: Session, elevated_storm_weather_snapshot):
    """Verify that multiple evaluations of all pilot zones produce identical sort order."""
    evals_1 = evaluate_all_pilot_zones(db_session)
    evals_2 = evaluate_all_pilot_zones(db_session)

    assert len(evals_1) == len(evals_2)
    for e1, e2 in zip(evals_1, evals_2):
        assert e1["zone_id"] == e2["zone_id"]
        assert e1["priority_score"] == e2["priority_score"]
        assert e1["suggested_action"] == e2["suggested_action"]


def test_recurrence_and_greedy_resource_scenario_preserved(db_session: Session, elevated_storm_weather_snapshot):
    """Verify that recurrence elevation and what-if simulation work seamlessly with weather-aware evaluations."""
    evaluations = evaluate_all_pilot_zones(db_session)
    assert len(evaluations) > 0

    scenario = run_greedy_resource_scenario(
        evaluations=evaluations,
        available_budget=50000.0,
        available_crews=2,
        max_staff_hours=80.0,
    )
    assert "scenario_results" in scenario
    assert scenario["scenario_results"]["total_selected_count"] >= 1
    assert scenario["scenario_results"]["total_estimated_cost"] <= 50000.0
