import sys
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, func

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.models import (
    Zone,
    Incident,
    MaintenanceAction,
    SourceRegistryRecord,
    SourceEvidenceRecord,
    GeographicFeature,
    CollectorHeartbeat,
    WhatsAppInboundMessage,
)

def parse_iso(dt_str: str) -> datetime:
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)

INITIAL_ZONES = [
    {
        "id": "NZ-SAN-01",
        "code": "NZ-SAN-01",
        "name": "Sanpada Railway Underpass (Sector 4)",
        "ward": "Sanpada Ward C",
        "risk_band": "high",
        "risk_score": 88,
        "confidence": "high",
        "latitude": 19.0664,
        "longitude": 73.0092,
        "svg_polygon": "M 180,95 L 310,85 L 340,165 L 210,185 Z",
        "active_reports_count": 4,
        "has_recurrence_flag": True,
        "description": "Sub-grade railway vehicular underpass connecting Sanpada East to Palm Beach road. Natural stormwater bowl susceptible to rapid silt accumulation.",
        "terrain_factor": "Depression basin (-2.4m below surrounding grade)",
        "drainage_nallah": "Sanpada Central Storm Nallah #2 (Outfall via culvert B)",
        "risk_factors": {
            "rainfall_weight": 28,
            "recurrence_weight": 25,
            "terrain_weight": 20,
            "incident_evidence": 15,
            "infrastructure_context": 10,
        },
        "missing_signals": ["Tidal gate sensor feed (uncalibrated)"],
    },
    {
        "id": "NZ-NER-02",
        "code": "NZ-NER-02",
        "name": "Nerul Sector 19A Market Complex",
        "ward": "Nerul Ward D",
        "risk_band": "high",
        "risk_score": 79,
        "confidence": "high",
        "latitude": 19.0418,
        "longitude": 73.0185,
        "svg_polygon": "M 290,210 L 410,195 L 440,290 L 320,310 Z",
        "active_reports_count": 3,
        "has_recurrence_flag": False,
        "description": "High commercial footfall zone with covered box drains obstructed by market vendor debris and surface silt.",
        "terrain_factor": "Flat commercial precinct (0.8% slope toward arterial)",
        "drainage_nallah": "Nerul Ward D Box Culvert Line 4",
        "risk_factors": {
            "rainfall_weight": 26,
            "recurrence_weight": 18,
            "terrain_weight": 15,
            "incident_evidence": 12,
            "infrastructure_context": 8,
        },
        "missing_signals": [],
    },
    {
        "id": "NZ-NER-03",
        "code": "NZ-NER-03",
        "name": "Nerul MIDC Industrial Corridor (Road 2)",
        "ward": "Nerul Ward D",
        "risk_band": "moderate",
        "risk_score": 64,
        "confidence": "moderate",
        "latitude": 19.0345,
        "longitude": 73.0298,
        "svg_polygon": "M 430,280 L 560,265 L 590,360 L 460,375 Z",
        "active_reports_count": 2,
        "has_recurrence_flag": False,
        "description": "Industrial feeder road with heavy transport traffic. Open side drains experience localized backflow during peak convective spells.",
        "terrain_factor": "Mid-slope industrial plateau",
        "drainage_nallah": "MIDC Peripheral Drain Line A",
        "risk_factors": {
            "rainfall_weight": 22,
            "recurrence_weight": 14,
            "terrain_weight": 12,
            "incident_evidence": 10,
            "infrastructure_context": 6,
        },
        "missing_signals": ["Industrial discharge rate"],
    },
    {
        "id": "NZ-SAN-04",
        "code": "NZ-SAN-04",
        "name": "Palm Beach Rd - Sanpada Junction",
        "ward": "Sanpada Ward C",
        "risk_band": "moderate",
        "risk_score": 55,
        "confidence": "moderate",
        "latitude": 19.0582,
        "longitude": 73.0035,
        "svg_polygon": "M 100,190 L 220,180 L 250,270 L 130,285 Z",
        "active_reports_count": 2,
        "has_recurrence_flag": False,
        "description": "Arterial speedway junction. Lateral curb gutters overwhelmed by high-velocity surface runoff from flyover ramps.",
        "terrain_factor": "Curb elevation transition at flyover ramp base",
        "drainage_nallah": "Thane Creek Lateral Swale #1",
        "risk_factors": {
            "rainfall_weight": 20,
            "recurrence_weight": 12,
            "terrain_weight": 11,
            "incident_evidence": 7,
            "infrastructure_context": 5,
        },
        "missing_signals": ["Flyover runoff meter"],
    },
    {
        "id": "NZ-NER-05",
        "code": "NZ-NER-05",
        "name": "Nerul Sector 42 Nallah Buffer",
        "ward": "Nerul Ward D",
        "risk_band": "low",
        "risk_score": 28,
        "confidence": "high",
        "latitude": 19.0225,
        "longitude": 73.0112,
        "svg_polygon": "M 210,340 L 350,330 L 370,410 L 230,420 Z",
        "active_reports_count": 1,
        "has_recurrence_flag": False,
        "description": "Mangrove boundary buffer zone along high-capacity natural creek channel. Adequate gravitational discharge at current tide.",
        "terrain_factor": "Tidal mangrove marsh fringe",
        "drainage_nallah": "Nerul Creek Main Outfall (Flap Gate #3)",
        "risk_factors": {
            "rainfall_weight": 10,
            "recurrence_weight": 6,
            "terrain_weight": 5,
            "incident_evidence": 4,
            "infrastructure_context": 3,
        },
        "missing_signals": [],
    },
]

