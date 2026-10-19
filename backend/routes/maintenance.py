from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from pydantic import ValidationError
from sqlalchemy import select, func

from backend.database import get_db
from backend.models import Zone, Incident, MaintenanceAction
from backend.schemas import MaintenanceActionRead, MaintenanceActionCreate

maintenance_bp = Blueprint("maintenance", __name__, url_prefix="/api/maintenance")


@maintenance_bp.route("", methods=["GET"])
def list_maintenance_actions():
    """List all recorded municipal maintenance actions."""
    db = get_db()
    zone_id = request.args.get("zone_id")
    stmt = select(MaintenanceAction).order_by(MaintenanceAction.created_at.desc())
    if zone_id:
        stmt = stmt.where(MaintenanceAction.zone_id == zone_id)
    actions = db.execute(stmt).scalars().all()
    return jsonify([MaintenanceActionRead.model_validate(m).model_dump(mode="json") for m in actions]), 200


@maintenance_bp.route("", methods=["POST"])
def create_maintenance_action():
    """
    Record a new municipal maintenance action (desilting, culvert clearing, inspection, etc.).
    """
    db = get_db()
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"detail": "Invalid or missing JSON body"}), 400

    try:
        payload = MaintenanceActionCreate.model_validate(body)
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 422

    zone = db.get(Zone, payload.zone_id)
    if not zone:
        return jsonify({
            "detail": f"Cannot record action: Target Zone '{payload.zone_id}' does not exist."
        }), 404

    if payload.incident_id:
        incident = db.get(Incident, payload.incident_id)
        if not incident:
            return jsonify({
                "detail": f"Referenced incident '{payload.incident_id}' does not exist."
            }), 404

    count = db.execute(select(func.count(MaintenanceAction.id))).scalar() or 0
    new_id = f"MNT-2026-{count + 45:03d}"

    location_name = payload.location_name or zone.name
    supervisor = payload.supervisor or payload.actor or "Officer P. Deshmukh (Zone 4 NMMC)"
    work_notes = payload.work_notes or payload.notes or "Routine municipal maintenance completed."
    completed_time = datetime.now(timezone.utc)

    action = MaintenanceAction(
        id=new_id,
        zone_id=zone.id,
        incident_id=payload.incident_id,
        location_name=location_name,
        action_type=payload.action_type,
        supervisor=supervisor,
        status=payload.status or "Completed & Verified",
        work_notes=work_notes,
        verification_status=payload.verification_status if payload.verification_status is not None else True,
        data_status=payload.data_status or "Observed",
        cost_estimate=payload.cost_estimate,
        completed_at=completed_time,
        created_at=completed_time,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return jsonify(MaintenanceActionRead.model_validate(action).model_dump(mode="json")), 201
