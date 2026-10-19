"""
JalDrishti Prioritisation and Resource Allocation Engine (v3.0.0)

Deterministic, explainable rule-based scoring and decision-support service.
Differentiates between:
1. Environmental Risk (0-100): Inherent topographical susceptibility, drainage constraints, and rainfall exposure.
2. Operational Priority (0-100): Urgent need for human review or intervention based on active report severity,
   recurrence-after-maintenance, citizen corroboration, and data freshness.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select
from backend.config import settings
from backend.models import Zone, Incident, MaintenanceAction

ENGINE_VERSION = "v5.0.0-weather-aware"

# Prototype Weather Urgency Thresholds (Configurable via backend.config.settings)
# Requires calibration against ground-truth municipal gauge observations.
WEATHER_VOLUME_12H_CRITICAL = settings.WEATHER_12H_VOLUME_CRITICAL_MM  # 50.0 mm
WEATHER_VOLUME_12H_ELEVATED = settings.WEATHER_12H_VOLUME_ELEVATED_MM  # 25.0 mm
WEATHER_VOLUME_12H_MODERATE = settings.WEATHER_12H_VOLUME_MODERATE_MM  # 10.0 mm

WEATHER_INTENSITY_CRITICAL = settings.WEATHER_HOURLY_INTENSITY_CRITICAL_MM  # 30.0 mm/hr
WEATHER_INTENSITY_ELEVATED = settings.WEATHER_HOURLY_INTENSITY_ELEVATED_MM  # 15.0 mm/hr
WEATHER_INTENSITY_MODERATE = settings.WEATHER_HOURLY_INTENSITY_MODERATE_MM  # 5.0 mm/hr

# Standard operational action cost (INR) and staff-hour defaults
DEFAULT_ACTION_SPECS: Dict[str, Dict[str, Any]] = {
    "Clean / Desilt": {
        "estimated_cost": 15000.0,
        "staff_hours": 24.0,
        "description": "Desilt intake sumps and grates using jetting & mechanical scoop.",
    },
    "Culvert Clearing": {
        "estimated_cost": 12000.0,
        "staff_hours": 20.0,
        "description": "Clear sediment and structural obstruction from box/pipe culverts.",
    },
    "Inspect": {
        "estimated_cost": 4000.0,
        "staff_hours": 8.0,
        "description": "On-site visual and photographic inspection by junior engineer.",
    },
    "Pump Deployment": {
        "estimated_cost": 25000.0,
        "staff_hours": 36.0,
        "description": "Mobilize high-capacity dewatering diesel pump with suction hose.",
    },
    "Engineering Assessment": {
        "estimated_cost": 30000.0,
        "staff_hours": 40.0,
        "description": "Comprehensive topographical & invert level survey for recurring bottlenecks.",
    },
    "Escalate for Engineering Assessment": {
        "estimated_cost": 30000.0,
        "staff_hours": 40.0,
        "description": "Comprehensive topographical & invert level survey for recurring bottlenecks.",
    },
    "Monitor": {
        "estimated_cost": 2000.0,
        "staff_hours": 4.0,
        "description": "Routine surveillance during high-tide or convective rain spell.",
    },
}


def _get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def assess_regional_weather_urgency(
    weather_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Assesses regional atmospheric weather urgency across the Navi Mumbai pilot cluster.
    
    Treats weather as a shared regional signal (~0.1° / ~11 km NWP grid cell)
    encompassing all pilot zones uniformly without fabricating artificial street-level variation.
    
    Distinguishes:
    - Observed vs. Forecast precipitation.
    - Weather data status: Current, Stale, Forecast-Derived, Simulated, or Unavailable.
    
    Returns an explainable RegionalWeatherUrgency dictionary.
    """
    if not weather_snapshot:
        return {
            "urgency_band": "Unavailable",
            "urgency_score": None,
            "recent_6h_volume_mm": None,
            "forecast_6h_volume_mm": None,
            "current_intensity_mm_hr": None,
            "peak_forecast_intensity_mm_hr": None,
            "weather_status": "Unavailable",
            "weather_source": "Open-Meteo Best Match",
            "weather_timestamp": None,
            "retrieval_timestamp": None,
            "urgency_rationale": "Weather observation telemetry is unavailable and no valid cache exists; atmospheric urgency is unassessed. Municipal officers must not assume dry conditions or zero risk; physical terrain and drainage susceptibility remain active without weather adjustment.",
            "is_shared_regional_signal": True,
            "cluster_scope_note": "Regional ~0.1° (~11 km) grid encompasses the pilot cluster uniformly.",
            "confidence": "None",
            "confidence_limitations": [
                "Weather telemetry feed is unreachable and no valid SQLite cache exists.",
                "Atmospheric urgency is marked Unavailable; officers must not assume dry weather or zero risk.",
                "Susceptibility evaluation relies entirely on static terrain and physical drainage factors.",
            ],
        }

    is_simulated = bool(weather_snapshot.get("is_simulated", False))
    is_stale = bool(weather_snapshot.get("is_stale", False))
    weather_source = weather_snapshot.get("provider_model") or "Open-Meteo Best Match"
    provider_ts = weather_snapshot.get("provider_timestamp")
    retrieval_ts = weather_snapshot.get("retrieved_at")

    # Extract past records (last 6 hours)
    past_records = weather_snapshot.get("past_records") or []
    recent_6h_records = past_records[-6:] if len(past_records) >= 6 else past_records
    if recent_6h_records:
        recent_6h_volume = round(sum(float(r.get("precipitation_mm", 0.0) or 0.0) for r in recent_6h_records), 1)
    else:
        recent_6h_volume = round(float(weather_snapshot.get("total_past_rainfall_mm", 0.0) or 0.0), 1)

    # Extract forecast records (next 6 hours)
    forecast_records = weather_snapshot.get("forecast_records") or []
    forecast_6h_records = forecast_records[:6]
    forecast_6h_volume = round(sum(float(r.get("precipitation_mm", 0.0) or 0.0) for r in forecast_6h_records), 1)

    current_intensity = round(float(weather_snapshot.get("current_intensity_mm_hr") or weather_snapshot.get("current_precipitation_mm") or 0.0), 1)
    
    if forecast_6h_records:
        peak_forecast_intensity = round(max(float(r.get("precipitation_mm", 0.0) or 0.0) for r in forecast_6h_records), 1)
    else:
        peak_forecast_intensity = current_intensity

    # Determine status
    if is_simulated:
        weather_status = "Simulated"
    elif is_stale:
        weather_status = "Stale"
    elif recent_6h_volume == 0.0 and forecast_6h_volume > 0.0:
        weather_status = "Forecast-Derived"
    else:
        weather_status = "Current"

    combined_12h_volume = round(recent_6h_volume + forecast_6h_volume, 1)
    peak_intensity = max(current_intensity, peak_forecast_intensity)

    # Urgency scoring (0-100)
    # Prototype formula: 50% volume component + 50% intensity component
    vol_component = min(50.0, (combined_12h_volume / WEATHER_VOLUME_12H_CRITICAL) * 50.0)
    int_component = min(50.0, (peak_intensity / WEATHER_INTENSITY_CRITICAL) * 50.0)
    urgency_score = int(round(min(100.0, max(0.0, vol_component + int_component))))

    # Urgency band
    if (
        urgency_score >= 70
        or combined_12h_volume >= WEATHER_VOLUME_12H_CRITICAL
        or peak_intensity >= WEATHER_INTENSITY_CRITICAL
    ):
        urgency_band = "Critical"
    elif (
        urgency_score >= 45
        or combined_12h_volume >= WEATHER_VOLUME_12H_ELEVATED
        or peak_intensity >= WEATHER_INTENSITY_ELEVATED
    ):
        urgency_band = "Elevated"
    elif (
        urgency_score >= 20
        or combined_12h_volume >= WEATHER_VOLUME_12H_MODERATE
        or peak_intensity >= WEATHER_INTENSITY_MODERATE
    ):
        urgency_band = "Moderate"
    else:
        urgency_band = "Low"

    # Explanatory rationale suitable for municipal officers
    rationale_parts = []
    if current_intensity > 0:
        rationale_parts.append(f"Current regional rain intensity is {current_intensity} mm/hr.")
    else:
        rationale_parts.append("Currently dry at model timestamp.")

    if recent_6h_volume > 0:
        rationale_parts.append(f"Recorded past 6h accumulation: {recent_6h_volume} mm.")
    if forecast_6h_volume > 0:
        rationale_parts.append(f"Numerical model projects {forecast_6h_volume} mm over next 6h (peak {peak_forecast_intensity} mm/hr).")
    else:
        rationale_parts.append("No significant precipitation forecast in the next 6-hour model window.")

    rationale_parts.append(f"Regional urgency is evaluated as {urgency_band} across the 5-zone pilot cluster.")
    urgency_rationale = " ".join(rationale_parts)

    limitations = [
        f"{weather_source} operates on ~0.1° (~11 km) NWP grid; estimates are uniform across all 5 pilot zones.",
        "Model precipitation reflects atmospheric projections, not calibrated ground rain-gauge measurements.",
        "Rule-based decision support prototype; does not simulate dynamic hydraulic street-level water depth.",
    ]
    if weather_status == "Stale":
        confidence = "Low"
        limitations.append("Weather cache is stale (>15 minute TTL expired); ground conditions may differ.")
    elif weather_status == "Simulated":
        confidence = "Moderate"
        limitations.append("Demonstration fixture payload; not connected to live satellite or NWP feed.")
    elif weather_status == "Forecast-Derived":
        confidence = "Moderate"
        limitations.append("Driven predominantly by forward numerical simulation rather than measured ground runoff.")
    else:
        confidence = "High"

    return {
        "urgency_band": urgency_band,
        "urgency_score": urgency_score,
        "recent_6h_volume_mm": recent_6h_volume,
        "forecast_6h_volume_mm": forecast_6h_volume,
        "current_intensity_mm_hr": current_intensity,
        "peak_forecast_intensity_mm_hr": peak_forecast_intensity,
        "weather_status": weather_status,
        "weather_source": weather_source,
        "weather_timestamp": provider_ts,
        "retrieval_timestamp": retrieval_ts,
        "urgency_rationale": urgency_rationale,
        "is_shared_regional_signal": True,
        "cluster_scope_note": "Regional ~0.1° (~11 km) grid encompasses the pilot cluster uniformly.",
        "confidence": confidence,
        "confidence_limitations": limitations,
    }


