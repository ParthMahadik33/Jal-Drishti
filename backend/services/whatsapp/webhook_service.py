"""
WhatsApp Webhook Ingestion & Citizen Reporting Service for JalDrishti.

Handles:
1. Meta HMAC-SHA256 signature verification (X-Hub-Signature-256).
2. Privacy redaction for phone numbers.
3. Payload normalization for text, image, and location pin messages.
4. Idempotent deduplication using provider message ID (wamid).
5. Safe triage incident creation integrating with recurrence detection.
"""

from datetime import datetime, timezone
import hashlib
import hmac
import logging
import math
import re
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from backend.config import settings
from backend.models import (
    Zone,
    Incident,
    WhatsAppInboundMessage,
    utc_now,
)
from backend.services.recurrence import evaluate_incident_recurrence

logger = logging.getLogger("jaldrishti.whatsapp.webhook")


def verify_whatsapp_signature(
    payload_bytes: bytes,
    signature_header: Optional[str],
    app_secret: str,
) -> bool:
    """
    Verifies that the incoming request originates from Meta using HMAC-SHA256.
    Header format: 'sha256=<hex_digest>'
    Fails closed: returns False if app_secret or signature_header is missing.
    """
    if not app_secret:
        return False

    if not signature_header:
        return False

    if not signature_header.startswith("sha256="):
        return False

    expected_sig = signature_header[7:].strip()
    computed_sig = hmac.new(
        app_secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_sig, computed_sig)


def sanitize_payload_for_storage(data: Any) -> Any:
    """
    Recursively strips or masks phone numbers and PII from webhook payloads before persistence.
    Replaces raw phone number strings with masked equivalents ('+91 XX*** ***XX').
    Preserves provider IDs ('id'/'wamid'), timestamps, message types, and report text.
    """
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if k in ("from", "wa_id", "recipient_id", "phone_number") and isinstance(v, str):
                sanitized[k] = mask_phone_number(v)
            else:
                sanitized[k] = sanitize_payload_for_storage(v)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_payload_for_storage(item) for item in data]
    return data


