from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select
from backend.models import Zone, Incident, MaintenanceAction
from backend.config import settings


def evaluate_incident_recurrence(
    db: Session,
    zone: Zone,
    incident_time: datetime,
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Evaluates whether an incident at incident_time in the given zone occurs
    within the configured post-maintenance window.
    
    Returns (has_recurrence_flag, recurrence_details_dict).
    """
    # Find latest completed or verified maintenance action in this zone
    stmt = (
        select(MaintenanceAction)
        .where(MaintenanceAction.zone_id == zone.id)
        .order_by(MaintenanceAction.created_at.desc())
    )
    latest_action = db.execute(stmt).scalars().first()
    if not latest_action:
        return False, None

    action_time = latest_action.completed_at or latest_action.created_at
    if action_time.tzinfo is None:
        action_time = action_time.replace(tzinfo=timezone.utc)
    if incident_time.tzinfo is None:
        incident_time = incident_time.replace(tzinfo=timezone.utc)

    # Time delta
    delta = incident_time - action_time
    hours_elapsed = delta.total_seconds() / 3600.0

    # If within configured window (e.g. 72h) and incident happened after or around maintenance
    if 0 <= hours_elapsed <= settings.RECURRENCE_WINDOW_HOURS:
        hours_str = f"{int(hours_elapsed)} hours post-maintenance" if hours_elapsed >= 1 else "Within 1 hour post-maintenance"
        date_str = latest_action.created_at.strftime("%b %d, %Y")

        rule_explanation = (
            f"Incident reported in {zone.name} within {settings.RECURRENCE_WINDOW_HOURS}h of recorded "
            f"maintenance completion ({latest_action.action_type}). Suggests structural throat constraint or "
            f"downstream creek backwater rather than simple surface trash grate blockage."
        )

        recurrence_details = {
            "prior_action_id": latest_action.id,
            "prior_action_title": latest_action.action_type,
            "prior_action_date": date_str,
            "time_elapsed": hours_str,
            "rule_explanation": rule_explanation,
            "status": "flagged",
        }
        return True, recurrence_details

    return False, None


def update_zone_recurrence_status(db: Session, zone_id: str) -> None:
    """Updates the zone's has_recurrence_flag based on active flagged incidents."""
    stmt = (
        select(Incident)
        .where(Incident.zone_id == zone_id, Incident.has_recurrence_flag == True)
    )
    flagged = db.execute(stmt).scalars().first()
    
    zone = db.get(Zone, zone_id)
    if zone:
        zone.has_recurrence_flag = flagged is not None
        db.add(zone)
