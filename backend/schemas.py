from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from pydantic import BaseModel, Field, ConfigDict, model_validator


def format_relative_time(dt: Optional[datetime]) -> str:
    """Format a datetime into a human-readable relative time string."""
    if not dt:
        return "Just now"
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())

    if seconds < 60:
        return "Just now"
    if seconds < 3600:
        minutes = seconds // 60
        return f"{minutes}m ago"
    if seconds < 86400:
        hours = seconds // 3600
        mins = (seconds % 3600) // 60
        return f"{hours}h {mins}m ago" if mins > 0 else f"{hours}h ago"
    days = seconds // 86400
    return f"{days}d ago"


# ==========================================
# Zone Schemas
# ==========================================

class ZoneBase(BaseModel):
    id: str
    code: str
    name: str
    ward: str
    description: Optional[str] = None
    risk_band: str = "moderate"
    risk_score: int = 50
    confidence: str = "moderate"
    latitude: float
    longitude: float
    svg_polygon: Optional[str] = None
    active_reports_count: int = 0
    has_recurrence_flag: bool = False
    terrain_factor: Optional[str] = None
    drainage_nallah: Optional[str] = None
    risk_factors: Optional[Dict[str, Any]] = None
    missing_signals: Optional[List[str]] = None


class ZoneRead(ZoneBase):
    created_at: datetime
    updated_at: datetime

    # Frontend compatibility fields
    zone_id: str = ""
    coordinates: List[float] = []
    svgPolygon: str = ""

    @model_validator(mode="after")
    def populate_frontend_aliases(self) -> "ZoneRead":
        self.zone_id = self.id
        self.coordinates = [self.latitude, self.longitude]
        self.svgPolygon = self.svg_polygon or ""
        return self

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Incident Schemas
# ==========================================

class IncidentBase(BaseModel):
    zone_id: str
    location_name: str
    latitude: float
    longitude: float
    category: str
    severity: str = "unassessed"
    status: str = "New"
    report_source: str = "WhatsApp Citizen Inflow"
    data_status: str = "Observed"
    report_count: int = 1
    image_url: Optional[str] = None
    image_caption: Optional[str] = None
    reporter_summary: Optional[str] = None
    notes: Optional[str] = None
    review_notes: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_uncertainty_notes: Optional[str] = None
    duplicate_group_id: Optional[str] = None
    has_recurrence_flag: bool = False
    recurrence_details: Optional[Dict[str, Any]] = None
    raw_message_id: Optional[str] = None


class IncidentCreate(BaseModel):
    zone_id: str
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    category: str
    severity: Optional[str] = None
    visual_severity: Optional[str] = None
    status: Optional[str] = None
    review_state: Optional[str] = None
    report_source: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    image_caption: Optional[str] = None
    reporter_summary: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_uncertainty_notes: Optional[str] = None
    report_count: Optional[int] = 1
    data_status: Optional[str] = "Observed"
    raw_message_id: Optional[str] = None



class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    review_state: Optional[str] = None
    review_notes: Optional[str] = None
    has_recurrence_flag: Optional[bool] = None
    recurrence_details: Optional[Dict[str, Any]] = None


class IncidentRead(IncidentBase):
    id: str
    reported_at: datetime
    created_at: datetime
    updated_at: datetime

    # Frontend compatibility fields
    incident_id: str = ""
    coordinates: List[float] = []
    timestamp: str = ""
    relative_time: str = ""
    visual_severity: str = ""
    review_state: str = ""
    source: str = ""

    @model_validator(mode="after")
    def populate_frontend_aliases(self) -> "IncidentRead":
        self.incident_id = self.id
        self.coordinates = [self.latitude, self.longitude]
        self.timestamp = self.reported_at.isoformat()
        self.relative_time = format_relative_time(self.reported_at)
        self.visual_severity = self.severity
        self.review_state = self.status
        self.source = self.report_source
        return self

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Maintenance Action Schemas
# ==========================================

