"""
WhatsApp Integration Routes for JalDrishti.

Endpoints:
1. GET  /api/whatsapp/webhook   - Meta Webhook Verification Handshake (Fail-closed in production)
2. POST /api/whatsapp/webhook   - Inbound WhatsApp Event Webhook (HMAC-SHA256 verified, Fail-closed in prod)
3. GET  /api/whatsapp/messages  - Operator Inbound Message Audit Feed (Protected by require_operator_auth)
4. GET  /api/whatsapp/media/<media_id> - Media Download & Reference Boundary (Protected by require_operator_auth)
"""

from functools import wraps
import hmac
import logging
from flask import Blueprint, request, jsonify, Response, abort
from sqlalchemy import select

from backend.config import settings
from backend.database import get_db
from backend.models import WhatsAppInboundMessage
from backend.schemas import WhatsAppInboundRead, WhatsAppWebhookResponse
from backend.services.whatsapp.webhook_service import (
    verify_whatsapp_signature,
    process_whatsapp_webhook,
)
from backend.services.whatsapp.media_service import get_whatsapp_media_url

logger = logging.getLogger("jaldrishti.whatsapp.routes")

whatsapp_bp = Blueprint("whatsapp", __name__, url_prefix="/api/whatsapp")


def require_operator_auth(f):
    """
    Access-control decorator protecting internal operator audit feeds and media references.
    In production: strictly fails closed (401) if OPERATOR_API_KEY is not configured or token is invalid.
    In development/testing: enforces key check when OPERATOR_API_KEY is configured.
    Supports either 'X-API-Key: <key>' or 'Authorization: Bearer <key>' headers.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        expected_key = settings.OPERATOR_API_KEY
        is_production = settings.ENVIRONMENT == "production"

        if is_production and not expected_key:
            logger.error("Operator endpoint accessed in production without OPERATOR_API_KEY configured.")
            abort(401, description="Operator authentication is required in production. OPERATOR_API_KEY is not configured.")

        if expected_key:
            auth_header = request.headers.get("Authorization")
            api_key_header = request.headers.get("X-API-Key")

            provided_key = None
            if api_key_header:
                provided_key = api_key_header.strip()
            elif auth_header and auth_header.startswith("Bearer "):
                provided_key = auth_header[7:].strip()

            if not provided_key or not hmac.compare_digest(provided_key, expected_key):
                logger.warning("Unauthorized operator access attempt to WhatsApp internal records.")
                abort(401, description="Unauthorized: invalid or missing operator API key.")

        return f(*args, **kwargs)
    return decorated_function


@whatsapp_bp.route("/webhook", methods=["GET"])
def verify_webhook():
    """
    Meta Webhook Verification Handshake.
    Expected query parameters:
      hub.mode=subscribe
      hub.challenge=...
      hub.verify_token=...
    """
    mode = request.args.get("hub.mode")
    verify_token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if not mode or not challenge:
        abort(400, description="Missing required verification parameters: hub.mode and hub.challenge.")

    expected_token = settings.WHATSAPP_VERIFY_TOKEN
    is_production = settings.ENVIRONMENT == "production"

    if is_production and (not expected_token or expected_token.startswith("your_")):
        logger.error(
            "Production configuration error: WHATSAPP_VERIFY_TOKEN is missing or a placeholder. Failing closed."
        )
        abort(500, description="Server misconfigured: WHATSAPP_VERIFY_TOKEN must be configured in production.")

    if not expected_token:
        logger.warning(
            "WHATSAPP_VERIFY_TOKEN is not configured in settings. Rejecting verification."
        )
        abort(403, description="Verification token is not configured on server.")

    if mode == "subscribe" and verify_token == expected_token:
        logger.info("Meta webhook verification challenge passed successfully.")
        return Response(challenge, status=200, mimetype="text/plain")
    else:
        logger.warning(
            f"Meta webhook verification failed: mode={mode}, verify_token mismatch."
        )
        abort(403, description="Verification token mismatch or invalid mode.")


@whatsapp_bp.route("/webhook", methods=["POST"])
def receive_webhook():
    """
    Inbound Meta WhatsApp event handler.
    Validates HMAC-SHA256 signature (fail-closed in production),
    deduplicates messages by provider ID (wamid),
    sanitizes raw payload to prevent PII persistence,
    and converts text, location pins, and photos into unassessed citizen triage reports.
    """
    raw_body = request.get_data()
    sig_header = request.headers.get("X-Hub-Signature-256")
    is_production = settings.ENVIRONMENT == "production"
    app_secret = settings.WHATSAPP_APP_SECRET

    # 1. Signature Verification with Production Fail-Closed Safety
    if is_production:
        if not app_secret or app_secret.startswith("your_"):
            logger.error(
                "Production configuration error: WHATSAPP_APP_SECRET is not configured or is a placeholder. "
                "Failing closed to prevent unverified webhook ingestion."
            )
            abort(500, description="Server misconfigured: WHATSAPP_APP_SECRET must be configured in production.")

        if not verify_whatsapp_signature(raw_body, sig_header, app_secret):
            logger.warning("Rejected WhatsApp webhook in production: invalid HMAC-SHA256 signature.")
            abort(403, description="Invalid webhook signature (X-Hub-Signature-256).")
    else:
        # Development / Testing mode: verify signature if a real or mock secret is configured
        if app_secret and not app_secret.startswith("your_"):
            if not verify_whatsapp_signature(raw_body, sig_header, app_secret):
                logger.warning("Rejected WhatsApp webhook: invalid HMAC-SHA256 signature.")
                abort(403, description="Invalid webhook signature (X-Hub-Signature-256).")

    # 2. JSON Validation
    payload = request.get_json(silent=True)
    if payload is None:
        logger.warning("Received invalid or non-JSON webhook payload.")
        abort(400, description="Invalid or missing JSON payload.")

    db = get_db()

    # 3. Process Payload Idempotently with Data Protection
    try:
        result = process_whatsapp_webhook(db, payload, raw_body_bytes=raw_body)
        resp_obj = WhatsAppWebhookResponse(
            status=result.get("status", "ok"),
            processed_count=result.get("processed_count", 0),
            duplicate_count=result.get("duplicate_count", 0),
            ignored_count=result.get("ignored_count", 0),
            incident_ids=result.get("incident_ids", []),
            message=result.get("message"),
        )
        return jsonify(resp_obj.model_dump(mode="json")), 200

    except Exception as exc:
        logger.exception(f"Unhandled error processing WhatsApp webhook: {exc}")
        abort(500, description=f"Internal webhook processing error: {str(exc)}")


@whatsapp_bp.route("/messages", methods=["GET"])
@require_operator_auth
def list_inbound_messages():
    """
    Operator inspection endpoint for inbound WhatsApp messages and provenance records.
    Requires operator authentication.
    """
    db = get_db()
    limit = request.args.get("limit", default=50, type=int)
    stmt = (
        select(WhatsAppInboundMessage)
        .order_by(WhatsAppInboundMessage.created_at.desc())
        .limit(min(limit, 100))
    )
    records = db.execute(stmt).scalars().all()
    serialized = [WhatsAppInboundRead.model_validate(r).model_dump(mode="json") for r in records]
    return jsonify(serialized), 200


@whatsapp_bp.route("/media/<media_id>", methods=["GET"])
@require_operator_auth
def get_media_info(media_id: str):
    """
    Retrieves temporary download URL / descriptor for a WhatsApp media item.
    Requires operator authentication.
    """
    info = get_whatsapp_media_url(media_id)
    return jsonify(info), 200