INITIAL_INCIDENTS = [
    {
        "id": "INC-2026-089",
        "zone_id": "NZ-SAN-01",
        "location_name": "Sanpada Railway Underpass (Sector 4)",
        "latitude": 19.0664,
        "longitude": 73.0092,
        "reported_at": parse_iso("2026-10-15T14:12:00Z"),
        "category": "Railway Underpass Inundation",
        "severity": "high",
        "status": "Needs Review",
        "report_source": "WhatsApp Citizen Inflow",
        "data_status": "AI estimate",
        "report_count": 4,
        "image_url": "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80",
        "image_caption": "Citizen photo: Underpass approach road with 35cm standing water stalling traffic",
        "reporter_summary": "Citizen via WhatsApp (+91 98*** ***12 - redacted)",
        "notes": "Recurrence event: Underpass drain cleared on Oct 12 under action MNT-2026-042. Waterlogging returned after 28mm convective rain.",
        "ai_confidence": 0.91,
        "ai_uncertainty_notes": "High confidence. Multiple angles show submerged curb and stranded auto-rickshaw. Water depth estimated at wheel-hub level (~30-40cm).",
        "has_recurrence_flag": True,
        "recurrence_details": {
            "prior_action_id": "MNT-2026-042",
            "prior_action_title": "Desilt Culvert / Clear Intake Grates",
            "prior_action_date": "Oct 12, 2026 (3 days ago)",
            "time_elapsed": "68 hours post-maintenance",
            "rule_explanation": "Incident reported in same underpass cell within 72h of recorded maintenance completion following a moderate rainfall spell (28 mm/hr). Suggests structural throat constraint or downstream creek backwater rather than simple surface trash grate blockage.",
            "status": "flagged",
        },
    },
    {
        "id": "INC-2026-088",
        "zone_id": "NZ-NER-02",
        "location_name": "Nerul Sector 19A Market Complex",
        "latitude": 19.0418,
        "longitude": 73.0185,
        "reported_at": parse_iso("2026-10-15T14:04:00Z"),
        "category": "Storm Drain Overflow",
        "severity": "high",
        "status": "New",
        "report_source": "WhatsApp Citizen Inflow",
        "data_status": "AI estimate",
        "report_count": 3,
        "image_url": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80",
        "image_caption": "Citizen photo: Water overflowing market pavement curbs toward storefronts",
        "reporter_summary": "Citizen via WhatsApp (+91 91*** ***44 - redacted)",
        "notes": "Surface runoff entering low-lying retail doorways along Lane 3.",
        "ai_confidence": 0.94,
        "ai_uncertainty_notes": "Visual inspection model identified overflowing box drain inlet clogged with vegetable crates and plastic wrap.",
        "has_recurrence_flag": False,
        "recurrence_details": None,
    },
    {
        "id": "INC-2026-084",
        "zone_id": "NZ-NER-03",
        "location_name": "Nerul MIDC Industrial Corridor (Road 2)",
        "latitude": 19.0345,
        "longitude": 73.0298,
        "reported_at": parse_iso("2026-10-15T13:28:00Z"),
        "category": "Carriageway Waterlogging",
        "severity": "moderate",
        "status": "In Progress",
        "report_source": "WhatsApp Citizen Inflow",
        "data_status": "AI estimate",
        "report_count": 2,
        "image_url": "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80",
        "image_caption": "Citizen photo: Left carriageway submerged up to median curb",
        "reporter_summary": "Transporter via WhatsApp (+91 97*** ***89 - redacted)",
        "notes": "Assigned to Ward D Quick Response Team for suction pump dispatch.",
        "ai_confidence": 0.82,
        "ai_uncertainty_notes": "Moderate confidence. Water pooling across 2 lanes of commercial carriageway. Heavy vehicles passing with moderate spray.",
        "has_recurrence_flag": False,
        "recurrence_details": None,
    },
    {
        "id": "INC-2026-081",
        "zone_id": "NZ-SAN-04",
        "location_name": "Palm Beach Rd - Sanpada Junction",
        "latitude": 19.0582,
        "longitude": 73.0035,
        "reported_at": parse_iso("2026-10-15T12:45:00Z"),
        "category": "Lateral Gutter Overflow",
        "severity": "moderate",
        "status": "Confirmed",
        "report_source": "WhatsApp Citizen Inflow",
        "data_status": "AI estimate",
        "report_count": 2,
        "image_url": "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=600&q=80",
        "image_caption": "Citizen photo: Surface runoff sheet across Palm Beach speed lane",
        "reporter_summary": "Commuter via WhatsApp (+91 99*** ***50 - redacted)",
        "notes": "Traffic police advisory issued. Road safety barricades placed.",
        "ai_confidence": 0.79,
        "ai_uncertainty_notes": "Runoff accumulating along high-speed deceleration lane. Water film 5-10cm causing hydroplaning hazard.",
        "has_recurrence_flag": False,
        "recurrence_details": None,
    },
    {
        "id": "INC-2026-075",
        "zone_id": "NZ-NER-05",
        "location_name": "Nerul Sector 42 Nallah Buffer",
        "latitude": 19.0225,
        "longitude": 73.0112,
        "reported_at": parse_iso("2026-10-15T10:15:00Z"),
        "category": "High Tide Nallah Monitoring",
        "severity": "low",
        "status": "Closed",
        "report_source": "Field Inspector Log",
        "data_status": "Observed",
        "report_count": 1,
        "image_url": "https://images.unsplash.com/photo-1508873696983-2df5293cb395?auto=format&fit=crop&w=600&q=80",
        "image_caption": "Inspector photo: Flap gate discharge into creek channel operating smoothly",
        "reporter_summary": "NMMC Field Ward Inspector S. Shinde",
        "notes": "Routine high-tide check completed. Silt trap functioning satisfactorily.",
        "ai_confidence": 0.88,
        "ai_uncertainty_notes": "High confidence. Nallah water level at 65% capacity. Flap gates operating normally with no overtopping.",
        "has_recurrence_flag": False,
        "recurrence_details": None,
    },
    {
        "id": "INC-2026-068",
        "zone_id": "NZ-SAN-01",
        "location_name": "Sanpada Sector 3 (Approximate - Missing GPS)",
        "latitude": 19.068,
        "longitude": 73.012,
        "reported_at": parse_iso("2026-10-15T09:40:00Z"),
        "category": "Unverified Location Waterlogging",
        "severity": "moderate",
        "status": "Needs Review",
        "report_source": "WhatsApp Citizen Inflow",
        "data_status": "Inferred",
        "report_count": 1,
        "image_url": "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80",
        "image_caption": "Citizen photo: Residential lane pooling without exact geotag metadata",
        "reporter_summary": "Citizen via WhatsApp (+91 93*** ***77 - redacted)",
        "notes": "Awaiting citizen clarification or roving ward patrol confirmation.",
        "ai_confidence": 0.52,
        "ai_uncertainty_notes": "Low confidence / Location uncertain. WhatsApp user shared photo without live GPS pin. Approximate cell tagged based on text landmark mention.",
        "has_recurrence_flag": False,
        "recurrence_details": None,
    },
    {
        "id": "INC-2026-065",
        "zone_id": "NZ-NER-02",
        "location_name": "Nerul Station West Crossway",
        "latitude": 19.043,
        "longitude": 73.017,
        "reported_at": parse_iso("2026-10-15T08:55:00Z"),
        "category": "Pedestrian Subway Waterlogging",
        "severity": "moderate",
        "status": "Duplicate",
        "report_source": "WhatsApp Citizen Inflow",
        "data_status": "AI estimate",
        "report_count": 3,
        "image_url": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80",
        "image_caption": "Duplicate cluster: Station subway staircase ingress",
        "reporter_summary": "3 independent citizens merged into Duplicate Group #D-14",
        "notes": "Merged into primary incident record INC-2026-088.",
        "ai_confidence": 0.90,
        "ai_uncertainty_notes": "Duplicate group #D-14: 3 separate photos of the same subway staircase matched by feature similarity.",
        "duplicate_group_id": "D-14",
        "has_recurrence_flag": False,
        "recurrence_details": None,
    },
]

