import hashlib
import hmac
import json
import pytest
from backend.models import Incident, WhatsAppInboundMessage, Zone
from backend.services.prioritisation import calculate_zone_priority_and_risk


def generate_sig(secret: str, payload_bytes: bytes) -> str:
    """Helper to compute Meta X-Hub-Signature-256 header."""
    mac = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={mac}"


# ---------------------------------------------------------------------------
# 1. Webhook Handshake Verification (GET)
# ---------------------------------------------------------------------------

def test_webhook_verification_success(client, monkeypatch):
    test_token = "jaldrishti_verify_secret_token_123"
    monkeypatch.setattr("backend.config.settings.WHATSAPP_VERIFY_TOKEN", test_token)

    params = {
        "hub.mode": "subscribe",
        "hub.challenge": "1158201444",
        "hub.verify_token": test_token,
    }
    res = client.get("/api/whatsapp/webhook", query_string=params)
    assert res.status_code == 200
    assert res.text == "1158201444"


def test_webhook_verification_invalid_token(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_VERIFY_TOKEN", "real_token")
    params = {
        "hub.mode": "subscribe",
        "hub.challenge": "1158201444",
        "hub.verify_token": "wrong_token",
    }
    res = client.get("/api/whatsapp/webhook", query_string=params)
    assert res.status_code == 403


def test_webhook_verification_invalid_mode(client, monkeypatch):
    test_token = "real_token"
    monkeypatch.setattr("backend.config.settings.WHATSAPP_VERIFY_TOKEN", test_token)
    params = {
        "hub.mode": "unsubscribe",
        "hub.challenge": "1158201444",
        "hub.verify_token": test_token,
    }
    res = client.get("/api/whatsapp/webhook", query_string=params)
    assert res.status_code == 403


def test_webhook_verification_missing_parameters(client):
    res = client.get("/api/whatsapp/webhook")
    assert res.status_code == 400


def test_webhook_verification_unconfigured_server_token(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_VERIFY_TOKEN", "")
    params = {
        "hub.mode": "subscribe",
        "hub.challenge": "1158201444",
        "hub.verify_token": "any_token",
    }
    res = client.get("/api/whatsapp/webhook", query_string=params)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# 2. Signature Validation (POST)
# ---------------------------------------------------------------------------

def test_webhook_signature_valid(client, monkeypatch):
    test_secret = "app_secret_test_98765"
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", test_secret)

    payload = {
        "object": "whatsapp_business_account",
        "entry": [],
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    signature = generate_sig(test_secret, body_bytes)

    res = client.post(
        "/api/whatsapp/webhook",
        data=body_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": signature,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"


def test_webhook_signature_invalid(client, monkeypatch):
    test_secret = "app_secret_test_98765"
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", test_secret)

    payload = {"object": "whatsapp_business_account", "entry": []}
    body_bytes = json.dumps(payload).encode("utf-8")
    invalid_signature = "sha256=0000000000000000000000000000000000000000000000000000000000000000"

    res = client.post(
        "/api/whatsapp/webhook",
        data=body_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": invalid_signature,
        },
    )
    assert res.status_code == 403


def test_webhook_signature_missing_when_secret_configured(client, monkeypatch):
    test_secret = "app_secret_test_98765"
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", test_secret)

    payload = {"object": "whatsapp_business_account", "entry": []}
    body_bytes = json.dumps(payload).encode("utf-8")

    res = client.post(
        "/api/whatsapp/webhook",
        data=body_bytes,
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# 3. Inbound Text Message Processing & Evidence-Based Severity
# ---------------------------------------------------------------------------

def test_inbound_text_message(client, monkeypatch, test_engine):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    wamid = "wamid.TEST_TEXT_MSG_001"
    raw_citizen_phone = "919876543210"
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "BIZ_ACCT_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "15550234567",
                                "phone_number_id": "PNID_999",
                            },
                            "contacts": [
                                {
                                    "profile": {"name": "Aarav Sharma"},
                                    "wa_id": raw_citizen_phone,
                                }
                            ],
                            "messages": [
                                {
                                    "from": raw_citizen_phone,
                                    "id": wamid,
                                    "timestamp": "1729296000",
                                    "type": "text",
                                    "text": {
                                        "body": "Severe waterlogging near Sanpada underpass, cars unable to pass"
                                    },
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    res = client.post("/api/whatsapp/webhook", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["processed_count"] == 1
    assert data["duplicate_count"] == 0
    assert len(data["incident_ids"]) == 1

    new_inc_id = data["incident_ids"][0]

    # Verify incident created in database via API
    inc_res = client.get(f"/api/incidents/{new_inc_id}")
    assert inc_res.status_code == 200
    inc_data = inc_res.json()
    assert inc_data["id"] == new_inc_id
    assert inc_data["zone_id"] == "NZ-SAN-01"  # Matched landmark "Sanpada underpass"
    # Unassessed severity explicitly assigned - NOT verified flood severity
    assert inc_data["severity"] == "unassessed"
    assert inc_data["visual_severity"] == "unassessed"
    assert inc_data["status"] == "New"
    assert inc_data["report_source"] == "WhatsApp Citizen Inflow"
    assert inc_data["data_status"] == "Inferred"
    assert inc_data["raw_message_id"] == wamid
    # Phone number is masked
    assert "98*** ***10" in inc_data["reporter_summary"]
    assert raw_citizen_phone not in inc_data["reporter_summary"]
    # No fake AI confidence
    assert inc_data["ai_confidence"] is None
    assert "flood severity unassessed" in inc_data["ai_uncertainty_notes"]

    # Verify WhatsAppInboundMessage storage privacy
    from sqlalchemy.orm import Session
    with Session(test_engine) as session:
        inbound = session.get(WhatsAppInboundMessage, wamid)
        assert inbound is not None
        assert inbound.wa_id == "+91 98*** ***10"
        # Verify raw_payload was sanitized and does NOT contain raw phone numbers
        raw_payload_str = json.dumps(inbound.raw_payload)
        assert raw_citizen_phone not in raw_payload_str
        assert "+91 98*** ***10" in raw_payload_str


# ---------------------------------------------------------------------------
# 4. Inbound Location Pin Processing & Unassessed Severity
# ---------------------------------------------------------------------------

def test_inbound_location_pin_message(client, monkeypatch, test_engine):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    wamid = "wamid.TEST_LOC_MSG_002"
    raw_citizen_phone = "919820011223"
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "BIZ_ACCT_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": "PNID_999"},
                            "contacts": [
                                {
                                    "profile": {"name": "Priya Patel"},
                                    "wa_id": raw_citizen_phone,
                                }
                            ],
                            "messages": [
                                {
                                    "from": raw_citizen_phone,
                                    "id": wamid,
                                    "timestamp": "1729296005",
                                    "type": "location",
                                    "location": {
                                        "latitude": 19.0664,
                                        "longitude": 73.0092,
                                        "name": "Sanpada Station Road",
                                        "address": "Sector 4, Sanpada, Navi Mumbai",
                                    },
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    res = client.post("/api/whatsapp/webhook", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["processed_count"] == 1
    new_inc_id = data["incident_ids"][0]

    inc_res = client.get(f"/api/incidents/{new_inc_id}")
    assert inc_res.status_code == 200
    inc_data = inc_res.json()
    assert inc_data["latitude"] == pytest.approx(19.0664, abs=0.001)
    assert inc_data["longitude"] == pytest.approx(73.0092, abs=0.001)
    assert inc_data["category"] == "Geotagged Citizen Report"
    # Unassessed severity explicitly assigned
    assert inc_data["severity"] == "unassessed"
    assert inc_data["data_status"] == "Inferred"
    assert inc_data["raw_message_id"] == wamid
    assert "awaiting municipal field verification" in inc_data["ai_uncertainty_notes"]

    # Verify privacy in raw_payload
    from sqlalchemy.orm import Session
    with Session(test_engine) as session:
        inbound = session.get(WhatsAppInboundMessage, wamid)
        assert raw_citizen_phone not in json.dumps(inbound.raw_payload)


# ---------------------------------------------------------------------------
# 5. Inbound Image Message Processing & Unassessed Severity
# ---------------------------------------------------------------------------

def test_inbound_image_message(client, monkeypatch, test_engine):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    wamid = "wamid.TEST_IMG_MSG_003"
    media_id = "media_upload_id_778899"
    raw_citizen_phone = "919833445566"
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "BIZ_ACCT_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": "PNID_999"},
                            "contacts": [
                                {
                                    "profile": {"name": "Vikram Desai"},
                                    "wa_id": raw_citizen_phone,
                                }
                            ],
                            "messages": [
                                {
                                    "from": raw_citizen_phone,
                                    "id": wamid,
                                    "timestamp": "1729296010",
                                    "type": "image",
                                    "image": {
                                        "id": media_id,
                                        "mime_type": "image/jpeg",
                                        "sha256": "fakehash123",
                                        "caption": "Water level reaching knee height at Nerul market",
                                    },
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    res = client.post("/api/whatsapp/webhook", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["processed_count"] == 1
    new_inc_id = data["incident_ids"][0]

    inc_res = client.get(f"/api/incidents/{new_inc_id}")
    assert inc_res.status_code == 200
    inc_data = inc_res.json()
    assert inc_data["category"] == "Citizen Photo Report"
    assert inc_data["status"] == "Needs Review"
    assert inc_data["severity"] == "unassessed"
    assert inc_data["image_url"] == f"/api/whatsapp/media/{media_id}"
    assert inc_data["raw_message_id"] == wamid
    # Does not claim AI image classification is already performed
    assert inc_data["ai_confidence"] is None
    assert "Flood severity unassessed" in inc_data["ai_uncertainty_notes"]
    assert "pending media processing" in inc_data["ai_uncertainty_notes"]


# ---------------------------------------------------------------------------
# 6. Idempotency & Duplicate Deliveries
# ---------------------------------------------------------------------------

def test_inbound_duplicate_message_idempotency(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    wamid = "wamid.DUPLICATE_TEST_MSG_999"
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "BIZ_ACCT_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "messages": [
                                {
                                    "from": "919876543210",
                                    "id": wamid,
                                    "timestamp": "1729296020",
                                    "type": "text",
                                    "text": {"body": "Water pooling near APMC market gate 3"},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    # 1. First delivery
    res1 = client.post("/api/whatsapp/webhook", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["processed_count"] == 1
    assert data1["duplicate_count"] == 0
    created_inc_id = data1["incident_ids"][0]

    # 2. Duplicate retry delivery from Meta
    res2 = client.post("/api/whatsapp/webhook", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["processed_count"] == 0
    assert data2["duplicate_count"] == 1
    assert len(data2["incident_ids"]) == 0

    # Verify no second incident was created
    all_inc = client.get("/api/incidents").json()
    matches = [i for i in all_inc if i.get("raw_message_id") == wamid]
    assert len(matches) == 1
    assert matches[0]["id"] == created_inc_id


# ---------------------------------------------------------------------------
# 7. Unsupported Message Types & Status Updates
# ---------------------------------------------------------------------------

def test_inbound_unsupported_message_type(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    wamid = "wamid.STICKER_TEST_004"
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "BIZ_ACCT_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "messages": [
                                {
                                    "from": "919876543210",
                                    "id": wamid,
                                    "timestamp": "1729296030",
                                    "type": "sticker",
                                    "sticker": {"id": "sticker_123"},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    res = client.post("/api/whatsapp/webhook", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["processed_count"] == 0
    assert data["ignored_count"] == 1
    assert len(data["incident_ids"]) == 0


def test_inbound_status_update_receipts(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "BIZ_ACCT_123",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "statuses": [
                                {
                                    "id": "wamid.PREVIOUS_MSG_ID",
                                    "status": "delivered",
                                    "timestamp": "1729296035",
                                    "recipient_id": "919876543210",
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    res = client.post("/api/whatsapp/webhook", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["processed_count"] == 0
    assert data["ignored_count"] == 1


# ---------------------------------------------------------------------------
# 8. Malformed & Edge-Case Payloads
# ---------------------------------------------------------------------------

def test_inbound_malformed_json(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    res = client.post(
        "/api/whatsapp/webhook",
        data="not a valid json string {missing_brace",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400


def test_inbound_empty_payload(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    res = client.post("/api/whatsapp/webhook", json={})
    assert res.status_code == 200
    data = res.json()
    assert data["processed_count"] == 0


# ---------------------------------------------------------------------------
# 9. Operator-Feed Access Control
# ---------------------------------------------------------------------------

def test_operator_feed_access_control(client, monkeypatch):
    test_key = "secure_operator_api_key_445566"
    monkeypatch.setattr("backend.config.settings.OPERATOR_API_KEY", test_key)

    # 1. Unauthenticated request to /api/whatsapp/messages rejected with 401
    res_no_auth = client.get("/api/whatsapp/messages")
    assert res_no_auth.status_code == 401

    # 2. Invalid API key rejected with 401
    res_bad_auth = client.get(
        "/api/whatsapp/messages",
        headers={"X-API-Key": "wrong_operator_key"},
    )
    assert res_bad_auth.status_code == 401

    # 3. Valid X-API-Key header succeeds with 200
    res_x_api_key = client.get(
        "/api/whatsapp/messages",
        headers={"X-API-Key": test_key},
    )
    assert res_x_api_key.status_code == 200
    assert isinstance(res_x_api_key.json(), list)

    # 4. Valid Authorization: Bearer succeeds with 200
    res_bearer = client.get(
        "/api/whatsapp/messages",
        headers={"Authorization": f"Bearer {test_key}"},
    )
    assert res_bearer.status_code == 200

    # 5. Media endpoint requires authentication
    res_media_no_auth = client.get("/api/whatsapp/media/media_dummy_id_123")
    assert res_media_no_auth.status_code == 401

    # 6. Media endpoint with valid key succeeds
    monkeypatch.setattr("backend.config.settings.WHATSAPP_ACCESS_TOKEN", "")
    res_media_auth = client.get(
        "/api/whatsapp/media/media_dummy_id_123",
        headers={"X-API-Key": test_key},
    )
    assert res_media_auth.status_code == 200
    assert res_media_auth.json()["media_id"] == "media_dummy_id_123"


# ---------------------------------------------------------------------------
# 10. Fail-Closed Production Configuration
# ---------------------------------------------------------------------------

def test_production_fail_closed_missing_webhook_secret(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.ENVIRONMENT", "production")
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "")

    res = client.post("/api/whatsapp/webhook", json={"object": "whatsapp_business_account"})
    assert res.status_code == 500
    assert "WHATSAPP_APP_SECRET must be configured in production" in res.json()["detail"]


def test_production_fail_closed_placeholder_secret(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.ENVIRONMENT", "production")
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", "your_meta_app_secret_here")

    res = client.post("/api/whatsapp/webhook", json={"object": "whatsapp_business_account"})
    assert res.status_code == 500
    assert "WHATSAPP_APP_SECRET must be configured in production" in res.json()["detail"]


def test_production_fail_closed_missing_verify_token(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.ENVIRONMENT", "production")
    monkeypatch.setattr("backend.config.settings.WHATSAPP_VERIFY_TOKEN", "")

    params = {"hub.mode": "subscribe", "hub.challenge": "112233", "hub.verify_token": "any"}
    res = client.get("/api/whatsapp/webhook", query_string=params)
    assert res.status_code == 500
    assert "WHATSAPP_VERIFY_TOKEN must be configured in production" in res.json()["detail"]


def test_production_fail_closed_unconfigured_operator_key(client, monkeypatch):
    monkeypatch.setattr("backend.config.settings.ENVIRONMENT", "production")
    monkeypatch.setattr("backend.config.settings.OPERATOR_API_KEY", "")

    res = client.get("/api/whatsapp/messages")
    assert res.status_code == 401
    assert "Operator authentication is required in production" in res.json()["detail"]


def test_production_with_valid_credentials_succeeds(client, monkeypatch):
    test_secret = "prod_app_secret_real_value_12345"
    monkeypatch.setattr("backend.config.settings.ENVIRONMENT", "production")
    monkeypatch.setattr("backend.config.settings.WHATSAPP_APP_SECRET", test_secret)

    payload = {"object": "whatsapp_business_account", "entry": []}
    body_bytes = json.dumps(payload).encode("utf-8")
    sig = generate_sig(test_secret, body_bytes)

    res = client.post(
        "/api/whatsapp/webhook",
        data=body_bytes,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# 11. Prioritisation Engine Severity Safety Check
# ---------------------------------------------------------------------------

def test_unassessed_incidents_do_not_inflate_severity_score(client, db_session):
    """
    Verifies that unassessed citizen reports contribute 0 points to the active incident
    severity factor, preventing false flood prioritization until on-site verification.
    """
    from datetime import datetime, timezone
    zone = db_session.get(Zone, "NZ-SAN-01")
    assert zone is not None
    now = datetime.now(timezone.utc)

    unassessed_inc = Incident(
        id="TEST-INC-UNASSESSED-01",
        zone_id=zone.id,
        location_name="Test Location",
        latitude=19.0664,
        longitude=73.0092,
        reported_at=now,
        category="Waterlogging Citizen Report",
        severity="unassessed",
        status="New",
        report_count=1,
    )

    result = calculate_zone_priority_and_risk(zone, [unassessed_inc], [], eval_time=now)
    sev_factor = result["factors"]["severity"]

    # Verify unassessed report yields 0 severity score
    assert sev_factor["score"] == 0.0
    assert sev_factor["unassessed_count"] == 1
    assert "unassessed citizen report(s) awaiting verification" in sev_factor["rationale"]