class MaintenanceActionBase(BaseModel):
    zone_id: str
    incident_id: Optional[str] = None
    location_name: str
    action_type: str
    supervisor: str
    status: str = "Completed & Verified"
    work_notes: Optional[str] = None
    verification_status: bool = True
    data_status: str = "Observed"
    cost_estimate: Optional[float] = None
    completed_at: Optional[datetime] = None


class MaintenanceActionCreate(BaseModel):
    zone_id: str
    incident_id: Optional[str] = None
    location_name: Optional[str] = None
    action_type: str
    supervisor: Optional[str] = None
    actor: Optional[str] = None
    work_notes: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "Completed & Verified"
    verification_status: Optional[bool] = True
    cost_estimate: Optional[float] = None
    data_status: Optional[str] = "Observed"


class MaintenanceActionRead(MaintenanceActionBase):
    id: str
    created_at: datetime

    # Frontend compatibility fields
    action_id: str = ""
    actor: str = ""
    notes: str = ""

    @model_validator(mode="after")
    def populate_frontend_aliases(self) -> "MaintenanceActionRead":
        self.action_id = self.id
        self.actor = self.supervisor
        self.notes = self.work_notes or ""
        return self

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Operational Queue & History Schemas
# ==========================================

class RegionalWeatherUrgency(BaseModel):
    urgency_band: str  # 'Low' | 'Moderate' | 'Elevated' | 'Critical' | 'Unavailable'
    urgency_score: Optional[int] = None  # None when Unavailable, otherwise 0 to 100
    recent_6h_volume_mm: Optional[float] = None
    forecast_6h_volume_mm: Optional[float] = None
    current_intensity_mm_hr: Optional[float] = None
    peak_forecast_intensity_mm_hr: Optional[float] = None
    weather_status: str  # 'Current' | 'Stale' | 'Forecast-Derived' | 'Simulated' | 'Unavailable'
    weather_source: str = "Open-Meteo Best Match"
    weather_timestamp: Optional[str] = None
    retrieval_timestamp: Optional[str] = None
    urgency_rationale: str
    is_shared_regional_signal: bool = True
    cluster_scope_note: str = "Regional ~0.1° (~11 km) grid encompasses the pilot cluster uniformly."
    confidence: str = "High"  # 'High' | 'Moderate' | 'Low' | 'None'
    confidence_limitations: List[str] = Field(default_factory=list)


class QueueItemRead(BaseModel):
    rank: int
    hotspot_id: str
    zone_id: str
    location_name: str
    risk_band: str
    issue_type: str
    report_count: int
    corroboration_summary: str
    latest_report_time: str
    suggested_action: str
    status: str
    ranking_reasons: List[str]
    has_recurrence: bool

    # Explainable prioritisation additions
    priority_score: Optional[int] = None
    priority_band: Optional[str] = None
    action_rationale: Optional[str] = None
    factors: Optional[Dict[str, Any]] = None
    regional_weather: Optional[RegionalWeatherUrgency] = None
    missing_inputs: Optional[List[str]] = None
    provenance: Optional[Dict[str, Any]] = None


class PriorityEvaluationRead(BaseModel):
    zone_id: str
    zone_name: str
    ward: str
    priority_score: int
    priority_band: str
    risk_score: int
    risk_band: str
    suggested_action: str
    action_rationale: str
    has_recurrence: bool
    active_incidents_count: int
    total_incidents_count: int
    total_reports_count: int
    ranking_reasons: List[str]
    factors: Dict[str, Any]
    regional_weather: Optional[RegionalWeatherUrgency] = None
    missing_inputs: List[str]
    provenance: Dict[str, str]
    engine_version: str
    evaluated_at: str


class ActionOverride(BaseModel):
    action_type: Optional[str] = None
    estimated_cost: Optional[float] = None
    staff_hours: Optional[float] = None


