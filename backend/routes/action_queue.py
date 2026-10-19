from flask import Blueprint, jsonify

from backend.database import get_db
from backend.services.queue import compute_action_queue

action_queue_bp = Blueprint("action_queue", __name__, url_prefix="/api/action-queue")


@action_queue_bp.route("", methods=["GET"])
def get_action_queue():
    """
    Get explainable priority triage queue ranked by severity, recurrence, and evidence.
    """
    db = get_db()
    queue = compute_action_queue(db)
    return jsonify([item.model_dump(mode="json") for item in queue]), 200
