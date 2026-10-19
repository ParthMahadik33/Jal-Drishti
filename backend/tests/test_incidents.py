def test_list_and_filter_incidents(client):
    response = client.get("/api/incidents")
    assert response.status_code == 200
    incidents = response.json()
    assert len(incidents) >= 7

    # Verify frontend alias fields
    first = incidents[0]
    assert "incident_id" in first
    assert "timestamp" in first
    assert "relative_time" in first
    assert "visual_severity" in first
    assert "review_state" in first

    # Filter by zone
    res_zone = client.get("/api/incidents?zone_id=NZ-SAN-01")
    assert res_zone.status_code == 200
    for inc in res_zone.json():
        assert inc["zone_id"] == "NZ-SAN-01"

    # Filter by status
    res_status = client.get("/api/incidents?status=Needs Review")
    assert res_status.status_code == 200
    for inc in res_status.json():
        assert inc["status"] == "Needs Review"


def test_create_incident_success(client):
    payload = {
        "zone_id": "NZ-NER-02",
        "location_name": "Nerul Station West Plaza",
        "category": "Clogged Grate Inundation",
        "severity": "high",
        "notes": "Severe pooling near west ticket counters.",
        "report_count": 2,
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["zone_id"] == "NZ-NER-02"
    assert created["category"] == "Clogged Grate Inundation"
    assert created["severity"] == "high"
    assert created["id"].startswith("INC-2026-")
    assert created["incident_id"] == created["id"]

    # Verify retrieval
    res_get = client.get(f"/api/incidents/{created['id']}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == created["id"]


def test_create_incident_invalid_zone(client):
    payload = {
        "zone_id": "INVALID-ZONE",
        "category": "Flooding",
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 404
    assert "does not exist" in response.json()["detail"]


def test_update_incident_status(client):
    # Update state of INC-2026-089
    patch_payload = {
        "status": "Confirmed",
        "review_notes": "Supervisor verified 35cm inundation on site.",
    }
    response = client.patch("/api/incidents/INC-2026-089", json=patch_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Confirmed"
    assert data["review_state"] == "Confirmed"
    assert data["review_notes"] == "Supervisor verified 35cm inundation on site."
