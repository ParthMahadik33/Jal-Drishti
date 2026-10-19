from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select
from backend.models import Incident
from backend.schemas import QueueItemRead, format_relative_time
from backend.services.prioritisation import evaluate_all_pilot_zones


def compute_action_queue(db: Session) -> List[QueueItemRead]:
    """
    Computes an explainable, deterministic triage queue across all active pilot zones
    using the v3 prioritisation engine.
    """
    evaluations = evaluate_all_pilot_zones(db)
    queue_results = []

    for rank, item in enumerate(evaluations, start=1):
        zone_id = item["zone_id"]

        # Fetch latest incident for issue type and latest report time
        latest_inc = db.execute(
            select(Incident)
            .where(Incident.zone_id == zone_id)
            .order_by(Incident.reported_at.desc())
        ).scalars().first()

        latest_time = format_relative_time(latest_inc.reported_at) if latest_inc else "No recent reports"
        
        issue_type = latest_inc.category if latest_inc else f"{item['zone_name']} Baseline Watch"
        if item["has_recurrence"] and "Recurring" not in issue_type:
            issue_type = f"Recurring {issue_type}"

        # Status determination based on incident review state
        if item["has_recurrence"]:
            status = "Needs Review"
        elif item["priority_band"] in ("Urgent", "High"):
            status = "New" if (latest_inc and latest_inc.status == "New") else "In Progress"
        elif item["priority_band"] == "Moderate":
            status = "Needs Review"
        else:
            status = "Closed" if item["active_incidents_count"] == 0 else "Needs Review"

        corroboration_summary = (
            f"{item['total_reports_count']} citizen photos + corroboration confirmed"
            if item["total_reports_count"] > 1
            else (
                "1 citizen report on file"
                if item["total_reports_count"] == 1
                else "Routine municipal patrol log"
            )
        )

        queue_results.append(
            QueueItemRead(
                rank=rank,
                hotspot_id=f"HS-0{rank}",
                zone_id=zone_id,
                location_name=item["zone_name"],
                risk_band=item["risk_band"],
                issue_type=issue_type,
                report_count=item["total_reports_count"],
                corroboration_summary=corroboration_summary,
                latest_report_time=latest_time,
                suggested_action=item["suggested_action"],
                status=status,
                ranking_reasons=item["ranking_reasons"],
                has_recurrence=item["has_recurrence"],
                priority_score=item["priority_score"],
                priority_band=item["priority_band"],
                action_rationale=item["action_rationale"],
                factors=item["factors"],
                regional_weather=item.get("regional_weather"),
                missing_inputs=item["missing_inputs"],
                provenance=item["provenance"],
            )
        )

    return queue_results
