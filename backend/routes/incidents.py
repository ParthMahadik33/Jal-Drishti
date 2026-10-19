from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from pydantic import ValidationError
from sqlalchemy import select, func

from backend.database import get_db
from backend.models import Zone, Incident
from backend.schemas import IncidentRead, IncidentCreate, IncidentUpdate
from backend.services.recurrence import evaluate_incident_recurrence, update_zone_recurrence_status

incidents_bp = Blueprint("incidents", __name__, url_prefix="/api/incidents")


@incidents_bp.route("", methods=["GET"])
def list_incidents():
    """List all incidents with optional filtering by zone, status, or severity."""
    db = get_db()
    zone_id = request.args.get("zone_id")
    status_filter = request.args.get("status")
    severity = request.args.get("severity")

    stmt = select(Incident).order_by(Incident.reported_at.desc())
    if zone_id:
        stmt = stmt.where(Incident.zone_id == zone_id)
    if status_filter and status_filter != "All":
        stmt = stmt.where(Incident.status == status_filter)
    if severity and severity != "All":
        stmt = stmt.where(Incident.severity == severity)

    incidents = db.execute(stmt).scalars().all()
    return jsonify([IncidentRead.model_validate(i).model_dump(mode="json") for i in incidents]), 200


@incidents_bp.route("/<incident_id>", methods=["GET"])
def get_incident(incident_id: str):
    """Retrieve details for a single incident."""
    db = get_db()
    incident = db.get(Incident, incident_id)
    if not incident:
        return jsonify({"detail": f"Incident '{incident_id}' not found."}), 404
    return jsonify(IncidentRead.model_validate(incident).model_dump(mode="json")), 200


@incidents_bp.route("", methods=["POST"])
def create_incident():
    """
    Create a new incident. Automatically evaluates the recurrence-after-action rule
    against recent maintenance in the target zone.
    """
    db = get_db()
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"detail": "Invalid or missing JSON body"}), 400

    try:
        payload = IncidentCreate.model_validate(body)
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 422

    zone = db.get(Zone, payload.zone_id)
    if not zone:
        return jsonify({
            "detail": f"Cannot create incident: Target Zone '{payload.zone_id}' does not exist."
        }), 404

    # Generate sequential incident ID
    count = db.execute(select(func.count(Incident.id))).scalar() or 0
    new_id = f"INC-2026-{count + 90:03d}"

    # Resolve location and coordinates
    location_name = payload.location_name or zone.name
    latitude = payload.latitude if payload.latitude is not None else zone.latitude
    longitude = payload.longitude if payload.longitude is not None else zone.longitude
    severity = payload.severity or payload.visual_severity or "moderate"
    status_val = payload.status or payload.review_state or "New"
    source_val = payload.report_source or payload.source or "WhatsApp Citizen Inflow"

    reported_at = datetime.now(timezone.utc)

    # Recurrence rule evaluation
    has_recurrence, recurrence_details = evaluate_incident_recurrence(
        db, zone, reported_at
    )

    incident = Incident(
        id=new_id,
        zone_id=zone.id,
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
        reported_at=reported_at,
        category=payload.category,
        severity=severity,
        status=status_val,
        report_source=source_val,
        data_status=payload.data_status or "Observed",
        report_count=payload.report_count or 1,
        image_url=payload.image_url,
        image_caption=payload.image_caption,
        reporter_summary=payload.reporter_summary,
        notes=payload.notes,
        ai_confidence=payload.ai_confidence,
        ai_uncertainty_notes=payload.ai_uncertainty_notes,
        has_recurrence_flag=has_recurrence,
        recurrence_details=recurrence_details,
    )
    db.add(incident)

    if has_recurrence:
        zone.has_recurrence_flag = True
        db.add(zone)

    db.commit()
    db.refresh(incident)
    return jsonify(IncidentRead.model_validate(incident).model_dump(mode="json")), 201


@incidents_bp.route("/<incident_id>", methods=["PATCH"])
def update_incident(incident_id: str):
    """
    Update incident review status, notes, or recurrence confirmation decision.
    """
    db = get_db()
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"detail": "Invalid or missing JSON body"}), 400

    try:
        payload = IncidentUpdate.model_validate(body)
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 422

    incident = db.get(Incident, incident_id)
    if not incident:
        return jsonify({"detail": f"Incident '{incident_id}' not found."}), 404

    new_status = payload.status or payload.review_state
    if new_status is not None:
        incident.status = new_status
    if payload.review_notes is not None:
        incident.review_notes = payload.review_notes
    if payload.has_recurrence_flag is not None:
        incident.has_recurrence_flag = payload.has_recurrence_flag
    if payload.recurrence_details is not None:
        incident.recurrence_details = payload.recurrence_details

    incident.updated_at = datetime.now(timezone.utc)
    db.add(incident)
    db.commit()

    # Re-evaluate zone recurrence flag
    update_zone_recurrence_status(db, incident.zone_id)
    db.commit()
    db.refresh(incident)
    return jsonify(IncidentRead.model_validate(incident).model_dump(mode="json")), 200