INITIAL_MAINTENANCE = [
    {
        "id": "MNT-2026-042",
        "zone_id": "NZ-SAN-01",
        "incident_id": "INC-2026-089",  # linked to Sanpada underpass
        "location_name": "Sanpada Railway Underpass (Sector 4)",
        "action_type": "Clean / Desilt",
        "supervisor": "Divisional Engineer R. Kadam (NMMC Zone 4)",
        "status": "Completed & Verified",
        "created_at": parse_iso("2026-10-12T10:00:00Z"),
        "completed_at": parse_iso("2026-10-12T15:30:00Z"),
        "work_notes": "Desilted 1.8 metric tonnes of sediment and plastic debris from stormwater sump grates. Gravity drainage tested clear at conclusion of work.",
        "verification_status": True,
        "data_status": "Demo action",
        "cost_estimate": 45000.0,
    },
    {
        "id": "MNT-2026-039",
        "zone_id": "NZ-NER-03",
        "incident_id": "INC-2026-084",
        "location_name": "Nerul MIDC Industrial Corridor (Road 2)",
        "action_type": "Culvert Clearing",
        "supervisor": "Supervisor V. Patil (Roads & Drainage)",
        "status": "Completed & Verified",
        "created_at": parse_iso("2026-10-10T09:15:00Z"),
        "completed_at": parse_iso("2026-10-10T14:00:00Z"),
        "work_notes": "Cleared concrete washout sediment from lateral culvert opening #4.",
        "verification_status": True,
        "data_status": "Demo action",
        "cost_estimate": 28000.0,
    },
    {
        "id": "MNT-2026-035",
        "zone_id": "NZ-NER-02",
        "incident_id": "INC-2026-088",
        "location_name": "Nerul Sector 19A Market Complex",
        "action_type": "Inspect",
        "supervisor": "Contract Crew B (NMMC Sanitation)",
        "status": "Completed & Verified",
        "created_at": parse_iso("2026-10-08T11:00:00Z"),
        "completed_at": parse_iso("2026-10-08T13:45:00Z"),
        "work_notes": "Removed vegetable waste blockage from surface grating. Recommended solid-waste enforcement.",
        "verification_status": True,
        "data_status": "Demo action",
        "cost_estimate": 15000.0,
    },
]


