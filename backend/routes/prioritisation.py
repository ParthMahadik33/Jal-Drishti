from flask import Blueprint, jsonify, request
from pydantic import ValidationError
from sqlalchemy import select

from backend.database import get_db
from backend.models import Zone, Incident, MaintenanceAction
from backend.schemas import ResourceScenarioRequest
from backend.services.prioritisation import (
    evaluate_all_pilot_zones,
    calculate_zone_priority_and_risk,
    run_greedy_resource_scenario,
)

prioritisation_bp = Blueprint("prioritisation", __name__, url_prefix="/api/prioritisation")


def _serialize(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    return obj


@prioritisation_bp.route("/evaluations", methods=["GET"])
def list_zone_evaluations():
    """
    Get explainable priority and risk evaluations for all pilot zones.
    Includes factor breakdowns, rationale, and provenance.
    """
    db = get_db()
    evaluations = evaluate_all_pilot_zones(db)
    return jsonify([_serialize(e) for e in evaluations]), 200


@prioritisation_bp.route("/evaluations/<zone_id>", methods=["GET"])
def get_zone_evaluation(zone_id: str):
    """
    Get detailed explainable priority score breakdown for a specific zone.
    """
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

    weather_snapshot = None
    try:
        from backend.services.weather import get_weather_observation
        weather_snapshot = get_weather_observation(db, zone_id=zone_id, force_refresh=False)
    except Exception:
        weather_snapshot = None

    eval_result = calculate_zone_priority_and_risk(
        zone, incidents, maintenance, weather_snapshot=weather_snapshot
    )
    return jsonify(_serialize(eval_result)), 200


@prioritisation_bp.route("/scenario", methods=["POST"])
def simulate_resource_scenario():
    """
    Simulate a what-if municipal resource allocation scenario under budget, crew,
    and staff-hour constraints using deterministic greedy priority ordering.
    """
    db = get_db()
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"detail": "Invalid or missing JSON body"}), 400

    try:
        req = ResourceScenarioRequest.model_validate(body)
    except ValidationError as e:
        return jsonify({"detail": e.errors()}), 422

    try:
        evaluations = evaluate_all_pilot_zones(db)
        action_overrides_dict = None
        if req.action_overrides:
            action_overrides_dict = {
                k: v.model_dump(exclude_none=True) for k, v in req.action_overrides.items()
            }

        scenario_output = run_greedy_resource_scenario(
            evaluations=evaluations,
            available_budget=req.available_budget,
            available_crews=req.available_crews,
            max_staff_hours=req.max_staff_hours,
            candidate_zone_ids=req.candidate_zone_ids,
            action_overrides=action_overrides_dict,
        )
        return jsonify(_serialize(scenario_output)), 200
    except ValueError as e:
        return jsonify({"detail": str(e)}), 422
