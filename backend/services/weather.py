"""
JalDrishti Weather Service (v4.0.0)

Integrates real Open-Meteo Numerical Weather Prediction (NWP) precipitation data.
Maintains strict separation between:
1. Physical rain-gauge observations (clearly flagged if/when deployed).
2. NWP Numerical Weather Models (Open-Meteo ECMWF/GFS blend).
3. Simulated demo fixtures (used exclusively in offline demo mode).

Provides:
- In-memory caching with configurable TTL (default 15 minutes) to avoid redundant external calls.
- SQLite persistence of observations for surviving restarts and graceful degradation.
- Explicit spatial coverage disclosures for clustered pilot zones.
- Deterministic handling of past observations vs. future forecast intervals.
"""

from datetime import datetime, timezone, timedelta
import threading
from typing import Dict, Any, Optional, Tuple, List
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from backend.config import settings
from backend.models import Zone, RainfallObservationRecord


# WMO Weather interpretation codes
WMO_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate continuous rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent convective rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm with rain",
    96: "Severe thunderstorm with slight hail",
    99: "Severe thunderstorm with heavy hail",
}

def get_weather_description(code: Optional[int], precipitation_mm: float) -> str:
    if code is not None and code in WMO_CODE_MAP:
        return WMO_CODE_MAP[code]
    if precipitation_mm >= 30.0:
        return "Extreme torrential rainfall"
    if precipitation_mm >= 15.0:
        return "Heavy convective rain"
    if precipitation_mm >= 5.0:
        return "Moderate rainfall"
    if precipitation_mm > 0.0:
        return "Light precipitation / drizzle"
    return "Dry / Clear conditions"


SPATIAL_COVERAGE_EXPLANATION = (
    "Open-Meteo numerical weather prediction operates on a regional ~0.1° (~11 km) grid. "
    "All 5 Navi Mumbai pilot zones (Nerul & Sanpada, spanning 4.8 km) fall within the same "
    "model grid cell; regional precipitation estimates are identical across this cluster."
)


class WeatherCacheEntry:
    def __init__(self, data: Dict[str, Any], cached_at: datetime):
        self.data = data
        self.cached_at = cached_at


# In-memory coordinate-indexed cache
_WEATHER_CACHE: Dict[Tuple[float, float], WeatherCacheEntry] = {}
_CACHE_LOCK = threading.Lock()


def _get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def resolve_coordinates_for_zone(zone_id: Optional[str], db: Optional[Session]) -> Tuple[float, float, Optional[str], Optional[str]]:
    """
    Resolves latitude, longitude, and spatial limitation notes for a given zone or defaults
    to the Navi Mumbai pilot center.
    Returns: (latitude, longitude, zone_id, error_or_limitation_note)
    """
    if not zone_id:
        return settings.DEFAULT_PILOT_LATITUDE, settings.DEFAULT_PILOT_LONGITUDE, None, None

    if db:
        zone = db.execute(select(Zone).where(Zone.id == zone_id)).scalar_one_or_none()
        if zone:
            # Check for valid coordinates
            if zone.latitude and zone.longitude and not (zone.latitude == 0.0 and zone.longitude == 0.0):
                return zone.latitude, zone.longitude, zone.id, None
            else:
                return 0.0, 0.0, zone.id, f"Zone '{zone.name}' lacks verified GPS coordinates; numerical weather model cannot be localized."

    return settings.DEFAULT_PILOT_LATITUDE, settings.DEFAULT_PILOT_LONGITUDE, zone_id, f"Zone '{zone_id}' not found in active database; using pilot cluster center."