class ResourceScenarioRequest(BaseModel):
    available_budget: float = Field(default=50000.0, ge=0.0, description="Available intervention budget in INR")
    available_crews: int = Field(default=3, ge=0, description="Available municipal field crews")
    max_staff_hours: float = Field(default=120.0, ge=0.0, description="Maximum total staff hours available")
    candidate_zone_ids: Optional[List[str]] = None
    action_overrides: Optional[Dict[str, ActionOverride]] = None


class SelectedIntervention(BaseModel):
    rank: int
    zone_id: str
    zone_name: str
    ward: str
    priority_score: int
    priority_band: str
    action_type: str
    estimated_cost: float
    staff_hours: float
    rationale: str
    selection_reason: str


class UnselectedIntervention(BaseModel):
    rank: int
    zone_id: str
    zone_name: str
    priority_score: int
    priority_band: str
    action_type: str
    estimated_cost: float
    staff_hours: float
    shortfall_reason: str


class ScenarioInputs(BaseModel):
    available_budget: float
    available_crews: int
    max_staff_hours: float
    candidate_zones_count: int


class ScenarioResults(BaseModel):
    selected_interventions: List[SelectedIntervention]
    unselected_interventions: List[UnselectedIntervention]
    total_selected_count: int
    total_unselected_count: int
    total_estimated_cost: float
    remaining_budget: float
    total_staff_hours_used: float
    remaining_staff_hours: float
    estimated_crews_utilized: float


class ResourceScenarioResponse(BaseModel):
    scenario_inputs: ScenarioInputs
    scenario_results: ScenarioResults
    engine_assumptions: List[str]
    calculated_at: str


class ZoneHistoryRead(BaseModel):
    zone_id: str
    zone_name: str
    incidents: List[IncidentRead]
    maintenance: List[MaintenanceActionRead]


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    database: str
    version: str
    mode: str


# ==========================================
# Weather / Rainfall Schemas (v4)
# ==========================================

class HourlyPrecipitationItem(BaseModel):
    time: str
    timestamp_iso: str
    precipitation_mm: float
    rain_mm: float
    precipitation_probability: Optional[float] = None
    is_forecast: bool
    relative_time_label: Optional[str] = None


class RainfallCurrentResponse(BaseModel):
    zone_id: Optional[str] = None
    provider: str = "Open-Meteo"
    provider_model: str = "Open-Meteo Best Match (Operational Composite)"
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    retrieved_at: str
    provider_timestamp: str
    current_precipitation_mm: float
    current_rain_mm: float
    current_weather_code: Optional[int] = None
    weather_description: str = "Clear / Dry"
    units: Dict[str, str] = Field(default_factory=dict)
    data_status: str = "Weather Model"
    provenance_text: str = "Open-Meteo Best Match Operational NWP"
    is_simulated: bool = False
    is_cached: bool = False
    cache_age_seconds: int = 0
    is_stale: bool = False
    spatial_coverage_notes: str = ""


class RainfallHistoryResponse(BaseModel):
    zone_id: Optional[str] = None
    provider: str = "Open-Meteo"
    provider_model: str = "Open-Meteo Best Match (Operational Composite)"
    latitude: float
    longitude: float
    retrieved_at: str
    provider_timestamp: str
    data_status: str = "Weather Model"
    provenance_text: str = "Open-Meteo Best Match Operational NWP"
    is_simulated: bool = False
    is_cached: bool = False
    is_stale: bool = False
    units: Dict[str, str] = Field(default_factory=dict)
    spatial_coverage_notes: str = ""
    past_records: List[HourlyPrecipitationItem]
    forecast_records: List[HourlyPrecipitationItem]
    total_past_rainfall_mm: float
    peak_precipitation_mm: float
    current_intensity_mm_hr: float


# ==========================================
# Autonomous Source Registry & Ingestion Schemas (v1)
# ==========================================