def calculate_zone_priority_and_risk(
    zone: Zone,
    incidents: List[Incident],
    maintenance_actions: List[MaintenanceAction],
    eval_time: Optional[datetime] = None,
    weather_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluates a single zone deterministically and returns an explainable breakdown of:
    - Environmental Risk Score (0-100) & Risk Band
    - Operational Priority Score (0-100) & Priority Band
    - Factor breakdown with numeric contribution and rationale
    - Data provenance (Observed vs. Inferred vs. Simulated)
    - Missing inputs
    - Suggested next action
    """
    if eval_time is None:
        eval_time = _get_utc_now()
    if eval_time.tzinfo is None:
        eval_time = eval_time.replace(tzinfo=timezone.utc)

    # 1. Filter active incidents (ignore Closed and Duplicate for immediate intervention priority)
    active_incidents = [i for i in incidents if i.status not in ("Closed", "Duplicate")]
    all_unclosed = [i for i in incidents if i.status != "Closed"]
    total_report_count = sum(i.report_count for i in incidents)
    active_report_count = sum(i.report_count for i in active_incidents)

    # Check for recurrence flag on zone or active incidents
    has_recurrence = zone.has_recurrence_flag or any(i.has_recurrence_flag for i in incidents)

    # -------------------------------------------------------------
    # Factor 1: Active Incident Severity (Max 35 points)
    # -------------------------------------------------------------
    severity_high_count = sum(1 for i in active_incidents if i.severity.lower() == "high")
    severity_mod_count = sum(1 for i in active_incidents if i.severity.lower() == "moderate")
    severity_low_count = sum(1 for i in active_incidents if i.severity.lower() == "low")
    severity_unassessed_count = sum(1 for i in active_incidents if i.severity.lower() == "unassessed")

    if severity_high_count > 0:
        severity_score = min(35.0, 25.0 + (severity_high_count - 1) * 5.0 + severity_mod_count * 2.0)
        severity_rationale = f"{severity_high_count} high-severity unclosed incident(s) requiring urgent attention."
    elif severity_mod_count > 0:
        severity_score = min(20.0, 12.0 + severity_mod_count * 3.0)
        severity_rationale = f"{severity_mod_count} moderate-severity incident(s) under review."
    elif severity_low_count > 0:
        severity_score = min(10.0, 5.0 + severity_low_count * 2.0)
        severity_rationale = f"{severity_low_count} low-severity minor pooling incident(s)."
    else:
        severity_score = 0.0
        if severity_unassessed_count > 0:
            severity_rationale = f"{severity_unassessed_count} unassessed citizen report(s) awaiting verification; zero verified severity score assigned."
        else:
            severity_rationale = "No active unclosed citizen incidents in this zone."

    # -------------------------------------------------------------
    # Factor 2: Recurrence After Action (Max 30 points)
    # -------------------------------------------------------------
    if has_recurrence:
        recurrence_score = 30.0
        recurrence_rationale = "Recurring waterlogging within 72h of verified maintenance completion (structural bottleneck flag)."
    else:
        recurrence_score = 0.0
        recurrence_rationale = "No post-maintenance recurrence detected within the 72h observation window."

    # -------------------------------------------------------------
    # Factor 3: Incident Velocity & Corroboration (Max 20 points)
    # -------------------------------------------------------------
    if active_report_count >= 4:
        velocity_score = 20.0
        velocity_rationale = f"High corroboration: {active_report_count} independent citizen submissions/photos."
    elif active_report_count >= 2:
        velocity_score = 12.0
        velocity_rationale = f"Moderate corroboration: {active_report_count} citizen reports confirmed."
    elif active_report_count == 1:
        velocity_score = 6.0
        velocity_rationale = "Single citizen or inspector report pending field verification."
    else:
        velocity_score = 0.0
        velocity_rationale = "Zero unclosed reports."

    # -------------------------------------------------------------
    # Factor 4: Recency / Freshness (Max 15 points)
    # -------------------------------------------------------------
    most_recent_time: Optional[datetime] = None
    for inc in active_incidents:
        r_time = inc.reported_at
        if r_time.tzinfo is None:
            r_time = r_time.replace(tzinfo=timezone.utc)
        if most_recent_time is None or r_time > most_recent_time:
            most_recent_time = r_time

    if most_recent_time:
        age_hours = (eval_time - most_recent_time).total_seconds() / 3600.0
        if age_hours <= 1.0:
            recency_score = 15.0
            recency_rationale = "Very fresh report received within the past hour."
        elif age_hours <= 3.0:
            recency_score = 10.0
            recency_rationale = f"Report received {round(age_hours, 1)}h ago (active convective window)."
        elif age_hours <= 12.0:
            recency_score = 6.0
            recency_rationale = f"Report received {round(age_hours, 1)}h ago."
        elif age_hours <= 24.0:
            recency_score = 3.0
            recency_rationale = "Report received within past 24 hours."
        else:
            recency_score = 1.0
            recency_rationale = "Report is older than 24 hours."
    else:
        recency_score = 0.0
        recency_rationale = "No active incident timestamp."

    # Operational Priority Score Total (0-100)
    raw_priority = severity_score + recurrence_score + velocity_score + recency_score
    priority_score = int(round(min(100.0, max(0.0, raw_priority))))

    # Priority Band
    if priority_score >= 75:
        priority_band = "Urgent"
    elif priority_score >= 50:
        priority_band = "High"
    elif priority_score >= 25:
        priority_band = "Moderate"
    else:
        priority_band = "Monitor"

    # -------------------------------------------------------------
    # Environmental Risk (Inherent Physical Susceptibility)
    # -------------------------------------------------------------
    # Uses stored zone factors or falls back to documented defaults
    risk_factors = zone.risk_factors or {}
    rainfall_w = float(risk_factors.get("rainfall_weight", 20.0))
    recurrence_w = float(risk_factors.get("recurrence_weight", 15.0))
    terrain_w = float(risk_factors.get("terrain_weight", 15.0))
    evidence_w = float(risk_factors.get("incident_evidence", 10.0))
    infra_w = float(risk_factors.get("infrastructure_context", 10.0))

    calc_risk_score = int(round(min(100.0, max(0.0, rainfall_w + recurrence_w + terrain_w + evidence_w + infra_w))))
    # Keep baseline zone risk score aligned with DB or update with calculation
    final_risk_score = zone.risk_score if zone.risk_score else calc_risk_score
    final_risk_band = zone.risk_band if zone.risk_band else "moderate"

    # Assess regional atmospheric weather urgency across the shared pilot cluster
    regional_weather = assess_regional_weather_urgency(weather_snapshot)

    # Suggested Action
    if has_recurrence:
        suggested_action = "Escalate for Engineering Assessment"
        action_rationale = "Recurring inundation after desilting suggests hydraulic backflow or culvert undersizing."
    elif severity_high_count > 0:
        suggested_action = "Clean / Desilt"
        action_rationale = "Immediate debris clearance needed to restore gravity storm discharge."
    elif severity_mod_count > 0:
        suggested_action = "Inspect"
        action_rationale = "Verify inlet grates and lateral curb connections on-site."
    elif regional_weather["urgency_band"] in ("Critical", "Elevated") and final_risk_band == "high":
        suggested_action = "Pump Deployment" if regional_weather["urgency_band"] == "Critical" else "Culvert Clearing"
        action_rationale = f"Pre-emptive deployment ahead of {regional_weather['urgency_band'].lower()} regional storm spell in low-lying catchment."
    elif final_risk_band == "high":
        suggested_action = "Culvert Clearing"
        action_rationale = "Preventative clearing in high-susceptibility depression zone."
    else:
        suggested_action = "Monitor"
        action_rationale = "Maintain baseline sensor watch; gravity discharge operating normally."

    # Missing inputs and provenance
    missing_inputs = list(zone.missing_signals or [])
    if regional_weather["weather_status"] in ("Unavailable", "Stale"):
        missing_inputs.append(f"Current weather telemetry ({regional_weather['weather_status'].lower()})")
    if not missing_inputs and zone.risk_band == "moderate":
        missing_inputs.append("Live culvert level sensor (uncalibrated)")

    weather_prov_desc = f"{regional_weather['weather_source']} ({regional_weather['weather_status']})"
    if regional_weather["weather_status"] == "Unavailable":
        weather_prov_desc = "Weather telemetry unavailable; atmospheric risk unassessed"

    provenance_details = {
        "regional_weather": weather_prov_desc,
        "rainfall_data": weather_prov_desc,
        "citizen_reports": f"{total_report_count} pilot report fixture(s) (demonstration baseline)",
        "maintenance_audit": f"{len(maintenance_actions)} verified maintenance logs on file",
        "terrain_model": f"{zone.terrain_factor or 'Surveyed municipal grade'} (Illustrative demonstration baseline)",
    }

    # Structured factor breakdown
    factor_breakdown = {
        "severity": {
            "score": round(severity_score, 1),
            "max": 35,
            "weight_pct": 35,
            "rationale": severity_rationale,
            "high_count": severity_high_count,
            "moderate_count": severity_mod_count,
            "low_count": severity_low_count,
            "unassessed_count": severity_unassessed_count,
        },
        "recurrence": {
            "score": round(recurrence_score, 1),
            "max": 30,
            "weight_pct": 30,
            "rationale": recurrence_rationale,
            "has_recurrence": has_recurrence,
        },
        "velocity_and_corroboration": {
            "score": round(velocity_score, 1),
            "max": 20,
            "weight_pct": 20,
            "rationale": velocity_rationale,
            "active_reports": active_report_count,
            "total_reports": total_report_count,
        },
        "recency": {
            "score": round(recency_score, 1),
            "max": 15,
            "weight_pct": 15,
            "rationale": recency_rationale,
            "most_recent_time": most_recent_time.isoformat() if most_recent_time else None,
        },
        "regional_weather_urgency": {
            "score": regional_weather["urgency_score"],
            "max": 100,
            "urgency_band": regional_weather["urgency_band"],
            "weather_status": regional_weather["weather_status"],
            "is_shared_regional_signal": True,
            "recent_6h_volume_mm": regional_weather["recent_6h_volume_mm"],
            "forecast_6h_volume_mm": regional_weather["forecast_6h_volume_mm"],
            "current_intensity_mm_hr": regional_weather["current_intensity_mm_hr"],
            "rationale": regional_weather["urgency_rationale"],
        },
    }

    ranking_reasons = []
    if has_recurrence:
        ranking_reasons.append("Recurrence after recorded maintenance (72h post-action flag)")
    if severity_high_count > 0:
        ranking_reasons.append(f"{severity_high_count} high-severity active waterlogging incident(s)")
    if zone.terrain_factor:
        ranking_reasons.append(f"Physical constraint: {zone.terrain_factor}")
    if active_report_count > 1:
        ranking_reasons.append(f"{active_report_count} citizen submissions with photo evidence")
    if regional_weather["urgency_band"] in ("Critical", "Elevated"):
        ranking_reasons.append(
            f"Regional weather urgency: {regional_weather['urgency_band']} "
            f"({regional_weather['current_intensity_mm_hr']} mm/h rain, {regional_weather['forecast_6h_volume_mm']} mm forecast)"
        )
    elif regional_weather["urgency_band"] == "Unavailable":
        ranking_reasons.append("Atmospheric telemetry unavailable; physical susceptibility active")
    if not ranking_reasons:
        ranking_reasons.append("Routine monitoring; safe operational margins")

    return {
        "zone_id": zone.id,
        "zone_name": zone.name,
        "ward": zone.ward,
        "priority_score": priority_score,
        "priority_band": priority_band,
        "risk_score": final_risk_score,
        "risk_band": final_risk_band,
        "suggested_action": suggested_action,
        "action_rationale": action_rationale,
        "has_recurrence": has_recurrence,
        "active_incidents_count": len(active_incidents),
        "total_incidents_count": len(incidents),
        "total_reports_count": total_report_count,
        "ranking_reasons": ranking_reasons,
        "factors": factor_breakdown,
        "regional_weather": regional_weather,
        "missing_inputs": missing_inputs,
        "provenance": provenance_details,
        "engine_version": ENGINE_VERSION,
        "evaluated_at": eval_time.isoformat(),
    }


def evaluate_all_pilot_zones(db: Session) -> List[Dict[str, Any]]:
    """
    Evaluates all zones in the database deterministically and returns sorted results.
    Treats weather as a shared regional signal across the Navi Mumbai pilot cluster.

    Tie-breaking rule:
    1. Priority score descending
    2. Recurrence flag (True first)
    3. High-severity incident count descending
    4. Active report count descending
    5. Zone ID ascending (stable tie-breaker)
    """
    from backend.services.weather import get_weather_observation

    # Shared regional weather snapshot across all 5 pilot zones in the ~0.1° grid
    weather_snapshot = None
    try:
        weather_snapshot = get_weather_observation(db, zone_id=None, force_refresh=False)
    except Exception:
        weather_snapshot = None

    zones = db.execute(select(Zone).order_by(Zone.id)).scalars().all()
    evaluations = []

    for zone in zones:
        incidents = db.execute(
            select(Incident)
            .where(Incident.zone_id == zone.id)
            .order_by(Incident.reported_at.desc())
        ).scalars().all()

        maintenance = db.execute(
            select(MaintenanceAction)
            .where(MaintenanceAction.zone_id == zone.id)
            .order_by(MaintenanceAction.created_at.desc())
        ).scalars().all()

        eval_res = calculate_zone_priority_and_risk(
            zone, incidents, maintenance, weather_snapshot=weather_snapshot
        )
        evaluations.append(eval_res)

    # Deterministic sorting
    def sort_key(item: Dict[str, Any]):
        return (
            -item["priority_score"],
            0 if item["has_recurrence"] else 1,
            -item["factors"]["severity"]["high_count"],
            -item["factors"]["velocity_and_corroboration"]["active_reports"],
            item["zone_id"],
        )

    evaluations.sort(key=sort_key)
    return evaluations


def run_greedy_resource_scenario(
    evaluations: List[Dict[str, Any]],
    available_budget: float,
    available_crews: int,
    max_staff_hours: float,
    candidate_zone_ids: Optional[List[str]] = None,
    action_overrides: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Simulates a what-if municipal resource allocation scenario using a deterministic
    greedy selection strategy based on prioritisation rank.
    
    Validates resource limits and tracks remaining budget, hours, and crews.
    """
    if available_budget < 0:
        raise ValueError("available_budget cannot be negative")
    if available_crews < 0:
        raise ValueError("available_crews cannot be negative")
    if max_staff_hours < 0:
        raise ValueError("max_staff_hours cannot be negative")

    # If crews provided but staff_hours zero/default, estimate 8h shift * 5 shifts per crew (40h/crew)
    effective_staff_hours = max_staff_hours
    if effective_staff_hours == 0 and available_crews > 0:
        effective_staff_hours = available_crews * 40.0

    selected = []
    unselected = []
    total_cost_used = 0.0
    total_hours_used = 0.0

    # Filter candidate zones if requested
    candidates = evaluations
    if candidate_zone_ids:
        candidate_set = set(candidate_zone_ids)
        candidates = [e for e in evaluations if e["zone_id"] in candidate_set]

    # Process candidates in priority order (greedy)
    for rank, zone_eval in enumerate(candidates, start=1):
        zone_id = zone_eval["zone_id"]
        suggested_action = zone_eval["suggested_action"]

        # Check for user overrides
        override = (action_overrides or {}).get(zone_id, {})
        action_type = override.get("action_type") or suggested_action
        
        default_spec = DEFAULT_ACTION_SPECS.get(action_type, {
            "estimated_cost": 10000.0,
            "staff_hours": 16.0,
            "description": "Standard municipal field intervention.",
        })

        cost = float(override.get("estimated_cost", default_spec["estimated_cost"]))
        hours = float(override.get("staff_hours", default_spec["staff_hours"]))

        # Can we allocate this intervention?
        budget_fits = (total_cost_used + cost) <= available_budget
        hours_fit = (total_hours_used + hours) <= effective_staff_hours

        if budget_fits and hours_fit:
            total_cost_used += cost
            total_hours_used += hours
            selected.append({
                "rank": rank,
                "zone_id": zone_id,
                "zone_name": zone_eval["zone_name"],
                "ward": zone_eval["ward"],
                "priority_score": zone_eval["priority_score"],
                "priority_band": zone_eval["priority_band"],
                "action_type": action_type,
                "estimated_cost": cost,
                "staff_hours": hours,
                "rationale": zone_eval["action_rationale"],
                "selection_reason": f"Allocated based on rank #{rank} ({zone_eval['priority_band']} Priority).",
            })
        else:
            reasons = []
            if not budget_fits:
                reasons.append(f"Requires ₹{cost:,.0f}, but only ₹{available_budget - total_cost_used:,.0f} budget remains.")
            if not hours_fit:
                reasons.append(f"Requires {hours:.0f}h, but only {effective_staff_hours - total_hours_used:.0f} staff-hours remain.")
            
            unselected.append({
                "rank": rank,
                "zone_id": zone_id,
                "zone_name": zone_eval["zone_name"],
                "priority_score": zone_eval["priority_score"],
                "priority_band": zone_eval["priority_band"],
                "action_type": action_type,
                "estimated_cost": cost,
                "staff_hours": hours,
                "shortfall_reason": " ".join(reasons),
            })

    crews_utilized = round(total_hours_used / 40.0, 1) if effective_staff_hours > 0 else 0.0

    return {
        "scenario_inputs": {
            "available_budget": available_budget,
            "available_crews": available_crews,
            "max_staff_hours": effective_staff_hours,
            "candidate_zones_count": len(candidates),
        },
        "scenario_results": {
            "selected_interventions": selected,
            "unselected_interventions": unselected,
            "total_selected_count": len(selected),
            "total_unselected_count": len(unselected),
            "total_estimated_cost": total_cost_used,
            "remaining_budget": max(0.0, available_budget - total_cost_used),
            "total_staff_hours_used": total_hours_used,
            "remaining_staff_hours": max(0.0, effective_staff_hours - total_hours_used),
            "estimated_crews_utilized": crews_utilized,
        },
        "engine_assumptions": [
            "Deterministic greedy allocation ordered by priority score.",
            "Action costs and staff-hours are illustrative planning assumptions.",
            "Decision-support aid only; does not replace on-site engineering judgment or official municipal tenders.",
        ],
        "calculated_at": _get_utc_now().isoformat(),
    }
