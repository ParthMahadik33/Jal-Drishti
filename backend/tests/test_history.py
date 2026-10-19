def test_zone_history_endpoint(client):
    response = client.get("/api/zones/NZ-SAN-01/history")
    assert response.status_code == 200
    history = response.json()
    assert history["zone_id"] == "NZ-SAN-01"
    assert history["zone_name"] == "Sanpada Railway Underpass (Sector 4)"
    assert len(history["incidents"]) >= 1
    assert len(history["maintenance"]) >= 1


def test_zone_history_not_found(client):
    response = client.get("/api/zones/NON-EXISTENT/history")
    assert response.status_code == 404


def test_action_queue_endpoint(client):
    response = client.get("/api/action-queue")
    assert response.status_code == 200
    queue = response.json()
    assert len(queue) == 5
    
    # Top rank should be the recurring underpass hotspot
    top_rank = queue[0]
    assert top_rank["rank"] == 1
    assert top_rank["zone_id"] == "NZ-SAN-01"
    assert top_rank["has_recurrence"] is True
    assert len(top_rank["ranking_reasons"]) > 0


def test_recurrence_detection_on_new_incident(client):
    """
    Test that creating a new incident in a zone with recent maintenance
    automatically triggers the recurrence rule flag.
    """
    # 1. Record a maintenance action in NZ-SAN-01
    mnt_res = client.post("/api/maintenance", json={
        "zone_id": "NZ-SAN-01",
        "action_type": "Clean / Desilt",
        "supervisor": "Divisional Engineer R. Kadam",
        "work_notes": "Desilted 1.5t debris from underpass sump grates.",
        "status": "Completed & Verified",
    })
    assert mnt_res.status_code == 201
    recent_mnt = mnt_res.json()

    # 2. Report a follow-up incident in the same zone (within 72 hours)
    payload = {
        "zone_id": "NZ-SAN-01",
        "category": "Follow-up Inundation Report",
        "severity": "high",
        "notes": "Waterlogging reappeared at same underpass cell following afternoon convective spell.",
        "report_count": 3,
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["has_recurrence_flag"] is True
    assert data["recurrence_details"] is not None
    assert data["recurrence_details"]["status"] == "flagged"
    assert data["recurrence_details"]["prior_action_id"] == recent_mnt["id"]

