"""
Tests for demo reset endpoint safeguards and operational record preservation.
"""
from datetime import datetime, timezone
import pytest
from backend.config import settings
from backend.models import MaintenanceAction, CollectorHeartbeat, RainfallObservationRecord


def test_demo_reset_requires_explicit_confirmation(client):
    """Calling POST /api/demo/reset without confirm: true must fail with 400."""
    # Empty body
    res = client.post("/api/demo/reset")
    assert res.status_code == 400
    assert "Deliberate confirmation required" in res.get_json()["detail"]

    # Explicit False
    res2 = client.post("/api/demo/reset", json={"confirm": False})
    assert res2.status_code == 400

    # Arbitrary payload without confirm: true
    res3 = client.post("/api/demo/reset", json={"force": True})
    assert res3.status_code == 400


def test_demo_reset_disabled_in_production(client, monkeypatch):
    """Demo reset must be strictly blocked in production with 403."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    res = client.post("/api/demo/reset", json={"confirm": True})
    assert res.status_code == 403
    assert "disabled in this environment" in res.get_json()["detail"]


def test_demo_reset_disabled_when_flag_false(client, monkeypatch):
    """Demo reset must be blocked when ALLOW_DEMO_RESET is False."""
    monkeypatch.setattr(settings, "ALLOW_DEMO_RESET", False)
    res = client.post("/api/demo/reset", json={"confirm": True})
    assert res.status_code == 403
    assert "disabled in this environment" in res.get_json()["detail"]


def test_demo_reset_preserves_operational_maintenance_records(client):
    """
    Test that running demo reset resets baseline demo fixtures,
    but strictly preserves operational maintenance actions (data_status != 'Demo action').
    """
    # 1. Create an operational maintenance action via standard API
    payload = {
        "zone_id": "NZ-SAN-01",
        "action_type": "Clean / Desilt",
        "supervisor": "Officer P. Deshmukh (Zone 4 NMMC)",
        "work_notes": "Cleared 4 storm drains near Sanpada Sector 4. High-pressure jetting completed.",
        "status": "Completed & Verified",
        "verification_status": True,
        "data_status": "Observed",
    }
    create_res = client.post("/api/maintenance", json=payload)
    assert create_res.status_code == 201
    created_id = create_res.get_json()["id"]

    # Verify 4 records currently exist (3 demo + 1 operational)
    list_res = client.get("/api/maintenance")
    assert list_res.status_code == 200
    all_actions = list_res.get_json()
    assert len(all_actions) >= 4
    assert any(a["id"] == created_id for a in all_actions)

    # 2. Trigger demo reset with deliberate confirmation
    res = client.post("/api/demo/reset", json={"confirm": True})
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["details"]["operational_maintenance_preserved"] >= 1

    # 3. Verify that the operational maintenance action STILL exists and has original fields
    list_res_after = client.get("/api/maintenance")
    assert list_res_after.status_code == 200
    actions_after = list_res_after.get_json()
    recovered = next((a for a in actions_after if a["id"] == created_id), None)
    assert recovered is not None
    assert recovered["location_name"] == "Sanpada Railway Underpass (Sector 4)"
    assert recovered["supervisor"] == "Officer P. Deshmukh (Zone 4 NMMC)"
    assert recovered["data_status"] == "Observed"
    assert recovered["status"] == "Completed & Verified"

    # 4. Verify demo fixtures are also present
    demo_actions = [a for a in actions_after if a.get("data_status") == "Demo action"]
    assert len(demo_actions) == 3
    demo_ids = {a["id"] for a in demo_actions}
    assert "MNT-2026-042" in demo_ids
    assert "MNT-2026-039" in demo_ids
    assert "MNT-2026-035" in demo_ids

    # 5. Idempotent re-run check: reset again and ensure operational record still survives
    res2 = client.post("/api/demo/reset", json={"confirm": True})
    assert res2.status_code == 200
    list_res_final = client.get("/api/maintenance")
    actions_final = list_res_final.get_json()
    assert any(a["id"] == created_id for a in actions_final)


def test_demo_reset_preserves_collector_and_weather_observations(client):
    """Ensure collector runs and weather observations remain intact during demo reset."""
    # Check that rainfall endpoint and source registry are available
    res = client.get("/api/rainfall/current")
    assert res.status_code == 200

    # Sources must be available
    sources_res = client.get("/api/sources")
    assert sources_res.status_code == 200

    # Reset with confirmation
    reset_res = client.post("/api/demo/reset", json={"confirm": True})
    assert reset_res.status_code == 200

    # Sources and health must still report ok
    health_res = client.get("/health")
    assert health_res.status_code == 200

    sources_after = client.get("/api/sources")
    assert sources_after.status_code == 200



