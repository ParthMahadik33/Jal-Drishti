from flask import Blueprint, jsonify, request

from backend.database import get_db
from backend.services.weather import get_weather_observation

weather_bp = Blueprint("weather", __name__, url_prefix="/api/rainfall")


def _serialize(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    return obj


@weather_bp.route("/current", methods=["GET"])
def get_current_rainfall():
    """
    Retrieve current precipitation and numerical weather model estimates for the pilot cluster.
    Results are cached in memory (15m TTL) and persisted in SQLite for resilience.
    """
    db = get_db()
    zone_id = request.args.get("zone_id")
    try:
        obs = get_weather_observation(db, zone_id=zone_id, force_refresh=False)
        return jsonify(_serialize(obs)), 200
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 502


@weather_bp.route("/history", methods=["GET"])
def get_rainfall_history():
    """
    Retrieve recent hourly precipitation and forward forecast window from numerical weather model.
    """
    db = get_db()
    zone_id = request.args.get("zone_id")
    try:
        obs = get_weather_observation(db, zone_id=zone_id, force_refresh=False)
        return jsonify(_serialize(obs)), 200
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 502


@weather_bp.route("/refresh", methods=["POST"])
def refresh_rainfall():
    """
    Force an immediate live refresh from Open-Meteo API, bypassing in-memory cache and updating persistence.
    """
    db = get_db()
    zone_id = request.args.get("zone_id")
    try:
        obs = get_weather_observation(db, zone_id=zone_id, force_refresh=True)
        return jsonify(_serialize(obs)), 200
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 502
