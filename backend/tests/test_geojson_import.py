"""
Comprehensive Tests for JalDrishti Geographic GeoJSON Import Workflow.
Validates:
- GeoJSON geometry & [lng, lat] coordinate order validation
- Pilot bounding box enforcement (rejects coordinates outside Nerul–Sanpada)
- Malformed GeoJSON and invalid coordinate rejection
- Duplicate-safe upsert idempotency
- Preservation of the 8 canonical baseline geographic fixtures
- Provenance recording (data_origin: official, live-collected, curated)
- API endpoint validation and ingestion run logging
"""

import json
import pytest
from sqlalchemy import select, func

from backend.models import GeographicFeature, SourceRegistryRecord, IngestionRunRecord
from backend.services.collector.geojson_importer import (
    import_geojson_dataset,
    validate_geojson_feature,
    validate_coordinate_pair,
    GeoJSONValidationError,
    import_local_geographic_directory,
)


def test_validate_coordinate_pair_success():
    """Valid [longitude, latitude] within Nerul–Sanpada pilot area must pass."""
    lng, lat = validate_coordinate_pair([73.0125, 19.0450], feature_id="test-1")
    assert lng == 73.0125
    assert lat == 19.0450


def test_inverted_coordinate_order_rejected():
    """Detects and rejects inverted [latitude, longitude] coordinates (e.g. [19.045, 73.012])."""
    with pytest.raises(GeoJSONValidationError) as exc_info:
        validate_coordinate_pair([19.0450, 73.0125], feature_id="test-inverted")
    assert "Inverted coordinate order detected" in str(exc_info.value)
    assert "[longitude, latitude]" in str(exc_info.value)


def test_out_of_bounds_coordinates_rejected():
    """Coordinates outside the Nerul–Sanpada pilot bounding box must be rejected."""
    # Coordinates in central Mumbai (Dadar: [72.84, 19.02]) - outside Nerul-Sanpada west bound
    with pytest.raises(GeoJSONValidationError) as exc_info:
        validate_coordinate_pair([72.8400, 19.0200], feature_id="test-outside", bbox_buffer=0.005)
    assert "outside the Nerul–Sanpada pilot area bounding box" in str(exc_info.value)

    # Coordinates in Delhi: [77.20, 28.61]
    with pytest.raises(GeoJSONValidationError) as exc_info:
        validate_coordinate_pair([77.2090, 28.6139], feature_id="test-delhi")
    assert "outside the Nerul–Sanpada pilot area bounding box" in str(exc_info.value)


def test_malformed_coordinates_rejected():
    """Non-numeric, NaN, null, and empty coordinate inputs must raise GeoJSONValidationError."""
    with pytest.raises(GeoJSONValidationError):
        validate_coordinate_pair(None, feature_id="null-coord")

    with pytest.raises(GeoJSONValidationError):
        validate_coordinate_pair([], feature_id="empty-coord")

    with pytest.raises(GeoJSONValidationError):
        validate_coordinate_pair([73.01], feature_id="single-coord")

    with pytest.raises(GeoJSONValidationError):
        validate_coordinate_pair(["73.01", "19.04"], feature_id="string-coord")

    with pytest.raises(GeoJSONValidationError):
        validate_coordinate_pair([float("nan"), 19.04], feature_id="nan-coord")

    with pytest.raises(GeoJSONValidationError):
        validate_coordinate_pair([73.01, float("inf")], feature_id="inf-coord")