def parse_provider_response(
    raw_json: Dict[str, Any],
    latitude: float,
    longitude: float,
    zone_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Parses Open-Meteo API response into structured observations,
    classifying current vs. forecast records cleanly with timestamps.
    """
    current = raw_json.get("current", {})
    hourly = raw_json.get("hourly", {})
    current_units = raw_json.get("current_units", {})
    hourly_units = raw_json.get("hourly_units", {})

    provider_timestamp = current.get("time", _get_utc_now().strftime("%Y-%m-%dT%H:%M"))
    precip_mm = float(current.get("precipitation", 0.0) or 0.0)
    rain_mm = float(current.get("rain", 0.0) or 0.0)
    wmo_code = current.get("weather_code")
    if wmo_code is not None:
        try:
            wmo_code = int(wmo_code)
        except (ValueError, TypeError):
            wmo_code = None

    hourly_times = hourly.get("time", [])
    hourly_precip = hourly.get("precipitation", [])
    hourly_rain = hourly.get("rain", [])
    hourly_probs = hourly.get("precipitation_probability", [])

    all_hourly_items: List[Dict[str, Any]] = []

    # Parse provider timestamp for comparative time partitioning
    try:
        prov_dt = datetime.fromisoformat(provider_timestamp)
    except Exception:
        prov_dt = _get_utc_now()

    for idx, t_str in enumerate(hourly_times):
        try:
            t_dt = datetime.fromisoformat(t_str)
        except Exception:
            continue

        p_val = float(hourly_precip[idx] if idx < len(hourly_precip) and hourly_precip[idx] is not None else 0.0)
        r_val = float(hourly_rain[idx] if idx < len(hourly_rain) and hourly_rain[idx] is not None else 0.0)
        prob_val = float(hourly_probs[idx]) if idx < len(hourly_probs) and hourly_probs[idx] is not None else None

        is_forecast = t_dt > prov_dt
        hour_diff = int(round((t_dt - prov_dt).total_seconds() / 3600.0))

        if hour_diff == 0:
            rel_label = "Current hour"
        elif hour_diff > 0:
            rel_label = f"+{hour_diff}h forecast"
        else:
            rel_label = f"{abs(hour_diff)}h ago"

        all_hourly_items.append({
            "time": t_dt.strftime("%H:%M"),
            "timestamp_iso": t_str,
            "precipitation_mm": round(p_val, 1),
            "rain_mm": round(r_val, 1),
            "precipitation_probability": prob_val,
            "is_forecast": is_forecast,
            "relative_time_label": rel_label,
            "dt_epoch": t_dt.timestamp(),
        })

    # Sort chronologically
    all_hourly_items.sort(key=lambda x: x["dt_epoch"])

    # Partition past records (last 6 to 12 hours) vs forecast records (next 12 to 24 hours)
    past_records = [x for x in all_hourly_items if not x["is_forecast"]]
    forecast_records = [x for x in all_hourly_items if x["is_forecast"]]

    # Keep a practical window: past 6 hours + next 12 hours
    trimmed_past = past_records[-6:] if len(past_records) >= 6 else past_records
    trimmed_forecast = forecast_records[:12]

    # Clean internal dt_epoch before returning
    for item in trimmed_past + trimmed_forecast:
        item.pop("dt_epoch", None)

    total_past_mm = round(sum(item["precipitation_mm"] for item in trimmed_past), 1)
    all_viewable = trimmed_past + trimmed_forecast
    peak_val = max([item["precipitation_mm"] for item in all_viewable] + [precip_mm, 10.0])

    combined_units = {
        "precipitation": current_units.get("precipitation", "mm"),
        "rain": current_units.get("rain", "mm"),
        "precipitation_probability": hourly_units.get("precipitation_probability", "%"),
        "time": "ISO8601 (Asia/Kolkata)",
    }

    retrieved_at_iso = _get_utc_now().isoformat()

    return {
        "zone_id": zone_id,
        "provider": "Open-Meteo",
        "provider_model": "Open-Meteo Best Match (Operational Composite)",
        "latitude": latitude,
        "longitude": longitude,
        "elevation": raw_json.get("elevation"),
        "retrieved_at": retrieved_at_iso,
        "provider_timestamp": provider_timestamp,
        "current_precipitation_mm": round(precip_mm, 1),
        "current_rain_mm": round(rain_mm, 1),
        "current_weather_code": wmo_code,
        "weather_description": get_weather_description(wmo_code, precip_mm),
        "units": combined_units,
        "data_status": "Weather Model",
        "provenance_text": "Open-Meteo Best Match Operational NWP (Not rain-gauge observed)",
        "is_simulated": False,
        "spatial_coverage_notes": SPATIAL_COVERAGE_EXPLANATION,
        "past_records": trimmed_past,
        "forecast_records": trimmed_forecast,
        "total_past_rainfall_mm": total_past_mm,
        "peak_precipitation_mm": round(peak_val, 1),
        "current_intensity_mm_hr": round(precip_mm, 1),
    }


def fetch_from_open_meteo_api(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    Direct HTTP call to Open-Meteo forecast API using httpx with timeout and validation.
    """
    params = {
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "current": "precipitation,rain,weather_code",
        "hourly": "precipitation,rain,precipitation_probability",
        "timezone": "Asia/Kolkata",
        "past_days": 1,
        "forecast_days": 2,
    }

    try:
        with httpx.Client(timeout=settings.WEATHER_REQUEST_TIMEOUT_SECONDS) as client:
            response = client.get(settings.WEATHER_API_BASE_URL, params=params)
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException as exc:
        raise RuntimeError(f"Open-Meteo weather API timed out after {settings.WEATHER_REQUEST_TIMEOUT_SECONDS}s: {exc}") from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"Open-Meteo weather API returned HTTP {exc.response.status_code}: {exc.response.text}") from exc
    except Exception as exc:
        raise RuntimeError(f"Failed to query Open-Meteo API: {str(exc)}") from exc


