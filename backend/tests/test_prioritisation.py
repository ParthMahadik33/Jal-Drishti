from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.models import Zone, Incident, MaintenanceAction
from backend.services.prioritisation import (
    calculate_zone_priority_and_risk,
    run_greedy_resource_scenario,
    evaluate_all_pilot_zones,
)


def test_severity_affects_priority_direction(db_session: Session):
    """Verify that higher incident severity increases priority score."""
    zone = db_session.get(Zone, "NZ-SAN-01")
    assert zone is not None

    now = datetime.now(timezone.utc)
    low_incident = Incident(
        id="TEST-INC-LOW",
        zone_id=zone.id,
        location_name="Test Low",
        latitude=19.0664,
        longitude=73.0092,
        reported_at=now,
        category="Minor Pooling",
        severity="low",
        status="New",
        report_count=1,
    )
    res_low = calculate_zone_priority_and_risk(zone, [low_incident], [], eval_time=now)

    high_incident = Incident(
        id="TEST-INC-HIGH",
        zone_id=zone.id,
        location_name="Test High",
        latitude=19.0664,
        longitude=73.0092,
        reported_at=now,
        category="Deep Inundation",
        severity="high",
        status="New",
        report_count=1,
    )
    res_high = calculate_zone_priority_and_risk(zone, [high_incident], [], eval_time=now)

    assert res_high["priority_score"] > res_low["priority_score"]
    assert res_high["factors"]["severity"]["score"] > res_low["factors"]["severity"]["score"]


def test_recurrence_affects_priority_direction(db_session: Session):
    """Verify that post-maintenance recurrence flag adds 30 points to priority score."""
    zone = db_session.get(Zone, "NZ-NER-02")
    assert zone is not None
    now = datetime.now(timezone.utc)

    inc_no_rec = Incident(
        id="TEST-INC-NOREC",
        zone_id=zone.id,
        location_name="Test No Rec",
        latitude=19.0418,
        longitude=73.0185,
        reported_at=now,
        category="Pooling",
        severity="moderate",
        status="New",
        report_count=1,
        has_recurrence_flag=False,
    )
    res_no_rec = calculate_zone_priority_and_risk(zone, [inc_no_rec], [], eval_time=now)

    inc_rec = Incident(
        id="TEST-INC-REC",
        zone_id=zone.id,
        location_name="Test Rec",
        latitude=19.0664,
        longitude=73.0092,
        reported_at=now,
        category="Pooling",
        severity="moderate",
        status="New",
        report_count=1,
        has_recurrence_flag=True,
    )
    res_rec = calculate_zone_priority_and_risk(zone, [inc_rec], [], eval_time=now)

    assert res_rec["priority_score"] - res_no_rec["priority_score"] == 30
    assert res_rec["has_recurrence"] is True
    assert res_rec["suggested_action"] == "Escalate for Engineering Assessment"


def test_empty_incidents_handled_safely(db_session: Session):
    """Verify that zones with no incidents evaluate without errors."""
    zone = db_session.get(Zone, "NZ-NER-05")
    assert zone is not None

    res = calculate_zone_priority_and_risk(zone, [], [])
    assert res["priority_score"] == 0
    assert res["priority_band"] == "Monitor"
    assert res["active_incidents_count"] == 0
    assert res["suggested_action"] == "Monitor"


def test_duplicate_and_closed_incidents_excluded_from_active_priority(db_session: Session):
    """Verify that Closed and Duplicate incidents do not inflate active priority."""
    zone = db_session.get(Zone, "NZ-SAN-04")
    assert zone is not None
    now = datetime.now(timezone.utc)

    closed_inc = Incident(
        id="TEST-INC-CLOSED",
        zone_id=zone.id,
        location_name="Test Closed",
        latitude=19.0582,
        longitude=73.0035,
        reported_at=now,
        category="Waterlogging",
        severity="high",
        status="Closed",
        report_count=5,
    )
    dup_inc = Incident(
        id="TEST-INC-DUP",
        zone_id=zone.id,
        location_name="Test Duplicate",
        latitude=19.0582,
        longitude=73.0035,
        reported_at=now,
        category="Waterlogging",
        severity="high",
        status="Duplicate",
        report_count=3,
    )

    res = calculate_zone_priority_and_risk(zone, [closed_inc, dup_inc], [], eval_time=now)
    assert res["active_incidents_count"] == 0
    assert res["priority_score"] == 0
    assert res["factors"]["severity"]["score"] == 0.0