def mask_phone_number(phone_str: Optional[str]) -> str:
    """
    Redacts phone numbers to prevent storing or exposing raw personal phone data.
    Example: '919876543210' -> '+91 98*** ***10'
             '9876543210'   -> '+91 98*** ***10'
    """
    if not phone_str:
        return "Citizen"

    clean = re.sub(r"[^\d]", "", str(phone_str))
    if len(clean) < 6:
        return "+91 ***"

    # Normalize to include country code if 10 digits
    if len(clean) == 10:
        clean = "91" + clean

    # Format with country code, first 2, asterisks, last 2
    prefix = clean[:4]
    suffix = clean[-2:]
    return f"+{prefix[:2]} {prefix[2:]}*** ***{suffix}"


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS points in kilometers."""
    r = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def find_matching_or_closest_zone(
    db: Session,
    text: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
) -> Zone:
    """
    Resolves an incoming citizen message to the most appropriate operational Zone.
    1. If GPS coordinates are provided, selects the geometrically closest zone.
    2. If text contains landmark keywords, matches the corresponding zone.
    3. Fallback: returns the primary pilot zone (NZ-SAN-01).
    """
    zones = db.execute(select(Zone)).scalars().all()
    if not zones:
        raise ValueError("No operational zones found in database.")

    # 1. Geometrical match if coordinates provided
    if lat is not None and lon is not None:
        closest = min(
            zones,
            key=lambda z: haversine_distance_km(lat, lon, z.latitude, z.longitude),
        )
        return closest

    # 2. Textual landmark matching
    if text:
        lower_text = text.lower()
        # Landmark dictionary mapping keywords to zone codes
        keywords_map = [
            (["sanpada underpass", "railway underpass", "sector 4 underpass", "sanpada east"], "NZ-SAN-01"),
            (["sector 19a", "nerul market", "sector 19 market", "nerul sector 19"], "NZ-NER-02"),
            (["midc", "industrial corridor", "road 2", "nerul midc"], "NZ-NER-03"),
            (["palm beach", "sanpada junction", "palm beach road"], "NZ-SAN-04"),
            (["sector 42", "nallah buffer", "flap gate", "creek buffer"], "NZ-NER-05"),
            (["sanpada"], "NZ-SAN-01"),
            (["nerul"], "NZ-NER-02"),
        ]

        for keywords, zcode in keywords_map:
            if any(k in lower_text for k in keywords):
                target = next((z for z in zones if z.id == zcode or z.code == zcode), None)
                if target:
                    return target

    # 3. Default fallback zone
    default_zone = next((z for z in zones if z.id == "NZ-SAN-01"), zones[0])
    return default_zone


def generate_next_incident_id(db: Session) -> str:
    """Generates a sequential collision-free incident ID."""
    incidents = db.execute(select(Incident.id)).scalars().all()
    max_num = 89
    for i_id in incidents:
        match = re.search(r"INC-\d{4}-(\d+)", i_id)
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num

    candidate_num = max_num + 1
    new_id = f"INC-2026-{candidate_num:03d}"
    while db.get(Incident, new_id):
        candidate_num += 1
        new_id = f"INC-2026-{candidate_num:03d}"

    return new_id


def process_whatsapp_webhook(
    db: Session,
    payload: Dict[str, Any],
    raw_body_bytes: Optional[bytes] = None,
) -> Dict[str, Any]:
    """
    Parses a Meta WhatsApp webhook payload, handles idempotency,
    and creates citizen triage incidents for actionable messages.
    """
    if not isinstance(payload, dict):
        return {
            "status": "error",
            "message": "Payload must be a JSON object",
            "processed_count": 0,
            "duplicate_count": 0,
            "ignored_count": 0,
            "incident_ids": [],
        }

    entries = payload.get("entry", [])
    if not entries or not isinstance(entries, list):
        return {
            "status": "ok",
            "message": "No entries in webhook payload",
            "processed_count": 0,
            "duplicate_count": 0,
            "ignored_count": 0,
            "incident_ids": [],
        }

    processed_count = 0
    duplicate_count = 0
    ignored_count = 0
    incident_ids = []

    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            if not isinstance(value, dict):
                continue

            # 1. Ignore delivery/read receipts (statuses) safely without creating incidents
            if "statuses" in value and "messages" not in value:
                ignored_count += len(value.get("statuses", []))
                continue

            messages = value.get("messages", [])
            contacts = value.get("contacts", [])
            profile_name = None
            if contacts and isinstance(contacts, list) and len(contacts) > 0:
                profile_name = contacts[0].get("profile", {}).get("name")

            phone_number_id = value.get("metadata", {}).get("phone_number_id")

            for msg in messages:
                msg_id = msg.get("id")
                from_phone = msg.get("from")
                msg_type = msg.get("type", "unknown")
                timestamp_epoch = msg.get("timestamp")

                if not msg_id:
                    ignored_count += 1
                    continue

                # 2. Check Idempotency: Has this message already been processed?
                existing_record = db.get(WhatsAppInboundMessage, msg_id)
                if existing_record:
                    logger.info(f"Duplicate WhatsApp delivery for message {msg_id}. Skipping.")
                    duplicate_count += 1
                    continue

                # Mask phone number for citizen privacy
                masked_phone = mask_phone_number(from_phone)
                reporter_summary = (
                    f"Citizen {profile_name} via WhatsApp ({masked_phone} - redacted)"
                    if profile_name
                    else f"Citizen via WhatsApp ({masked_phone} - redacted)"
                )

                now = utc_now()
                reported_at = now
                if timestamp_epoch:
                    try:
                        reported_at = datetime.fromtimestamp(int(timestamp_epoch), tz=timezone.utc)
                    except Exception:
                        reported_at = now

                # Sanitize raw payload before database persistence to prevent retaining personal phone data
                sanitized_msg = sanitize_payload_for_storage(msg)

                # 3. Handle by Message Type
                if msg_type == "text":
                    text_body = msg.get("text", {}).get("body", "").strip()
                    matched_zone = find_matching_or_closest_zone(db, text=text_body)

                    # Assess recurrence post-maintenance
                    has_rec, rec_details = evaluate_incident_recurrence(db, matched_zone, reported_at)

                    new_inc_id = generate_next_incident_id(db)
                    incident = Incident(
                        id=new_inc_id,
                        zone_id=matched_zone.id,
                        location_name=matched_zone.name,
                        latitude=matched_zone.latitude,
                        longitude=matched_zone.longitude,
                        reported_at=reported_at,
                        category="Waterlogging Citizen Report",
                        severity="unassessed",
                        status="New",
                        report_source="WhatsApp Citizen Inflow",
                        data_status="Inferred",
                        report_count=1,
                        reporter_summary=reporter_summary,
                        notes=text_body,
                        ai_confidence=None,
                        ai_uncertainty_notes="Citizen claim submitted via WhatsApp text. Approximate zone assigned from landmark context; flood severity unassessed and unverified on-site.",
                        has_recurrence_flag=has_rec,
                        recurrence_details=rec_details,
                        raw_message_id=msg_id,
                    )
                    db.add(incident)

                    inbound_msg = WhatsAppInboundMessage(
                        id=msg_id,
                        wa_id=masked_phone,
                        sender_name=profile_name,
                        phone_number_id=phone_number_id,
                        message_type="text",
                        raw_payload=sanitized_msg,
                        text_body=text_body,
                        timestamp_provider=str(timestamp_epoch),
                        status="Processed",
                        incident_id=new_inc_id,
                    )
                    db.add(inbound_msg)

                    if has_rec:
                        matched_zone.has_recurrence_flag = True
                        db.add(matched_zone)

                    incident_ids.append(new_inc_id)
                    processed_count += 1

                elif msg_type == "location":
                    loc = msg.get("location", {})
                    lat = float(loc.get("latitude", 0.0))
                    lon = float(loc.get("longitude", 0.0))
                    loc_name = loc.get("name") or loc.get("address") or f"Citizen Pin ({lat:.4f}, {lon:.4f})"

                    matched_zone = find_matching_or_closest_zone(db, lat=lat, lon=lon)
                    has_rec, rec_details = evaluate_incident_recurrence(db, matched_zone, reported_at)

                    new_inc_id = generate_next_incident_id(db)
                    incident = Incident(
                        id=new_inc_id,
                        zone_id=matched_zone.id,
                        location_name=loc_name,
                        latitude=lat,
                        longitude=lon,
                        reported_at=reported_at,
                        category="Geotagged Citizen Report",
                        severity="unassessed",
                        status="New",
                        report_source="WhatsApp Citizen Inflow",
                        data_status="Inferred",
                        report_count=1,
                        reporter_summary=reporter_summary,
                        notes=f"Citizen shared live GPS pin at {loc_name}. Address: {loc.get('address', 'N/A')}",
                        ai_confidence=None,
                        ai_uncertainty_notes="Exact GPS pin shared by citizen. Flood condition and depth unassessed; awaiting municipal field verification.",
                        has_recurrence_flag=has_rec,
                        recurrence_details=rec_details,
                        raw_message_id=msg_id,
                    )
                    db.add(incident)

                    inbound_msg = WhatsAppInboundMessage(
                        id=msg_id,
                        wa_id=masked_phone,
                        sender_name=profile_name,
                        phone_number_id=phone_number_id,
                        message_type="location",
                        raw_payload=sanitized_msg,
                        latitude=lat,
                        longitude=lon,
                        location_name=loc_name,
                        location_address=loc.get("address"),
                        timestamp_provider=str(timestamp_epoch),
                        status="Processed",
                        incident_id=new_inc_id,
                    )
                    db.add(inbound_msg)

                    if has_rec:
                        matched_zone.has_recurrence_flag = True
                        db.add(matched_zone)

                    incident_ids.append(new_inc_id)
                    processed_count += 1

                elif msg_type == "image":
                    img = msg.get("image", {})
                    media_id = img.get("id")
                    caption = img.get("caption", "").strip()
                    mime_type = img.get("mime_type", "image/jpeg")

                    matched_zone = find_matching_or_closest_zone(db, text=caption)
                    has_rec, rec_details = evaluate_incident_recurrence(db, matched_zone, reported_at)

                    new_inc_id = generate_next_incident_id(db)
                    incident = Incident(
                        id=new_inc_id,
                        zone_id=matched_zone.id,
                        location_name=matched_zone.name,
                        latitude=matched_zone.latitude,
                        longitude=matched_zone.longitude,
                        reported_at=reported_at,
                        category="Citizen Photo Report",
                        severity="unassessed",
                        status="Needs Review",
                        report_source="WhatsApp Citizen Inflow",
                        data_status="Inferred",
                        report_count=1,
                        image_caption=caption if caption else "Citizen photo via WhatsApp",
                        image_url=f"/api/whatsapp/media/{media_id}" if media_id else None,
                        reporter_summary=reporter_summary,
                        notes=caption if caption else "Photo report submitted via WhatsApp.",
                        ai_confidence=None,
                        ai_uncertainty_notes=f"Citizen photo submission via WhatsApp (Media ID: {media_id}). Flood severity unassessed; automated vision depth classification pending media processing.",
                        has_recurrence_flag=has_rec,
                        recurrence_details=rec_details,
                        raw_message_id=msg_id,
                    )
                    db.add(incident)

                    inbound_msg = WhatsAppInboundMessage(
                        id=msg_id,
                        wa_id=masked_phone,
                        sender_name=profile_name,
                        phone_number_id=phone_number_id,
                        message_type="image",
                        raw_payload=sanitized_msg,
                        media_id=media_id,
                        media_mime_type=mime_type,
                        media_caption=caption,
                        timestamp_provider=str(timestamp_epoch),
                        status="Processed",
                        incident_id=new_inc_id,
                    )
                    db.add(inbound_msg)

                    if has_rec:
                        matched_zone.has_recurrence_flag = True
                        db.add(matched_zone)

                    incident_ids.append(new_inc_id)
                    processed_count += 1

                else:
                    # Unsupported message type (audio, video, sticker, etc.)
                    logger.info(f"Ignoring unsupported WhatsApp message type: {msg_type}")
                    inbound_msg = WhatsAppInboundMessage(
                        id=msg_id,
                        wa_id=masked_phone,
                        sender_name=profile_name,
                        phone_number_id=phone_number_id,
                        message_type=msg_type,
                        raw_payload=sanitized_msg,
                        timestamp_provider=str(timestamp_epoch),
                        status="Ignored",
                        incident_id=None,
                    )
                    db.add(inbound_msg)
                    ignored_count += 1

    db.commit()

    return {
        "status": "ok",
        "processed_count": processed_count,
        "duplicate_count": duplicate_count,
        "ignored_count": ignored_count,
        "incident_ids": incident_ids,
        "message": f"Processed {processed_count} message(s), skipped {duplicate_count} duplicate(s), ignored {ignored_count}.",
    }
