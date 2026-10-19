def test_list_maintenance(client):
    response = client.get("/api/maintenance")
    assert response.status_code == 200
    actions = response.json()
    assert len(actions) >= 3

    first = actions[0]
    assert "action_id" in first
    assert "action_type" in first
    assert "supervisor" in first
    assert "actor" in first
    assert "work_notes" in first
    assert "notes" in first
    assert "status" in first


def test_create_maintenance_action_success(client):
    payload = {
        "zone_id": "NZ-NER-03",
        "action_type": "Pump Deployment",
        "supervisor": "Quick Response Team Lead K. Patil",
        "work_notes": "Deployed 50 HP trailer pump along MIDC Road 2. Water level receded by 15cm in 40 minutes.",
        "status": "Completed & Verified",
        "verification_status": True,
        "cost_estimate": 32000.0,
    }
    response = client.post("/api/maintenance", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["zone_id"] == "NZ-NER-03"
    assert created["action_type"] == "Pump Deployment"
    assert created["supervisor"] == "Quick Response Team Lead K. Patil"
    assert created["actor"] == "Quick Response Team Lead K. Patil"
    assert created["id"].startswith("MNT-2026-")
    assert created["cost_estimate"] == 32000.0


def test_create_maintenance_invalid_zone(client):
    payload = {
        "zone_id": "NON-EXISTENT-ZONE",
        "action_type": "Inspect",
    }
    response = client.post("/api/maintenance", json=payload)
    assert response.status_code == 404
    assert "does not exist" in response.json()["detail"]


def test_create_maintenance_invalid_incident(client):
    payload = {
        "zone_id": "NZ-SAN-01",
        "incident_id": "NON-EXISTENT-INCIDENT",
        "action_type": "Inspect",
    }
    response = client.post("/api/maintenance", json=payload)
    assert response.status_code == 404
    assert "Referenced incident" in response.json()["detail"]