def test_stable_deterministic_ranking(db_session: Session):
    """Verify that evaluating all zones twice on the same DB produces identical orders."""
    evals_1 = evaluate_all_pilot_zones(db_session)
    evals_2 = evaluate_all_pilot_zones(db_session)

    order_1 = [e["zone_id"] for e in evals_1]
    order_2 = [e["zone_id"] for e in evals_2]
    scores_1 = [e["priority_score"] for e in evals_1]
    scores_2 = [e["priority_score"] for e in evals_2]

    assert order_1 == order_2
    assert scores_1 == scores_2


def test_resource_scenario_budget_capping(db_session: Session):
    """Verify greedy resource allocation under a restrictive budget."""
    evals = evaluate_all_pilot_zones(db_session)
    assert len(evals) >= 3

    # Restrict budget so only the top-priority intervention can be funded
    # Standard clean/desilt is ₹15,000, engineering is ₹30,000
    res = run_greedy_resource_scenario(
        evaluations=evals,
        available_budget=35000.0,
        available_crews=5,
        max_staff_hours=200.0,
    )

    results = res["scenario_results"]
    assert results["total_selected_count"] >= 1
    assert results["total_unselected_count"] >= 1
    assert results["total_estimated_cost"] <= 35000.0
    assert results["remaining_budget"] >= 0.0
    assert "budget" in results["unselected_interventions"][0]["shortfall_reason"].lower()


def test_resource_scenario_crew_hours_capping(db_session: Session):
    """Verify greedy resource allocation under a restrictive staff-hour limit."""
    evals = evaluate_all_pilot_zones(db_session)

    # Plenty of budget (₹200,000), but only 30 staff-hours available
    res = run_greedy_resource_scenario(
        evaluations=evals,
        available_budget=200000.0,
        available_crews=1,
        max_staff_hours=30.0,
    )

    results = res["scenario_results"]
    assert results["total_staff_hours_used"] <= 30.0
    assert results["remaining_staff_hours"] >= 0.0
    assert len(results["unselected_interventions"]) > 0


def test_invalid_resource_scenario_constraints_raise():
    """Verify that negative budget or crew constraints raise ValueError."""
    with pytest.raises(ValueError):
        run_greedy_resource_scenario([], available_budget=-1000.0, available_crews=2, max_staff_hours=50.0)

    with pytest.raises(ValueError):
        run_greedy_resource_scenario([], available_budget=1000.0, available_crews=-1, max_staff_hours=50.0)


def test_api_prioritisation_endpoints(client):
    """Test REST API endpoints for prioritisation and scenario simulation."""
    # 1. List evaluations
    resp = client.get("/api/prioritisation/evaluations")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    assert "priority_score" in data[0]
    assert "factors" in data[0]
    assert "provenance" in data[0]

    # 2. Get single zone evaluation
    z_id = data[0]["zone_id"]
    resp_single = client.get(f"/api/prioritisation/evaluations/{z_id}")
    assert resp_single.status_code == 200
    single_data = resp_single.json()
    assert single_data["zone_id"] == z_id
    assert "engine_version" in single_data

    # 3. Nonexistent zone returns 404
    resp_404 = client.get("/api/prioritisation/evaluations/NZ-NONEXISTENT")
    assert resp_404.status_code == 404

    # 4. POST scenario
    scenario_payload = {
        "available_budget": 45000.0,
        "available_crews": 2,
        "max_staff_hours": 80.0,
    }
    resp_scenario = client.post("/api/prioritisation/scenario", json=scenario_payload)
    assert resp_scenario.status_code == 200
    sc_data = resp_scenario.json()
    assert "scenario_results" in sc_data
    assert sc_data["scenario_results"]["total_estimated_cost"] <= 45000.0
    assert len(sc_data["engine_assumptions"]) >= 3

    # 5. Invalid negative budget produces 422
    resp_invalid = client.post("/api/prioritisation/scenario", json={"available_budget": -500.0})
    assert resp_invalid.status_code == 422