def test_import_valid_geojson_point_and_linestring(db_session):
    """Imports valid Point and LineString features with official provenance."""
    test_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "official-sluice-9901",
                "geometry": {
                    "type": "Point",
                    "coordinates": [73.0118, 19.0348],
                },
                "properties": {
                    "osm_type": "node",
                    "osm_id": 9901,
                    "name": "Test Municipal Sluice Gate",
                    "category": "drainage",
                    "feature_type": "sluice_gate",
                    "data_origin": "official",
                    "source_attribution": "Official NMMC Test Audit",
                },
            },
            {
                "type": "Feature",
                "id": "official-drain-9902",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [73.0070, 19.0665],
                        [73.0060, 19.0655],
                    ],
                },
                "properties": {
                    "osm_type": "way",
                    "osm_id": 9902,
                    "name": "Test Storm Culvert Line",
                    "category": "drainage",
                    "feature_type": "box_culvert",
                    "data_origin": "official",
                    "source_attribution": "Official NMMC Test Audit",
                },
            },
        ],
    }

    try:
        res = import_geojson_dataset(
            db=db_session,
            geojson_data=test_geojson,
            source_id="test-nmmc-drainage",
            source_name="Test NMMC Drainage Dataset",
            data_origin="official",
        )

        assert res["status"] == "Success"
        assert res["records_inserted"] == 2
        assert res["records_rejected"] == 0

        # Verify in database
        feat1 = db_session.query(GeographicFeature).filter_by(osm_id=9901).first()
        assert feat1 is not None
        assert feat1.name == "Test Municipal Sluice Gate"
        assert feat1.category == "drainage"
        assert feat1.feature_type == "sluice_gate"
        assert feat1.data_origin == "official"
        assert feat1.coordinates_json == [73.0118, 19.0348]

        feat2 = db_session.query(GeographicFeature).filter_by(osm_id=9902).first()
        assert feat2 is not None
        assert feat2.geometry_type == "LineString"
        assert len(feat2.coordinates_json) == 2
        assert feat2.data_origin == "official"

    finally:
        db_session.query(GeographicFeature).filter(GeographicFeature.osm_id.in_([9901, 9902])).delete(synchronize_session=False)
        db_session.commit()


def test_duplicate_safe_upsert_idempotency(db_session):
    """Importing the same dataset twice must not create duplicates and must record unchanged/updated status."""
    test_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "idempotent-node-9903",
                "geometry": {
                    "type": "Point",
                    "coordinates": [73.0080, 19.0650],
                },
                "properties": {
                    "osm_type": "node",
                    "osm_id": 9903,
                    "name": "Idempotent Asset Test",
                    "category": "amenity",
                    "feature_type": "fire_station",
                    "data_origin": "official",
                },
            }
        ],
    }

    try:
        # First import: insert
        res1 = import_geojson_dataset(
            db=db_session,
            geojson_data=test_geojson,
            source_id="test-idempotency",
            data_origin="official",
        )
        assert res1["records_inserted"] == 1
        assert res1["records_updated"] == 0
        assert res1["records_unchanged"] == 0

        # Second import identical: unchanged
        res2 = import_geojson_dataset(
            db=db_session,
            geojson_data=test_geojson,
            source_id="test-idempotency",
            data_origin="official",
        )
        assert res2["records_inserted"] == 0
        assert res2["records_updated"] == 0
        assert res2["records_unchanged"] == 1

        # Third import with property change: updated
        test_geojson["features"][0]["properties"]["name"] = "Idempotent Asset Test (Updated Name)"
        res3 = import_geojson_dataset(
            db=db_session,
            geojson_data=test_geojson,
            source_id="test-idempotency",
            data_origin="official",
        )
        assert res3["records_inserted"] == 0
        assert res3["records_updated"] == 1
        assert res3["records_unchanged"] == 0

        # Assert exactly 1 record exists in DB for this osm_id
        count = db_session.query(func.count(GeographicFeature.id)).filter_by(osm_id=9903).scalar()
        assert count == 1

    finally:
        db_session.query(GeographicFeature).filter_by(osm_id=9903).delete(synchronize_session=False)
        db_session.commit()


def test_preserves_canonical_eight_fixtures(db_session):
    """The 8 baseline fixtures (osm_ids 101, 102, 201, 202, 301, 401, 402, 501) must never be lost."""
    baseline_ids = {101, 102, 201, 202, 301, 401, 402, 501}
    features = db_session.query(GeographicFeature).filter(GeographicFeature.osm_id.in_(baseline_ids)).all()
    found_ids = {f.osm_id for f in features}

    assert baseline_ids.issubset(found_ids), f"Missing baseline fixtures: {baseline_ids - found_ids}"

    for f in features:
        # All baseline fixtures are curated
        assert f.data_origin == "curated"
        assert f.source_attribution == "OpenStreetMap contributors (ODbL)"