INITIAL_SOURCES = [
    {
        "id": "open-meteo",
        "name": "Open-Meteo Weather Model & Observations",
        "provider": "Open-Meteo NWP Consortium",
        "category": "Weather",
        "endpoint_url": "https://api.open-meteo.com/v1/forecast",
        "geographic_coverage": "Nerul–Sanpada Pilot Cluster (19.045°N, 73.015°E)",
        "access_method": "REST API",
        "attribution": "Weather data by Open-Meteo.com (CC-BY 4.0)",
        "license": "Creative Commons Attribution 4.0 International",
        "collection_interval_seconds": 1800,  # 30 minutes
        "is_enabled": True,
        "status": "Active",
        "limitations": [
            "Resolution ~0.1° (~11 km) provides cluster-level atmospheric signal, not individual gutter gauges.",
            "Forecast precipitation subject to numerical weather prediction uncertainty."
        ],
    },
    {
        "id": "osm-overpass",
        "name": "OpenStreetMap Pilot Infrastructure & Drainage",
        "provider": "OpenStreetMap Contributors",
        "category": "Geospatial",
        "endpoint_url": "https://overpass-api.de/api/interpreter",
        "geographic_coverage": "Nerul–Sanpada Bounding Box [73.000, 19.020, 73.035, 19.075]",
        "access_method": "Overpass API",
        "attribution": "Map data © OpenStreetMap contributors (ODbL 1.0)",
        "license": "Open Database License 1.0 (ODbL)",
        "collection_interval_seconds": 86400,  # Daily (24h)
        "is_enabled": True,
        "status": "Active",
        "limitations": [
            "Crowdsourced coverage; underground stormwater piping is only mapped where surveyed by contributors.",
            "Missing OSM feature does not imply real-world absence."
        ],
    },
    {
        "id": "nmmc-disaster-plan",
        "name": "NMMC Monsoon Disaster Management & Outfalls Audit",
        "provider": "Navi Mumbai Municipal Corporation (NMMC)",
        "category": "Municipal Document",
        "endpoint_url": "https://www.nmmc.gov.in/disaster-management",
        "geographic_coverage": "Zone 1 (Vashi, Sanpada, Nerul, Belapur)",
        "access_method": "Manual Curation",
        "attribution": "Official NMMC Disaster Cell Publications",
        "license": "Public Municipal Notice / Right to Information",
        "collection_interval_seconds": None,  # Curated manual
        "is_enabled": True,
        "status": "Verified",
        "limitations": [
            "Updated seasonally prior to June monsoon onset.",
            "Provides ward-level depression basin classifications and culvert outfall inventories."
        ],
    },
    {
        "id": "news-waterlogging-archive",
        "name": "Navi Mumbai Monsoon Waterlogging Press Archive",
        "provider": "National & Regional Daily Publications (The Hindu, TOI, HT)",
        "category": "Historical News",
        "endpoint_url": "https://www.thehindu.com",
        "geographic_coverage": "Sanpada Subway, Palm Beach Corridor & Nerul Arterials",
        "access_method": "Manual Curation",
        "attribution": "Published investigative journalism and citizen reporting",
        "license": "Curated press excerpts / Fair use documentation",
        "collection_interval_seconds": None,  # Curated manual
        "is_enabled": True,
        "status": "Verified",
        "limitations": [
            "News articles describe corridor-level inundation and traffic halt, not verified millimetric depth.",
            "Area-level evidence kept distinct from GPS-verified citizen reports."
        ],
    },
    {
        "id": "carto-positron",
        "name": "CARTO Positron Vector Basemap Service",
        "provider": "CARTO / OpenStreetMap",
        "category": "Basemap",
        "endpoint_url": "https://carto.com/basemaps",
        "geographic_coverage": "Global (Local view centered on Navi Mumbai)",
        "access_method": "Vector Tile CDN",
        "attribution": "© CARTO, © OpenStreetMap contributors",
        "license": "CARTO Basemap Terms of Service",
        "collection_interval_seconds": None,  # CDN basemap layer
        "is_enabled": True,
        "status": "Operational",
        "limitations": [
            "Basemap vector styling tile layer. No structured municipal asset polling."
        ],
    },
    {
        "id": "seed-fixtures",
        "name": "JalDrishti Pilot Seed Fixtures (Baseline)",
        "provider": "JalDrishti Engineering Team",
        "category": "Seed Data",
        "endpoint_url": "local://backend/seed.py",
        "geographic_coverage": "Nerul & Sanpada 5 Core Pilot Zones",
        "access_method": "Local SQLite Database",
        "attribution": "JalDrishti Pilot Baseline Fixtures",
        "license": "Internal Project Fixture",
        "collection_interval_seconds": None,
        "is_enabled": True,
        "status": "Active",
        "limitations": [
            "Illustrative pilot fixtures for municipal workflow testing.",
            "Clearly separated from real crowdsourced citizen submissions."
        ],
    },
]

