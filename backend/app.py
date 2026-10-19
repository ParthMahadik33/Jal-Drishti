import os
import sys
from pathlib import Path

# Ensure project root is in sys.path so 'backend' package imports work
# whether run as `python app.py` from within backend/ or as a module from root
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from flask import Flask, g, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

from backend.config import settings
from backend.database import Base, engine, SessionLocal
from backend.seed import seed_database

from backend.routes.health import health_bp
from backend.routes.zones import zones_bp
from backend.routes.incidents import incidents_bp
from backend.routes.maintenance import maintenance_bp
from backend.routes.action_queue import action_queue_bp
from backend.routes.prioritisation import prioritisation_bp
from backend.routes.weather import weather_bp
from backend.routes.demo import demo_bp
from backend.routes.sources import sources_bp
from backend.routes.whatsapp import whatsapp_bp


def ensure_schema_compatibility(bind) -> None:
    """Safely adds missing nullable columns to existing tables without data loss."""
    from sqlalchemy import inspect, text
    inspector = inspect(bind)
    if "incidents" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("incidents")]
        if "raw_message_id" not in columns:
            with bind.connect() as conn:
                conn.execute(text("ALTER TABLE incidents ADD COLUMN raw_message_id VARCHAR(128)"))
                conn.commit()
    if "geographic_features" in inspector.get_table_names():
        gf_cols = [c["name"] for c in inspector.get_columns("geographic_features")]
        if "data_origin" not in gf_cols:
            with bind.connect() as conn:
                conn.execute(text("ALTER TABLE geographic_features ADD COLUMN data_origin VARCHAR(32) DEFAULT 'curated' NOT NULL"))
                conn.commit()


def create_app(config_override: dict = None) -> Flask:
    """
    Flask Application Factory for JalDrishti Urban Flood Intelligence API.
    """
    app = Flask(__name__)
    app.config["ENV"] = settings.ENVIRONMENT
    app.config["DEBUG"] = settings.DEBUG

    if config_override:
        app.config.update(config_override)

    # CORS configuration for local Vite dev / preview origins
    CORS(
        app,
        origins=settings.CORS_ORIGINS,
        supports_credentials=True,
        allow_headers=["*"],
        methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    )

    # Global error handlers ensuring {"detail": ...} response structure
    @app.errorhandler(HTTPException)
    def handle_http_exception(e: HTTPException):
        return jsonify({"detail": e.description}), e.code

    @app.errorhandler(ValidationError)
    def handle_validation_error(e: ValidationError):
        return jsonify({"detail": e.errors()}), 422

    @app.errorhandler(Exception)
    def handle_unhandled_exception(e: Exception):
        if isinstance(e, HTTPException):
            return jsonify({"detail": e.description}), e.code
        import logging
        logging.getLogger("jaldrishti.app").exception(f"Unhandled server exception: {e}")
        return jsonify({"detail": "An internal server error occurred."}), 500

    # Database lifecycle management
    @app.teardown_appcontext
    def teardown_db(exception=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    # Register Blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(zones_bp)
    app.register_blueprint(incidents_bp)
    app.register_blueprint(maintenance_bp)
    app.register_blueprint(action_queue_bp)
    app.register_blueprint(prioritisation_bp)
    app.register_blueprint(weather_bp)
    app.register_blueprint(demo_bp)
    app.register_blueprint(sources_bp)
    app.register_blueprint(whatsapp_bp)

    # Initialize SQLite tables and seed default fixtures idempotently
    if not app.config.get("SKIP_DB_INIT", False):
        active_engine = app.config.get("DATABASE_ENGINE", engine)
        active_session_factory = app.config.get("SESSION_FACTORY", SessionLocal)
        Base.metadata.create_all(bind=active_engine)
        ensure_schema_compatibility(active_engine)
        with active_session_factory() as db:
            seed_database(db, force=False)
            from backend.services.collector.geojson_importer import import_local_geographic_directory
            import_local_geographic_directory(db)

    return app



# Default application instance
app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=settings.DEBUG)