def persist_observation_to_db(db: Session, observation_dict: Dict[str, Any], zone_id: Optional[str]) -> RainfallObservationRecord:
    """
    Persists structured observation to SQLite for durability across restarts and graceful degradation.
    Deduplicates based on (latitude, longitude, provider_timestamp) to prevent duplicate inserts on poll cycles.
    """
    prov_ts = observation_dict["provider_timestamp"]
    lat = observation_dict["latitude"]
    lon = observation_dict["longitude"]

    existing_stmt = (
        select(RainfallObservationRecord)
        .where(
            RainfallObservationRecord.provider_timestamp == prov_ts,
            RainfallObservationRecord.latitude == lat,
            RainfallObservationRecord.longitude == lon,
        )
        .limit(1)
    )
    existing = db.execute(existing_stmt).scalar_one_or_none()

    retrieved_dt = datetime.fromisoformat(observation_dict["retrieved_at"].replace("Z", "+00:00"))
    hourly_data = {
        "past": observation_dict["past_records"],
        "forecast": observation_dict["forecast_records"],
        "total_past_mm": observation_dict["total_past_rainfall_mm"],
        "peak_mm": observation_dict["peak_precipitation_mm"],
    }

    if existing:
        existing.zone_id = zone_id or existing.zone_id
        existing.provider = observation_dict.get("provider", existing.provider)
        existing.provider_model = observation_dict.get("provider_model", existing.provider_model)
        existing.elevation = observation_dict.get("elevation", existing.elevation)
        existing.retrieved_at = retrieved_dt
        existing.current_precipitation_mm = observation_dict["current_precipitation_mm"]
        existing.current_rain_mm = observation_dict["current_rain_mm"]
        existing.current_weather_code = observation_dict.get("current_weather_code")
        existing.hourly_records = hourly_data
        existing.units = observation_dict["units"]
        existing.data_status = observation_dict.get("data_status", existing.data_status)
        existing.provenance_text = observation_dict.get("provenance_text", existing.provenance_text)
        existing.spatial_coverage_notes = observation_dict.get("spatial_coverage_notes", existing.spatial_coverage_notes)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    record = RainfallObservationRecord(
        zone_id=zone_id,
        provider=observation_dict.get("provider", "Open-Meteo"),
        provider_model=observation_dict.get("provider_model", "Open-Meteo Best Match (Operational Composite)"),
        latitude=lat,
        longitude=lon,
        elevation=observation_dict.get("elevation"),
        retrieved_at=retrieved_dt,
        provider_timestamp=prov_ts,
        current_precipitation_mm=observation_dict["current_precipitation_mm"],
        current_rain_mm=observation_dict["current_rain_mm"],
        current_weather_code=observation_dict.get("current_weather_code"),
        hourly_records=hourly_data,
        units=observation_dict["units"],
        data_status=observation_dict.get("data_status", "Weather Model"),
        provenance_text=observation_dict.get("provenance_text", "Open-Meteo NWP"),
        spatial_coverage_notes=observation_dict.get("spatial_coverage_notes", SPATIAL_COVERAGE_EXPLANATION),
        is_simulated=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_latest_persisted_observation(
    db: Session,
    latitude: float,
    longitude: float,
    tolerance_deg: float = 0.05,
) -> Optional[Dict[str, Any]]:
    """
    Retrieves the most recent observation stored in the database within geographical tolerance.
    """
    query = (
        select(RainfallObservationRecord)
        .where(
            RainfallObservationRecord.latitude.between(latitude - tolerance_deg, latitude + tolerance_deg),
            RainfallObservationRecord.longitude.between(longitude - tolerance_deg, longitude + tolerance_deg),
        )
        .order_by(desc(RainfallObservationRecord.retrieved_at))
        .limit(1)
    )
    record = db.execute(query).scalar_one_or_none()
    if not record:
        return None

    hourly_data = record.hourly_records or {}
    past = hourly_data.get("past", [])
    forecast = hourly_data.get("forecast", [])

    return {
        "zone_id": record.zone_id,
        "provider": record.provider,
        "provider_model": record.provider_model,
        "latitude": record.latitude,
        "longitude": record.longitude,
        "elevation": record.elevation,
        "retrieved_at": record.retrieved_at.isoformat(),
        "provider_timestamp": record.provider_timestamp,
        "current_precipitation_mm": record.current_precipitation_mm,
        "current_rain_mm": record.current_rain_mm,
        "current_weather_code": record.current_weather_code,
        "weather_description": get_weather_description(record.current_weather_code, record.current_precipitation_mm),
        "units": record.units,
        "data_status": record.data_status,
        "provenance_text": record.provenance_text,
        "is_simulated": record.is_simulated,
        "spatial_coverage_notes": record.spatial_coverage_notes or SPATIAL_COVERAGE_EXPLANATION,
        "past_records": past,
        "forecast_records": forecast,
        "total_past_rainfall_mm": hourly_data.get("total_past_mm", 0.0),
        "peak_precipitation_mm": hourly_data.get("peak_mm", 10.0),
        "current_intensity_mm_hr": record.current_precipitation_mm,
    }


def get_weather_observation(
    db: Session,
    zone_id: Optional[str] = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    High-level entrypoint for fetching weather observation:
    1. Resolves coordinates (validating zone if provided).
    2. Checks in-memory cache if force_refresh is False.
    3. If cache miss or forced, queries Open-Meteo API.
    4. If API succeeds: caches in memory and persists to SQLite.
    5. If API fails: falls back to last persisted SQLite record (marked is_stale=True).
    6. If no SQLite record exists: raises RuntimeError with actionable detail.
    """
    lat, lon, resolved_zone_id, limitation_note = resolve_coordinates_for_zone(zone_id, db)

    if lat == 0.0 and lon == 0.0:
        raise ValueError(limitation_note or "Coordinates missing for requested zone.")

    cache_key = (round(lat, 3), round(lon, 3))
    now = _get_utc_now()

    # 1. Check in-memory cache
    if not force_refresh:
        with _CACHE_LOCK:
            entry = _WEATHER_CACHE.get(cache_key)
            if entry:
                age_seconds = int((now - entry.cached_at).total_seconds())
                if age_seconds < settings.WEATHER_CACHE_TTL_SECONDS:
                    res = dict(entry.data)
                    res["is_cached"] = True
                    res["cache_age_seconds"] = age_seconds
                    res["is_stale"] = False
                    if limitation_note:
                        res["spatial_coverage_notes"] = f"{limitation_note} {SPATIAL_COVERAGE_EXPLANATION}"
                    return res

    # 2. Cache miss or force refresh: fetch from provider
    fetch_error: Optional[str] = None
    try:
        raw_json = fetch_from_open_meteo_api(lat, lon)
        parsed = parse_provider_response(raw_json, lat, lon, resolved_zone_id)
        if limitation_note:
            parsed["spatial_coverage_notes"] = f"{limitation_note} {SPATIAL_COVERAGE_EXPLANATION}"

        # Persist to database
        persist_observation_to_db(db, parsed, resolved_zone_id)

        # Update cache
        with _CACHE_LOCK:
            _WEATHER_CACHE[cache_key] = WeatherCacheEntry(parsed, now)

        parsed["is_cached"] = False
        parsed["cache_age_seconds"] = 0
        parsed["is_stale"] = False
        return parsed

    except Exception as exc:
        fetch_error = str(exc)

    # 3. Fallback to persisted observation in SQLite
    fallback = get_latest_persisted_observation(db, lat, lon)
    if fallback:
        retrieved_dt = datetime.fromisoformat(fallback["retrieved_at"].replace("Z", "+00:00"))
        if retrieved_dt.tzinfo is None:
            retrieved_dt = retrieved_dt.replace(tzinfo=timezone.utc)
        age_seconds = max(0, int((now - retrieved_dt).total_seconds()))
        fallback["is_cached"] = True
        fallback["cache_age_seconds"] = age_seconds
        fallback["is_stale"] = True
        fallback["provenance_text"] = (
            f"Cached NWP Model: Open-Meteo Best Match (Provider refresh failed: {fetch_error}). Retained record from {age_seconds // 60}m ago."
        )
        return fallback

    # 4. If neither live API nor persisted DB records exist, raise actionable error
    raise RuntimeError(
        f"Unable to retrieve weather data for ({lat:.4f}, {lon:.4f}) and no prior observations exist in database. Error: {fetch_error}"
    )


def clear_weather_cache() -> None:
    """Helper for test isolation."""
    with _CACHE_LOCK:
        _WEATHER_CACHE.clear()