INITIAL_EVIDENCE = [
    {
        "id": "EVID-NEWS-001",
        "source_id": "news-waterlogging-archive",
        "publisher": "The Hindu",
        "canonical_url": "https://www.thehindu.com/news/cities/mumbai/navi-mumbai-waterlogging-subway-closed/article68412891.ece",
        "publication_date": "2024-07-14",
        "event_date": "2024-07-13",
        "location_phrase": "Sanpada railway vehicular subway near Sector 4",
        "evidence_text": "Severe waterlogging up to 2.5 feet caused vehicular traffic between Sanpada and Palm Beach Road to halt completely following continuous heavy spells coinciding with high tide.",
        "geographic_precision": "Corridor",
        "verification_status": "Archival Record",
        "associated_zone_id": "NZ-SAN-01",
    },
    {
        "id": "EVID-NEWS-002",
        "source_id": "news-waterlogging-archive",
        "publisher": "Times of India",
        "canonical_url": "https://timesofindia.indiatimes.com/city/navi-mumbai/monsoon-waterlogging-nerul-lp-junction/articleshow/101238491.cms",
        "publication_date": "2023-06-28",
        "event_date": "2023-06-27",
        "location_phrase": "Nerul LP Junction & Sector 19A Market Complex",
        "evidence_text": "Commercial market lanes submerged under knee-deep water due to choked roadside box drains and heavy silt accumulation, slowing traffic along Sion-Panvel Highway slip roads.",
        "geographic_precision": "Corridor",
        "verification_status": "Archival Record",
        "associated_zone_id": "NZ-NER-02",
    },
    {
        "id": "EVID-DOC-001",
        "source_id": "nmmc-disaster-plan",
        "publisher": "NMMC Engineering & Stormwater Department",
        "canonical_url": "https://www.nmmc.gov.in/drainage-pre-monsoon-audit-2025",
        "publication_date": "2025-05-18",
        "event_date": "2025-05-10",
        "location_phrase": "Sanpada Central Storm Nallah #2 Outfall",
        "evidence_text": "Pre-monsoon engineering inspection noted that tidal flap gate #2 at the creek outlet required silt desilting and counterweight servicing to prevent seawater backflow into Sector 1 and 4 underpass sumps.",
        "geographic_precision": "Specific Outfall",
        "verification_status": "Official Plan",
        "associated_zone_id": "NZ-SAN-01",
    },
    {
        "id": "EVID-DOC-002",
        "source_id": "nmmc-disaster-plan",
        "publisher": "NMMC City Disaster Management Authority",
        "canonical_url": "https://www.nmmc.gov.in/disaster-management-hazard-zones",
        "publication_date": "2026-04-02",
        "event_date": "2026-04-01",
        "location_phrase": "MIDC Corridor culvert siphon at Nerul Sector 20",
        "evidence_text": "Identified as chronically vulnerable depression basin during convective rain exceeding 40mm/hr. Recommended standby diesel dewatering pump trailer deployment.",
        "geographic_precision": "Precinct",
        "verification_status": "Official Plan",
        "associated_zone_id": "NZ-NER-03",
    },
]

