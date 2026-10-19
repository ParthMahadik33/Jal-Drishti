from flask import Blueprint, jsonify
from sqlalchemy import select, func

from backend.database import get_db
from backend.models import Zone, Incident, MaintenanceAction
from backend.schemas import (
    ZoneRead,
    ZoneHistoryRead,
    IncidentRead,
    MaintenanceActionRead,
)

zones_bp = Blueprint("zones", __name__, url_prefix="/api/zones")


@zones_bp.route("", methods=["GET"])
def list_zones():
    """List all configured pilot zones with risk bands and active report counts."""
    db = get_db()
    zones = db.execute(select(Zone).order_by(Zone.id)).scalars().all()
    # Synchronize active reports count dynamically
    for z in zones:
        count = db.execute(
            select(func.count(Incident.id))
            .where(Incident.zone_id == z.id, Incident.status != "Closed")
        ).scalar() or 0
        z.active_reports_count = count

    return jsonify([ZoneRead.model_validate(z).model_dump(mode="json") for z in zones]), 200


@zones_bp.route("/<zone_id>", methods=["GET"])
def get_zone(zone_id: str):
    """Retrieve details for a single pilot zone."""
    db = get_db()
    zone = db.get(Zone, zone_id)
    if not zone:
        return jsonify({"detail": f"Zone '{zone_id}' not found."}), 404

    count = db.execute(
        select(func.count(Incident.id))
        .where(Incident.zone_id == zone.id, Incident.status != "Closed")
    ).scalar() or 0
    zone.active_reports_count = count

    return jsonify(ZoneRead.model_validate(zone).model_dump(mode="json")), 200


@zones_bp.route("/<zone_id>/history", methods=["GET"])
def get_zone_history(zone_id: str):
    """Retrieve complete chronological incident and maintenance history for a zone."""
    db = get_db()
    zone = db.get(Zone, zone_id)
    if not zone:
        return jsonify({"detail": f"Zone '{zone_id}' not found."}), 404

    incidents = db.execute(
        select(Incident)
        .where(Incident.zone_id == zone_id)
        .order_by(Incident.reported_at.desc())
    ).scalars().all()

    maintenance = db.execute(
        select(MaintenanceAction)
        .where(MaintenanceAction.zone_id == zone_id)
        .order_by(MaintenanceAction.created_at.desc())
    ).scalars().all()

    history = ZoneHistoryRead(
        zone_id=zone.id,
        zone_name=zone.name,
        incidents=[IncidentRead.model_validate(i) for i in incidents],
        maintenance=[MaintenanceActionRead.model_validate(m) for m in maintenance],
    )
    return jsonify(history.model_dump(mode="json")), 200
