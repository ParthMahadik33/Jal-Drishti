import os
from pathlib import Path
from typing import List

# Base directory for the server package
BASE_DIR = Path(__file__).resolve().parent

# Default SQLite database path inside the server folder
DEFAULT_DB_PATH = BASE_DIR / "jaldrishti.db"
DEFAULT_DB_URL = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")
    
    # Database URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", DEFAULT_DB_URL)
    
    # Demo reset configuration (strictly disabled in production by default)
    ALLOW_DEMO_RESET: bool = os.getenv(
        "ALLOW_DEMO_RESET",
        "true" if os.getenv("ENVIRONMENT", "development") in ("development", "test", "demo") else "false"
    ).lower() in ("true", "1", "yes")
    
    # Recurrence detection temporal window (hours post recorded maintenance)
    RECURRENCE_WINDOW_HOURS: int = int(os.getenv("RECURRENCE_WINDOW_HOURS", "72"))
    
    # Weather Data Provider (Open-Meteo)
    WEATHER_API_BASE_URL: str = os.getenv("WEATHER_API_BASE_URL", "https://api.open-meteo.com/v1/forecast")
    WEATHER_CACHE_TTL_SECONDS: int = int(os.getenv("WEATHER_CACHE_TTL_SECONDS", "900"))  # 15 minutes
    WEATHER_REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("WEATHER_REQUEST_TIMEOUT_SECONDS", "8.0"))
    DEFAULT_PILOT_LATITUDE: float = float(os.getenv("DEFAULT_PILOT_LATITUDE", "19.045"))
    DEFAULT_PILOT_LONGITUDE: float = float(os.getenv("DEFAULT_PILOT_LONGITUDE", "73.015"))
    
    # Prototype Weather Urgency Thresholds (Requires Ground-Truth Validation)
    # 12-hour combined precipitation (past 6h + forecast 6h) in mm
    WEATHER_12H_VOLUME_CRITICAL_MM: float = float(os.getenv("WEATHER_12H_VOLUME_CRITICAL_MM", "50.0"))
    WEATHER_12H_VOLUME_ELEVATED_MM: float = float(os.getenv("WEATHER_12H_VOLUME_ELEVATED_MM", "25.0"))
    WEATHER_12H_VOLUME_MODERATE_MM: float = float(os.getenv("WEATHER_12H_VOLUME_MODERATE_MM", "10.0"))
    
    # Peak hourly intensity in mm/hr
    WEATHER_HOURLY_INTENSITY_CRITICAL_MM: float = float(os.getenv("WEATHER_HOURLY_INTENSITY_CRITICAL_MM", "30.0"))
    WEATHER_HOURLY_INTENSITY_ELEVATED_MM: float = float(os.getenv("WEATHER_HOURLY_INTENSITY_ELEVATED_MM", "15.0"))
    WEATHER_HOURLY_INTENSITY_MODERATE_MM: float = float(os.getenv("WEATHER_HOURLY_INTENSITY_MODERATE_MM", "5.0"))
    
    # Autonomous Source Collector Configuration (v1)
    WEATHER_POLL_INTERVAL_SECONDS: int = max(60, int(os.getenv("WEATHER_POLL_INTERVAL_SECONDS", "1800")))
    OSM_POLL_INTERVAL_SECONDS: int = max(300, int(os.getenv("OSM_POLL_INTERVAL_SECONDS", "86400")))
    OVERPASS_API_URL: str = os.getenv("OVERPASS_API_URL", "https://overpass.kumi.systems/api/interpreter")
    OVERPASS_REQUEST_TIMEOUT_SECONDS: float = max(5.0, float(os.getenv("OVERPASS_REQUEST_TIMEOUT_SECONDS", "25.0")))
    
    # Nerul–Sanpada Pilot Geospatial Bounding Box (South, West, North, East)
    PILOT_BBOX_SOUTH: float = float(os.getenv("PILOT_BBOX_SOUTH", "19.020"))
    PILOT_BBOX_WEST: float = float(os.getenv("PILOT_BBOX_WEST", "73.000"))
    PILOT_BBOX_NORTH: float = float(os.getenv("PILOT_BBOX_NORTH", "19.075"))
    PILOT_BBOX_EAST: float = float(os.getenv("PILOT_BBOX_EAST", "73.035"))
    
    # WhatsApp Cloud API Webhook & Integration Configuration
    WHATSAPP_VERIFY_TOKEN: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    WHATSAPP_APP_SECRET: str = os.getenv("WHATSAPP_APP_SECRET", "")
    WHATSAPP_ACCESS_TOKEN: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    
    # Internal Operator API Key for WhatsApp provenance audit and media retrieval
    OPERATOR_API_KEY: str = os.getenv("OPERATOR_API_KEY", "")
    
    # Allowed CORS origins
    _cors_raw: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173,http://localhost:3000"
    )

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [origin.strip() for origin in self._cors_raw.split(",") if origin.strip()]

settings = Settings()