INITIAL_GEOGRAPHIC_FEATURES = [
    {
        "osm_type": "way",
        "osm_id": 101,
        "category": "highway",
        "feature_type": "trunk",
        "name": "Sion-Panvel Highway",
        "geometry_type": "LineString",
        "coordinates_json": [
            [73.0080, 19.0680],
            [73.0130, 19.0550],
            [73.0180, 19.0380],
            [73.0230, 19.0250]
        ],
        "tags": {"highway": "trunk", "ref": "NH 48", "lanes": "6", "surface": "asphalt"},
        "source_attribution": "OpenStreetMap contributors (ODbL)",
        "data_origin": "curated",
    },
    {
        "osm_type": "way",
        "osm_id": 102,
        "category": "highway",
        "feature_type": "primary",
        "name": "Palm Beach Road",
        "geometry_type": "LineString",
        "coordinates_json": [
            [73.0030, 19.0650],
            [73.0070, 19.0500],
            [73.0120, 19.0350],
            [73.0160, 19.0220]
        ],
        "tags": {"highway": "primary", "maxspeed": "70", "lanes": "6", "surface": "asphalt"},
        "source_attribution": "OpenStreetMap contributors (ODbL)",
        "data_origin": "curated",
    },
    {
        "osm_type": "way",
        "osm_id": 201,
        "category": "waterway",
        "feature_type": "stream",
        "name": "Sanpada Central Storm Nallah #2",
        "geometry_type": "LineString",
        "coordinates_json": [
            [73.0120, 19.0680],
            [73.0075, 19.0660],
            [73.0035, 19.0640]
        ],
        "tags": {"waterway": "stream", "tunnel": "culvert", "covered": "no"},
        "source_attribution": "OpenStreetMap contributors (ODbL)",
        "data_origin": "curated",
    },
    {
        "osm_type": "way",
        "osm_id": 202,
        "category": "waterway",
        "feature_type": "drain",
        "name": "Nerul Ward D Main Box Drain",
        "geometry_type": "LineString",
        "coordinates_json": [
            [73.0210, 19.0430],
            [73.0170, 19.0410],
            [73.0110, 19.0380]
        ],
        "tags": {"waterway": "drain", "drain": "box_culvert", "covered": "yes"},
        "source_attribution": "OpenStreetMap contributors (ODbL)",
        "data_origin": "curated",
    },
    {
        "osm_type": "way",
        "osm_id": 301,
        "category": "railway",
        "feature_type": "rail",
        "name": "Harbour Line Railway Corridor",
        "geometry_type": "LineString",
        "coordinates_json": [
            [73.0090, 19.0690],
            [73.0125, 19.0580],
            [73.0160, 19.0420],
            [73.0195, 19.0300]
        ],
        "tags": {"railway": "rail", "usage": "main", "electrified": "contact_line"},
        "source_attribution": "OpenStreetMap contributors (ODbL)",
        "data_origin": "curated",
    },
    {
        "osm_type": "node",
        "osm_id": 401,
        "category": "amenity",
        "feature_type": "hospital",
        "name": "Dr. D.Y. Patil Hospital & Medical College",
        "geometry_type": "Point",
        "coordinates_json": [73.0235, 19.0435],
        "tags": {"amenity": "hospital", "emergency": "yes", "healthcare": "hospital"},
        "source_attribution": "OpenStreetMap contributors (ODbL)",
        "data_origin": "curated",
    },
    {
        "osm_type": "node",
        "osm_id": 402,
        "category": "amenity",
        "feature_type": "fire_station",
        "name": "NMMC Fire Station (Sanpada/Vashi)",
        "geometry_type": "Point",
        "coordinates_json": [73.0112, 19.0620],
        "tags": {"amenity": "fire_station", "operator": "NMMC"},
        "source_attribution": "OpenStreetMap contributors (ODbL)",
        "data_origin": "curated",
    },
    {
        "osm_type": "node",
        "osm_id": 501,
        "category": "drainage",
        "feature_type": "outfall",
        "name": "NMMC Outfall Flap Gate #4 into Creek",
        "geometry_type": "Point",
        "coordinates_json": [73.0035, 19.0675],
        "tags": {"man_made": "outfall", "waterway": "outfall", "tidal": "yes"},
        "source_attribution": "OpenStreetMap contributors (ODbL)",
        "data_origin": "curated",
    },
]


