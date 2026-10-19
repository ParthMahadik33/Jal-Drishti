from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from backend.database import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Zone(Base):
    __tablename__ = "zones"

    id = Column(String(32), primary_key=True)  # e.g. 'NZ-SAN-01'
    code = Column(String(32), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    ward = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    risk_band = Column(String(16), nullable=False, default="moderate")  # 'high', 'moderate', 'low', 'insufficient'
    risk_score = Column(Integer, nullable=False, default=50)
    confidence = Column(String(16), nullable=False, default="moderate")  # 'high', 'moderate', 'low'
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    svg_polygon = Column(Text, nullable=True)
    active_reports_count = Column(Integer, nullable=False, default=0)
    has_recurrence_flag = Column(Boolean, nullable=False, default=False)
    terrain_factor = Column(String(128), nullable=True)
    drainage_nallah = Column(String(128), nullable=True)
    risk_factors = Column(JSON, nullable=True)
    missing_signals = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    incidents = relationship("Incident", back_populates="zone", cascade="all, delete-orphan")
    maintenance_actions = relationship("MaintenanceAction", back_populates="zone", cascade="all, delete-orphan")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(32), primary_key=True)  # e.g. 'INC-2026-089'
    zone_id = Column(String(32), ForeignKey("zones.id", ondelete="CASCADE"), nullable=False, index=True)
    location_name = Column(String(128), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    reported_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    category = Column(String(64), nullable=False)
    severity = Column(String(16), nullable=False, default="unassessed")  # 'high', 'moderate', 'low', 'unassessed'
    status = Column(String(32), nullable=False, default="New")  # 'New', 'Needs Review', 'In Progress', 'Confirmed', 'Duplicate', 'Closed'
    report_source = Column(String(64), nullable=False, default="WhatsApp Citizen Inflow")
    data_status = Column(String(32), nullable=False, default="Observed")  # 'Observed', 'AI estimate', 'Inferred', 'Simulated', 'Published report'
    report_count = Column(Integer, nullable=False, default=1)
    image_url = Column(String(512), nullable=True)
    image_caption = Column(String(256), nullable=True)
    reporter_summary = Column(String(256), nullable=True)
    notes = Column(Text, nullable=True)
    review_notes = Column(Text, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    ai_uncertainty_notes = Column(Text, nullable=True)
    duplicate_group_id = Column(String(32), nullable=True)
    has_recurrence_flag = Column(Boolean, nullable=False, default=False)
    recurrence_details = Column(JSON, nullable=True)
    raw_message_id = Column(String(128), nullable=True, index=True)  # WhatsApp wamid or upstream ID
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    zone = relationship("Zone", back_populates="incidents")
    maintenance_actions = relationship("MaintenanceAction", back_populates="incident")



class MaintenanceAction(Base):
    __tablename__ = "maintenance_actions"

    id = Column(String(32), primary_key=True)  # e.g. 'MNT-2026-042'
    zone_id = Column(String(32), ForeignKey("zones.id", ondelete="CASCADE"), nullable=False, index=True)
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    location_name = Column(String(128), nullable=False)
    action_type = Column(String(64), nullable=False)  # 'Clean / Desilt', 'Culvert Clearing', 'Inspect', 'Pump Deployment', 'Engineering Assessment', 'Monitor'
    supervisor = Column(String(128), nullable=False)  # Actor / field lead
    status = Column(String(32), nullable=False, default="Completed & Verified")  # 'Completed & Verified', 'In Progress', 'Scheduled'
    work_notes = Column(Text, nullable=True)
    verification_status = Column(Boolean, nullable=False, default=True)
    data_status = Column(String(32), nullable=False, default="Observed")
    cost_estimate = Column(Float, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    zone = relationship("Zone", back_populates="maintenance_actions")
    incident = relationship("Incident", back_populates="maintenance_actions")


class RainfallObservationRecord(Base):
    __tablename__ = "rainfall_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String(32), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True)
    provider = Column(String(64), nullable=False, default="Open-Meteo")
    provider_model = Column(String(64), nullable=False, default="Open-Meteo Best Match (Operational Composite)")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation = Column(Float, nullable=True)
    retrieved_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    provider_timestamp = Column(String(64), nullable=False)
    current_precipitation_mm = Column(Float, nullable=False, default=0.0)
    current_rain_mm = Column(Float, nullable=False, default=0.0)
    current_weather_code = Column(Integer, nullable=True)
    hourly_records = Column(JSON, nullable=False)
    units = Column(JSON, nullable=False)
    data_status = Column(String(32), nullable=False, default="Weather Model")
    provenance_text = Column(String(256), nullable=False)
    spatial_coverage_notes = Column(Text, nullable=True)
    is_simulated = Column(Boolean, nullable=False, default=False)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)


# ==========================================
# Autonomous Source Registry & Ingestion Models (v1)
# ==========================================

class SourceRegistryRecord(Base):
    __tablename__ = "sources"

    id = Column(String(64), primary_key=True)  # e.g. 'open-meteo', 'osm-overpass'
    name = Column(String(128), nullable=False)
    provider = Column(String(128), nullable=False)
    category = Column(String(64), nullable=False)  # 'Weather', 'Geospatial', 'Historical News', 'Municipal Document', 'Basemap', 'Seed Data'
    endpoint_url = Column(String(512), nullable=True)
    geographic_coverage = Column(String(256), nullable=False)
    access_method = Column(String(64), nullable=False)  # 'REST API', 'Overpass API', 'Manual Curation', 'Vector Tile CDN'
    attribution = Column(String(256), nullable=False)
    license = Column(String(128), nullable=False)
    collection_interval_seconds = Column(Integer, nullable=True)
    is_enabled = Column(Boolean, nullable=False, default=True)
    status = Column(String(32), nullable=False, default="Registered")  # 'Registered', 'Reachable', 'Collecting', 'Active', 'Stale', 'Error', 'Disabled'
    
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    last_data_timestamp = Column(String(64), nullable=True)
    
    records_retrieved = Column(Integer, nullable=False, default=0)
    records_inserted = Column(Integer, nullable=False, default=0)
    records_updated = Column(Integer, nullable=False, default=0)
    records_rejected = Column(Integer, nullable=False, default=0)
    records_unchanged = Column(Integer, nullable=False, default=0)
    
    error_summary = Column(Text, nullable=True)
    limitations = Column(JSON, nullable=True)  # List of string limitations
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    ingestion_runs = relationship("IngestionRunRecord", back_populates="source", cascade="all, delete-orphan", order_by="desc(IngestionRunRecord.started_at)")
    evidence_records = relationship("SourceEvidenceRecord", back_populates="source", cascade="all, delete-orphan")


class IngestionRunRecord(Base):
    __tablename__ = "ingestion_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(64), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(32), nullable=False, default="In Progress")  # 'In Progress', 'Success', 'Partial', 'Failed'
    
    records_retrieved = Column(Integer, nullable=False, default=0)
    records_inserted = Column(Integer, nullable=False, default=0)
    records_updated = Column(Integer, nullable=False, default=0)
    records_rejected = Column(Integer, nullable=False, default=0)
    records_unchanged = Column(Integer, nullable=False, default=0)
    
    error_message = Column(Text, nullable=True)
    run_metadata = Column(JSON, nullable=True)

    source = relationship("SourceRegistryRecord", back_populates="ingestion_runs")


class GeographicFeature(Base):
    __tablename__ = "geographic_features"

    id = Column(Integer, primary_key=True, autoincrement=True)
    osm_type = Column(String(16), nullable=False)  # 'node', 'way', 'relation'
    osm_id = Column(Integer, nullable=False)  # Stable OSM element ID
    category = Column(String(64), nullable=False, index=True)  # 'highway', 'waterway', 'railway', 'amenity', 'drainage'
    feature_type = Column(String(64), nullable=False)  # 'primary', 'residential', 'stream', 'drain', 'hospital'
    name = Column(String(256), nullable=True)
    geometry_type = Column(String(32), nullable=False)  # 'Point', 'LineString', 'Polygon'
    coordinates_json = Column(JSON, nullable=False)  # GeoJSON coordinates [lng, lat] or [[lng, lat], ...]
    tags = Column(JSON, nullable=False)  # Original tags
    source_attribution = Column(String(128), nullable=False, default="OpenStreetMap contributors (ODbL)")
    data_origin = Column(String(32), nullable=False, default="curated")  # 'official', 'live-collected', 'curated'
    
    import_timestamp = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    last_updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("osm_type", "osm_id", name="uq_osm_element"),
    )


class SourceEvidenceRecord(Base):
    __tablename__ = "source_evidence"

    id = Column(String(64), primary_key=True)  # e.g. 'EVID-NEWS-001'
    source_id = Column(String(64), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    publisher = Column(String(128), nullable=False)
    canonical_url = Column(String(512), nullable=True)
    publication_date = Column(String(64), nullable=True)
    event_date = Column(String(64), nullable=True)
    location_phrase = Column(String(256), nullable=False)
    evidence_text = Column(Text, nullable=False)
    geographic_precision = Column(String(64), nullable=False, default="Approximate Area")
    verification_status = Column(String(64), nullable=False, default="Archival Record")
    associated_zone_id = Column(String(32), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    source = relationship("SourceRegistryRecord", back_populates="evidence_records")
    zone = relationship("Zone")


class CollectorHeartbeat(Base):
    __tablename__ = "collector_heartbeat"

    id = Column(Integer, primary_key=True, default=1)
    worker_id = Column(String(64), nullable=False, default="standalone-collector-1")
    is_running = Column(Boolean, nullable=False, default=True)
    last_heartbeat_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    active_job = Column(String(64), nullable=True)
    next_scheduled_runs = Column(JSON, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    pid = Column(Integer, nullable=True)


class WhatsAppInboundMessage(Base):
    __tablename__ = "whatsapp_inbound_messages"

    id = Column(String(128), primary_key=True)  # Provider message id (e.g. wamid.HBg...)
    wa_id = Column(String(64), nullable=True, index=True)  # Redacted / masked sender phone
    sender_name = Column(String(128), nullable=True)  # Profile display name
    phone_number_id = Column(String(64), nullable=True)  # Business recipient phone number id
    message_type = Column(String(32), nullable=False)  # 'text', 'image', 'location', 'unsupported'
    raw_payload = Column(JSON, nullable=True)
    media_id = Column(String(128), nullable=True)
    media_mime_type = Column(String(64), nullable=True)
    media_caption = Column(String(256), nullable=True)
    media_url = Column(String(512), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(256), nullable=True)
    location_address = Column(String(256), nullable=True)
    text_body = Column(Text, nullable=True)
    timestamp_provider = Column(String(32), nullable=True)
    status = Column(String(32), nullable=False, default="Processed")  # 'Processed', 'Duplicate', 'Ignored', 'Error'
    incident_id = Column(String(32), ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    incident = relationship("Incident", backref="whatsapp_inbound_records")