class SourceRead(BaseModel):
    id: str
    name: str
    provider: str
    category: str
    endpoint_url: Optional[str] = None
    geographic_coverage: str
    access_method: str
    attribution: str
    license: str
    collection_interval_seconds: Optional[int] = None
    is_enabled: bool
    status: str
    last_attempt_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    last_data_timestamp: Optional[str] = None
    records_retrieved: int = 0
    records_inserted: int = 0
    records_updated: int = 0
    records_rejected: int = 0
    records_unchanged: int = 0
    error_summary: Optional[str] = None
    limitations: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    
    # Computed / convenience fields
    data_age_seconds: Optional[int] = None
    data_age_label: Optional[str] = None

    @model_validator(mode="after")
    def compute_data_age(self) -> "SourceRead":
        if self.last_success_at:
            now = datetime.now(timezone.utc)
            dt = self.last_success_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            diff = now - dt
            seconds = max(0, int(diff.total_seconds()))
            self.data_age_seconds = seconds
            self.data_age_label = format_relative_time(dt)
        return self

    model_config = ConfigDict(from_attributes=True)


class IngestionRunRead(BaseModel):
    id: int
    source_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    records_retrieved: int = 0
    records_inserted: int = 0
    records_updated: int = 0
    records_rejected: int = 0
    records_unchanged: int = 0
    error_message: Optional[str] = None
    run_metadata: Optional[Dict[str, Any]] = None
    duration_seconds: Optional[float] = None

    @model_validator(mode="after")
    def compute_duration(self) -> "IngestionRunRead":
        if self.completed_at and self.started_at:
            st = self.started_at
            ct = self.completed_at
            if st.tzinfo is None:
                st = st.replace(tzinfo=timezone.utc)
            if ct.tzinfo is None:
                ct = ct.replace(tzinfo=timezone.utc)
            self.duration_seconds = max(0.0, round((ct - st).total_seconds(), 2))
        return self

    model_config = ConfigDict(from_attributes=True)


class SourceDetailRead(SourceRead):
    recent_runs: List[IngestionRunRead] = Field(default_factory=list)


class GeographicFeatureRead(BaseModel):
    id: int
    osm_type: str
    osm_id: int
    category: str
    feature_type: str
    name: Optional[str] = None
    geometry_type: str
    coordinates_json: Any
    tags: Dict[str, Any]
    source_attribution: str
    data_origin: str = "curated"
    import_timestamp: datetime
    last_updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SourceEvidenceRead(BaseModel):
    id: str
    source_id: str
    publisher: str
    canonical_url: Optional[str] = None
    publication_date: Optional[str] = None
    event_date: Optional[str] = None
    location_phrase: str
    evidence_text: str
    geographic_precision: str
    verification_status: str
    associated_zone_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CollectorStatusRead(BaseModel):
    worker_id: str
    is_running: bool
    last_heartbeat_at: Optional[datetime] = None
    heartbeat_age_seconds: Optional[int] = None
    heartbeat_status: str  # 'Healthy' | 'Stale' | 'Offline'
    active_job: Optional[str] = None
    next_scheduled_runs: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    pid: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class SourceRefreshResponse(BaseModel):
    source_id: str
    status: str
    message: str
    run_id: Optional[int] = None
    records_retrieved: int = 0
    records_inserted: int = 0
    records_updated: int = 0


# ==========================================
# WhatsApp Webhook & Citizen Reporting Schemas
# ==========================================

class WhatsAppInboundRead(BaseModel):
    id: str
    wa_id: Optional[str] = None
    sender_name: Optional[str] = None
    phone_number_id: Optional[str] = None
    message_type: str
    media_id: Optional[str] = None
    media_mime_type: Optional[str] = None
    media_caption: Optional[str] = None
    media_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None
    text_body: Optional[str] = None
    timestamp_provider: Optional[str] = None
    status: str
    incident_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WhatsAppWebhookResponse(BaseModel):
    status: str
    processed_count: int = 0
    duplicate_count: int = 0
    ignored_count: int = 0
    incident_ids: List[str] = Field(default_factory=list)
    message: Optional[str] = None