def reset_demo_fixtures(db: Session) -> dict:
    """
    Safely resets demonstration fixtures to their deterministic baseline while
    strictly preserving operational data created through normal application workflows.

    Preservation guarantees:
    - Operational maintenance actions (data_status != 'Demo action', such as MNT-2026-048) are NEVER deleted.
    - Live collector heartbeats (worker PIDs), rainfall observations, and ingestion runs are NEVER deleted.
    - Operational / citizen-submitted incidents are NEVER deleted.
    - Ingested geographic features and inbound messages are NEVER deleted.
    """
    # 1. Reset maintenance demo fixtures only (preserve operational actions)
    demo_m_ids = {m["id"] for m in INITIAL_MAINTENANCE}
    db.query(MaintenanceAction).filter(
        (MaintenanceAction.data_status == "Demo action") | (MaintenanceAction.id.in_(demo_m_ids))
    ).delete(synchronize_session=False)

    for m_data in INITIAL_MAINTENANCE:
        db.add(MaintenanceAction(**m_data))

    # 2. Reset incident demo fixtures only (preserve operational/citizen reports)
    demo_inc_ids = {inc["id"] for inc in INITIAL_INCIDENTS}
    db.query(Incident).filter(
        Incident.id.in_(demo_inc_ids)
    ).delete(synchronize_session=False)

    for inc_data in INITIAL_INCIDENTS:
        db.add(Incident(**inc_data))

    # 3. Ensure zones exist
    existing_zones = set(db.execute(select(Zone.id)).scalars().all())
    for z_data in INITIAL_ZONES:
        if z_data["id"] not in existing_zones:
            db.add(Zone(**z_data))

    # 4. Ensure source registry exists
    existing_srcs = set(db.execute(select(SourceRegistryRecord.id)).scalars().all())
    for src_data in INITIAL_SOURCES:
        if src_data["id"] not in existing_srcs:
            db.add(SourceRegistryRecord(**src_data))

    # 5. Ensure evidence exists
    existing_ev = set(db.execute(select(SourceEvidenceRecord.id)).scalars().all())
    for ev_data in INITIAL_EVIDENCE:
        if ev_data["id"] not in existing_ev:
            db.add(SourceEvidenceRecord(**ev_data))

    # 6. Ensure default geographic features exist if missing
    existing_feat_count = db.execute(select(func.count(GeographicFeature.id))).scalar() or 0
    if existing_feat_count == 0:
        for feat_data in INITIAL_GEOGRAPHIC_FEATURES:
            db.add(GeographicFeature(**feat_data))

    # 7. Ensure collector heartbeat exists if missing (do not overwrite active running worker)
    existing_heartbeat = db.get(CollectorHeartbeat, 1)
    if not existing_heartbeat:
        db.add(CollectorHeartbeat(
            id=1,
            worker_id="standalone-collector-1",
            is_running=False,
            active_job=None,
            next_scheduled_runs={},
            pid=None,
        ))

    db.commit()

    total_maintenance = db.execute(select(func.count(MaintenanceAction.id))).scalar() or 0
    operational_maintenance = db.execute(
        select(func.count(MaintenanceAction.id)).where(MaintenanceAction.data_status != "Demo action")
    ).scalar() or 0

    return {
        "status": "ok",
        "demo_fixtures_reset": True,
        "total_maintenance_count": total_maintenance,
        "operational_maintenance_preserved": operational_maintenance,
    }