def test_provenance_and_ingestion_run_recorded(db_session):
    """Datasets must be tracked in SourceRegistryRecord and IngestionRunRecord."""
    source_id = "test-prov-audit"
    test_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [73.0100, 19.0400]},
                "properties": {
                    "osm_type": "node",
                    "osm_id": 9904,
                    "name": "Audit Landmark",
                    "category": "amenity",
                    "feature_type": "clinic",
                    "data_origin": "curated",
                    "source_attribution": "JalDrishti Research Audit",
                },
            }
        ],
    }

    try:
        res = import_geojson_dataset(
            db=db_session,
            geojson_data=test_geojson,
            source_id=source_id,
            source_name="Provenance Audit Source",
            provider="JalDrishti Team",
            attribution="Curated Research Field Notes",
            license_name="Internal Research",
            data_origin="curated",
        )

        assert res["status"] == "Success"

        # Check source registry record
        src = db_session.get(SourceRegistryRecord, source_id)
        assert src is not None
        assert src.name == "Provenance Audit Source"
        assert src.access_method == "Local GeoJSON Import"
        assert src.status in ("Verified", "Active")

        # Check ingestion run record
        run = db_session.query(IngestionRunRecord).filter_by(source_id=source_id).order_by(IngestionRunRecord.id.desc()).first()
        assert run is not None
        assert run.status == "Success"
        assert run.records_inserted == 1

    finally:
        db_session.query(GeographicFeature).filter_by(osm_id=9904).delete(synchronize_session=False)
        db_session.query(IngestionRunRecord).filter_by(source_id=source_id).delete(synchronize_session=False)
        db_session.query(SourceRegistryRecord).filter_by(id=source_id).delete(synchronize_session=False)
        db_session.commit()


def test_api_import_endpoint_success_and_validation(client, db_session):
    """Tests POST /api/geographic-features/import for valid and invalid inputs."""
    # 1. Valid import
    valid_payload = {
        "source_id": "api-test-source",
        "source_name": "API Test Dataset",
        "data_origin": "official",
        "attribution": "API Test Attribution",
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [73.0150, 19.0420]},
                    "properties": {
                        "osm_type": "node",
                        "osm_id": 9905,
                        "name": "API Ingested Asset",
                        "category": "drainage",
                        "feature_type": "box_culvert",
                    },
                }
            ],
        },
    }

    try:
        resp = client.post("/api/geographic-features/import", json=valid_payload)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["status"] == "Success"
        assert body["records_inserted"] == 1

        # 2. Inverted coordinates rejected with 422
        inverted_payload = {
            "source_id": "api-test-source",
            "geojson": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [19.0420, 73.0150]},
                        "properties": {"osm_id": 9906},
                    }
                ],
            },
        }
        resp_inv = client.post("/api/geographic-features/import", json=inverted_payload)
        # Should be rejected (status Partial with rejected errors or 422)
        assert resp_inv.status_code in (200, 422)
        if resp_inv.status_code == 200:
            inv_body = resp_inv.get_json()
            assert inv_body["records_rejected"] == 1
            assert "Inverted coordinate order detected" in inv_body["errors"][0]["error"]

        # 3. Missing source_id rejected with 400
        resp_bad = client.post("/api/geographic-features/import", json={"geojson": {"type": "FeatureCollection"}})
        assert resp_bad.status_code == 400

    finally:
        db_session.query(GeographicFeature).filter(GeographicFeature.osm_id.in_([9905, 9906])).delete(synchronize_session=False)
        db_session.query(IngestionRunRecord).filter_by(source_id="api-test-source").delete(synchronize_session=False)
        db_session.query(SourceRegistryRecord).filter_by(id="api-test-source").delete(synchronize_session=False)
        db_session.commit()
