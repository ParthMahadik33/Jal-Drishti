from flask import Blueprint, jsonify, request

from backend.config import settings
from backend.database import get_db
from backend.seed import reset_demo_fixtures

demo_bp = Blueprint("demo", __name__, url_prefix="/api/demo")


@demo_bp.route("/reset", methods=["POST"])
def reset_demo_database():
    """
    Safely reset demo fixtures to initial deterministic pilot seeds.
    Requires explicit confirmation payload: {"confirm": true}.
    Disabled in production or when ALLOW_DEMO_RESET is false.
    Guarantees operational records (e.g. observed maintenance logs, live collector observations) are preserved.
    """
    if settings.ENVIRONMENT == "production" or not settings.ALLOW_DEMO_RESET:
        return jsonify({"detail": "Demo reset is disabled in this environment."}), 403

    body = request.get_json(silent=True) or {}
    if not body.get("confirm"):
        return jsonify({
            "detail": "Deliberate confirmation required. Payload must include {'confirm': true} to reset demo fixtures."
        }), 400

    db = get_db()
    result = reset_demo_fixtures(db)
    return jsonify({
        "message": "Demo fixtures reset successfully. Operational records preserved.",
        "status": "ok",
        "details": result,
    }), 200