def seed_database(db: Session, force: bool = False, purge_all: bool = False) -> bool:
    """
    Seeds the database with standard pilot fixtures, source registry, and geographic features.
    Guarantees non-destructive, idempotent operation: checks each entity set independently.
    
    When force=True:
    - By default (purge_all=False), preserves operational maintenance actions (data_status != 'Demo action')
      and only resets demo fixtures.
    - purge_all=True is strictly reserved for test suite environment tear-down.
    """
    seeded_anything = False

    if force:
        if purge_all:
            # Full wipe strictly for test harness isolation
            db.query(WhatsAppInboundMessage).delete()
            db.query(CollectorHeartbeat).delete()
            db.query(GeographicFeature).delete()
            db.query(SourceEvidenceRecord).delete()
            db.query(SourceRegistryRecord).delete()
            db.query(MaintenanceAction).delete()
            db.query(Incident).delete()
            db.query(Zone).delete()
            db.commit()
        else:
            # Safe reset: strictly preserve operational maintenance actions and operational records
            demo_m_ids = {m["id"] for m in INITIAL_MAINTENANCE}
            db.query(MaintenanceAction).filter(
                (MaintenanceAction.data_status == "Demo action") | (MaintenanceAction.id.in_(demo_m_ids))
            ).delete(synchronize_session=False)

            demo_inc_ids = {inc["id"] for inc in INITIAL_INCIDENTS}
            db.query(Incident).filter(
                Incident.id.in_(demo_inc_ids)
            ).delete(synchronize_session=False)

            db.query(SourceEvidenceRecord).delete()
            db.query(SourceRegistryRecord).delete()
            # Do not delete running CollectorHeartbeat if running
            heartbeat = db.get(CollectorHeartbeat, 1)
            if heartbeat and not heartbeat.is_running:
                db.delete(heartbeat)
            db.commit()

    # 1. Seed Zones
    existing_zones = db.execute(select(Zone)).scalars().all()
    if not existing_zones or force:
        existing_zone_ids = {z.id for z in existing_zones}
        for z_data in INITIAL_ZONES:
            if z_data["id"] not in existing_zone_ids:
                db.add(Zone(**z_data))
        db.commit()
        seeded_anything = True

    # 2. Seed Incidents
    existing_incidents = db.execute(select(Incident)).scalars().all()
    if not existing_incidents or force:
        existing_inc_ids = {inc.id for inc in existing_incidents}
        for inc_data in INITIAL_INCIDENTS:
            if inc_data["id"] not in existing_inc_ids:
                db.add(Incident(**inc_data))
        db.commit()
        seeded_anything = True

    # 3. Seed Maintenance Actions
    existing_maintenance = db.execute(select(MaintenanceAction)).scalars().all()
    if not existing_maintenance or force:
        existing_m_ids = {m.id for m in existing_maintenance}
        for m_data in INITIAL_MAINTENANCE:
            if m_data["id"] not in existing_m_ids:
                db.add(MaintenanceAction(**m_data))
        db.commit()
        seeded_anything = True

    # 4. Seed Source Registry
    existing_sources = db.execute(select(SourceRegistryRecord)).scalars().all()
    if not existing_sources or force:
        existing_src_ids = {s.id for s in existing_sources}
        for src_data in INITIAL_SOURCES:
            if src_data["id"] not in existing_src_ids:
                db.add(SourceRegistryRecord(**src_data))
        db.commit()
        seeded_anything = True

    # 5. Seed Source Evidence
    existing_evidence = db.execute(select(SourceEvidenceRecord)).scalars().all()
    if not existing_evidence or force:
        for ev_data in INITIAL_EVIDENCE:
            db.add(SourceEvidenceRecord(**ev_data))
        db.commit()
        seeded_anything = True

    # 6. Seed Geographic Features
    existing_features = db.execute(select(GeographicFeature)).scalars().all()
    if not existing_features:
        for feat_data in INITIAL_GEOGRAPHIC_FEATURES:
            db.add(GeographicFeature(**feat_data))
        db.commit()
        seeded_anything = True

    # 7. Seed Collector Heartbeat row if missing
    existing_heartbeat = db.get(CollectorHeartbeat, 1)
    if not existing_heartbeat:
        db.add(CollectorHeartbeat(
            id=1,
            worker_id="standalone-collector-1",
            is_running=False,
            active_job=None,
            next_scheduled_runs={},
            pid=None,
        ))
        db.commit()
        seeded_anything = True

    return seeded_anything


if __name__ == "__main__":
    from backend.database import SessionLocal, Base, engine
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_database(session, force=False)
    print("Database seeding completed.")
