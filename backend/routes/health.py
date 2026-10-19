from datetime import datetime, timezone
from flask import Blueprint, jsonify
from sqlalchemy import text

from backend.config import settings
from backend.database import get_db
from backend.schemas import HealthResponse

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
@health_bp.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint verifying database connectivity."""
    db = get_db()
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    resp = HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        timestamp=datetime.now(timezone.utc).isoformat(),
        database=db_status,
        version="1.0.0",
        mode=settings.ENVIRONMENT,
    )
    status_code = 200 if db_status == "connected" else 503
    return jsonify(resp.model_dump(mode="json")), status_code
