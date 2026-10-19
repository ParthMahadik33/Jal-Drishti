def test_list_zones(client):
    response = client.get("/api/zones")
    assert response.status_code == 200
    zones = response.json()
    assert len(zones) == 5
    
    zone_ids = [z["id"] for z in zones]
    assert "NZ-SAN-01" in zone_ids
    assert "NZ-NER-02" in zone_ids
    assert "NZ-NER-03" in zone_ids
    assert "NZ-SAN-04" in zone_ids
    assert "NZ-NER-05" in zone_ids

    # Verify frontend alias fields
    first_zone = zones[0]
    assert "zone_id" in first_zone
    assert first_zone["zone_id"] == first_zone["id"]
    assert "coordinates" in first_zone
    assert len(first_zone["coordinates"]) == 2
    assert "svgPolygon" in first_zone
    assert "risk_factors" in first_zone


def test_get_single_zone(client):
    response = client.get("/api/zones/NZ-SAN-01")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "NZ-SAN-01"
    assert data["name"] == "Sanpada Railway Underpass (Sector 4)"
    assert data["risk_band"] == "high"


def test_get_nonexistent_zone(client):
    response = client.get("/api/zones/NON-EXISTENT")
    assert response.status_code == 404
