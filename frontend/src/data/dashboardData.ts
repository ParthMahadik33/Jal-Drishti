export interface PilotZone {
  zone_id: string;
  name: string;
  ward: string;
  risk_band: 'high' | 'moderate' | 'low' | 'insufficient';
  risk_score: number;
  confidence: 'high' | 'moderate' | 'low';
  coordinates: [number, number]; // [lat, lng]
  svgPolygon: string; // Coordinate path for SVG GIS renderer
  active_reports_count: number;
  has_recurrence_flag: boolean;
  description: string;
  terrain_factor: string;
  drainage_nallah: string;
  risk_factors: {
    rainfall_weight: number;
    recurrence_weight: number;
    terrain_weight: number;
    incident_evidence: number;
    infrastructure_context: number;
  };
  missing_signals: string[];
}

export interface IncidentRecord {
  incident_id: string;
  zone_id: string;
  location_name: string;
  coordinates: [number, number];
  timestamp: string;
  relative_time: string;
  category: string;
  visual_severity: 'high' | 'moderate' | 'low' | 'unassessed';
  ai_confidence: number;
  ai_uncertainty_notes: string;
  review_state: 'New' | 'Needs Review' | 'In Progress' | 'Confirmed' | 'Duplicate' | 'Closed';
  source: string;
  data_status: 'Observed' | 'Published report' | 'AI estimate' | 'Inferred' | 'Simulated';
  report_count: number;
  image_url: string;
  image_caption: string;
  reporter_summary: string;
  notes: string;
  duplicate_group_id?: string;
  has_recurrence_flag: boolean;
  recurrence_details?: {
    prior_action_id: string;
    prior_action_title: string;
    prior_action_date: string;
    time_elapsed: string;
    rule_explanation: string;
    rationale?: string;
    status: 'flagged' | 'confirmed' | 'dismissed';
  };
}

export interface MaintenanceAction {
  action_id: string;
  zone_id: string;
  incident_id?: string;
  location_name: string;
  action_type: 'Inspect' | 'Clean / Desilt' | 'Culvert Clearing' | 'Pump Deployment' | 'Engineering Assessment' | 'Monitor';
  actor: string;
  status: 'Completed & Verified' | 'In Progress' | 'Scheduled';
  created_at: string;
  completed_at?: string;
  notes: string;
  verification_status: boolean;
  data_status: 'Demo action' | 'Observed';
}

export interface FactorScore {
  score: number;
  max: number;
  weight_pct: number;
  rationale: string;
  [key: string]: unknown;
}

export interface RegionalWeatherUrgency {
  urgency_band: 'Low' | 'Moderate' | 'Elevated' | 'Critical';
  urgency_score: number;
  recent_6h_volume_mm: number;
  forecast_6h_volume_mm: number;
  current_intensity_mm_hr: number;
  peak_forecast_intensity_mm_hr: number;
  weather_status: 'Current' | 'Stale' | 'Forecast-Derived' | 'Simulated' | 'Unavailable';
  weather_source: string;
  weather_timestamp?: string | null;
  retrieval_timestamp?: string | null;
  urgency_rationale: string;
  is_shared_regional_signal: boolean;
  cluster_scope_note: string;
  confidence: 'High' | 'Moderate' | 'Low';
  confidence_limitations: string[];
}

export interface FactorBreakdown {
  severity: FactorScore & { high_count: number; moderate_count: number; low_count: number };
  recurrence: FactorScore & { has_recurrence: boolean };
  velocity_and_corroboration: FactorScore & { active_reports: number; total_reports: number };
  recency: FactorScore & { most_recent_time: string | null };
  regional_weather_urgency?: FactorScore & {
    urgency_band: string;
    weather_status: string;
    is_shared_regional_signal: boolean;
    recent_6h_volume_mm: number;
    forecast_6h_volume_mm: number;
    current_intensity_mm_hr: number;
  };
}

export interface PriorityEvaluation {
  zone_id: string;
  zone_name: string;
  ward: string;
  priority_score: number;
  priority_band: 'Urgent' | 'High' | 'Moderate' | 'Monitor';
  risk_score: number;
  risk_band: 'high' | 'moderate' | 'low';
  suggested_action: string;
  action_rationale: string;
  has_recurrence: boolean;
  active_incidents_count: number;
  total_incidents_count: number;
  total_reports_count: number;
  ranking_reasons: string[];
  factors: FactorBreakdown;
  regional_weather?: RegionalWeatherUrgency | null;
  missing_inputs: string[];
  provenance: Record<string, string>;
  engine_version: string;
  evaluated_at: string;
}

export interface SelectedIntervention {
  rank: number;
  zone_id: string;
  zone_name: string;
  ward: string;
  priority_score: number;
  priority_band: 'Urgent' | 'High' | 'Moderate' | 'Monitor';
  action_type: string;
  estimated_cost: number;
  staff_hours: number;
  rationale: string;
  selection_reason: string;
}

export interface UnselectedIntervention {
  rank: number;
  zone_id: string;
  zone_name: string;
  priority_score: number;
  priority_band: 'Urgent' | 'High' | 'Moderate' | 'Monitor';
  action_type: string;
  estimated_cost: number;
  staff_hours: number;
  shortfall_reason: string;
}

export interface ResourceScenarioRequest {
  available_budget: number;
  available_crews: number;
  max_staff_hours: number;
  candidate_zone_ids?: string[];
  action_overrides?: Record<string, { action_type?: string; estimated_cost?: number; staff_hours?: number }>;
}

export interface ResourceScenarioResponse {
  scenario_inputs: {
    available_budget: number;
    available_crews: number;
    max_staff_hours: number;
    candidate_zones_count: number;
  };
  scenario_results: {
    selected_interventions: SelectedIntervention[];
    unselected_interventions: UnselectedIntervention[];
    total_selected_count: number;
    total_unselected_count: number;
    total_estimated_cost: number;
    remaining_budget: number;
    total_staff_hours_used: number;
    remaining_staff_hours: number;
    estimated_crews_utilized: number;
  };
  engine_assumptions: string[];
  caveats: string[];
  simulated_at: string;
  engine_version: string;
}

export interface QueueItem {
  rank: number;
  hotspot_id: string;
  zone_id: string;
  location_name: string;
  risk_band: 'high' | 'moderate' | 'low';
  issue_type: string;
  report_count: number;
  corroboration_summary: string;
  latest_report_time: string;
  suggested_action: string;
  status: 'New' | 'Needs Review' | 'In Progress' | 'Escalated' | 'Closed';
  ranking_reasons: string[];
  has_recurrence: boolean;
  priority_score?: number;
  priority_band?: 'Urgent' | 'High' | 'Moderate' | 'Monitor';
  action_rationale?: string;
  factors?: FactorBreakdown;
  regional_weather?: RegionalWeatherUrgency | null;
  missing_inputs?: string[];
  provenance?: Record<string, string>;
  engine_version?: string;
  evaluated_at?: string;
}

export interface HourlyPrecipitationRecord {
  time: string;
  timestamp_iso: string;
  precipitation_mm: number;
  rain_mm: number;
  precipitation_probability?: number | null;
  is_forecast: boolean;
  relative_time_label?: string;
}

export interface WeatherSnapshot {
  zone_id?: string | null;
  provider: string;
  provider_model: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  retrieved_at: string;
  provider_timestamp: string;
  current_precipitation_mm: number;
  current_rain_mm: number;
  current_weather_code?: number | null;
  weather_description: string;
  units: Record<string, string>;
  data_status: string;
  provenance_text: string;
  is_simulated: boolean;
  is_cached: boolean;
  cache_age_seconds: number;
  is_stale: boolean;
  spatial_coverage_notes: string;
  past_records: HourlyPrecipitationRecord[];
  forecast_records: HourlyPrecipitationRecord[];
  total_past_rainfall_mm: number;
  peak_precipitation_mm: number;
  current_intensity_mm_hr: number;
}

export interface RainfallObservation {
  time: string;
  rainfall_mm: number;
  risk_index: number;
  source: string;
  data_status: 'Simulated' | 'Weather Model' | 'Observed';
  is_forecast?: boolean;
  timestamp_iso?: string;
  precipitation_probability?: number | null;
}

export interface AlertNotification {
  id: string;
  zone_id: string;
  title: string;
  message: string;
  level: 'high' | 'warning' | 'info';
  timestamp: string;
  read: boolean;
  action_url?: string;
}

// 5 Seeded Pilot Zones in Nerul & Sanpada (Navi Mumbai)
export const SEED_ZONES: PilotZone[] = [
  {
    zone_id: 'NZ-SAN-01',
    name: 'Sanpada Railway Underpass (Sector 4)',
    ward: 'Sanpada Ward C',
    risk_band: 'high',
    risk_score: 88,
    confidence: 'high',
    coordinates: [19.0664, 73.0092],
    svgPolygon: 'M 180,95 L 310,85 L 340,165 L 210,185 Z',
    active_reports_count: 4,
    has_recurrence_flag: true,
    description: 'Sub-grade railway vehicular underpass connecting Sanpada East to Palm Beach road. Natural stormwater bowl susceptible to rapid silt accumulation.',
    terrain_factor: 'Depression basin (-2.4m below surrounding grade)',
    drainage_nallah: 'Sanpada Central Storm Nallah #2 (Outfall via culvert B)',
    risk_factors: {
      rainfall_weight: 28,
      recurrence_weight: 25,
      terrain_weight: 20,
      incident_evidence: 15,
      infrastructure_context: 10,
    },
    missing_signals: ['Tidal gate sensor feed (uncalibrated)'],
  },
  {
    zone_id: 'NZ-NER-02',
    name: 'Nerul Sector 19A Market Complex',
    ward: 'Nerul Ward D',
    risk_band: 'high',
    risk_score: 79,
    confidence: 'high',
    coordinates: [19.0418, 73.0185],
    svgPolygon: 'M 290,210 L 410,195 L 440,290 L 320,310 Z',
    active_reports_count: 3,
    has_recurrence_flag: false,
    description: 'High commercial footfall zone with covered box drains obstructed by market vendor debris and surface silt.',
    terrain_factor: 'Flat commercial precinct (0.8% slope toward arterial)',
    drainage_nallah: 'Nerul Ward D Box Culvert Line 4',
    risk_factors: {
      rainfall_weight: 26,
      recurrence_weight: 18,
      terrain_weight: 15,
      incident_evidence: 12,
      infrastructure_context: 8,
    },
    missing_signals: [],
  },
  {
    zone_id: 'NZ-NER-03',
    name: 'Nerul MIDC Industrial Corridor (Road 2)',
    ward: 'Nerul Ward D',
    risk_band: 'moderate',
    risk_score: 64,
    confidence: 'moderate',
    coordinates: [19.0345, 73.0298],
    svgPolygon: 'M 430,280 L 560,265 L 590,360 L 460,375 Z',
    active_reports_count: 2,
    has_recurrence_flag: false,
    description: 'Industrial feeder road with heavy transport traffic. Open side drains experience localized backflow during peak convective spells.',
    terrain_factor: 'Mid-slope industrial plateau',
    drainage_nallah: 'MIDC Peripheral Drain Line A',
    risk_factors: {
      rainfall_weight: 22,
      recurrence_weight: 14,
      terrain_weight: 12,
      incident_evidence: 10,
      infrastructure_context: 6,
    },
    missing_signals: ['Industrial discharge rate'],
  },
  {
    zone_id: 'NZ-SAN-04',
    name: 'Palm Beach Rd - Sanpada Junction',
    ward: 'Sanpada Ward C',
    risk_band: 'moderate',
    risk_score: 55,
    confidence: 'moderate',
    coordinates: [19.0582, 73.0035],
    svgPolygon: 'M 100,190 L 220,180 L 250,270 L 130,285 Z',
    active_reports_count: 2,
    has_recurrence_flag: false,
    description: 'Arterial speedway junction. Lateral curb gutters overwhelmed by high-velocity surface runoff from flyover ramps.',
    terrain_factor: 'Curb elevation transition at flyover ramp base',
    drainage_nallah: 'Thane Creek Lateral Swale #1',
    risk_factors: {
      rainfall_weight: 20,
      recurrence_weight: 12,
      terrain_weight: 11,
      incident_evidence: 7,
      infrastructure_context: 5,
    },
    missing_signals: ['Flyover runoff meter'],
  },
  {
    zone_id: 'NZ-NER-05',
    name: 'Nerul Sector 42 Nallah Buffer',
    ward: 'Nerul Ward D',
    risk_band: 'low',
    risk_score: 28,
    confidence: 'high',
    coordinates: [19.0225, 73.0112],
    svgPolygon: 'M 210,340 L 350,330 L 370,410 L 230,420 Z',
    active_reports_count: 1,
    has_recurrence_flag: false,
    description: 'Mangrove boundary buffer zone along high-capacity natural creek channel. Adequate gravitational discharge at current tide.',
    terrain_factor: 'Tidal mangrove marsh fringe',
    drainage_nallah: 'Nerul Creek Main Outfall (Flap Gate #3)',
    risk_factors: {
      rainfall_weight: 10,
      recurrence_weight: 6,
      terrain_weight: 5,
      incident_evidence: 4,
      infrastructure_context: 3,
    },
    missing_signals: [],
  },
];

// Seeded Incidents with real photos and evidence trails
export const SEED_INCIDENTS: IncidentRecord[] = [
  {
    incident_id: 'INC-2026-089',
    zone_id: 'NZ-SAN-01',
    location_name: 'Sanpada Railway Underpass (Sector 4)',
    coordinates: [19.0664, 73.0092],
    timestamp: '2026-10-15T14:12:00Z',
    relative_time: '18m ago',
    category: 'Railway Underpass Inundation',
    visual_severity: 'high',
    ai_confidence: 0.91,
    ai_uncertainty_notes: 'High confidence. Multiple angles show submerged curb and stranded auto-rickshaw. Water depth estimated at wheel-hub level (~30-40cm).',
    review_state: 'Needs Review',
    source: 'Citizen Report (Demo Fixture)',
    data_status: 'AI estimate',
    report_count: 4,
    image_url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80',
    image_caption: 'Citizen photo: Underpass approach road with 35cm standing water stalling traffic',
    reporter_summary: 'Citizen report fixture (+91 98*** ***12 - demo)',
    notes: 'Recurrence event: Underpass drain cleared on Oct 12 under action MNT-2026-042. Waterlogging returned after 28mm convective rain.',
    has_recurrence_flag: true,
    recurrence_details: {
      prior_action_id: 'MNT-2026-042',
      prior_action_title: 'Desilt Culvert / Clear Intake Grates',
      prior_action_date: 'Oct 12, 2026 (3 days ago)',
      time_elapsed: '68 hours post-maintenance',
      rule_explanation: 'Incident reported in same underpass cell within 72h of recorded maintenance completion following a moderate rainfall spell (28 mm/hr). Suggests structural throat constraint or downstream creek backwater rather than simple surface trash grate blockage.',
      status: 'flagged',
    },
  },
  {
    incident_id: 'INC-2026-088',
    zone_id: 'NZ-NER-02',
    location_name: 'Nerul Sector 19A Market Complex',
    coordinates: [19.0418, 73.0185],
    timestamp: '2026-10-15T14:04:00Z',
    relative_time: '26m ago',
    category: 'Storm Drain Overflow',
    visual_severity: 'high',
    ai_confidence: 0.94,
    ai_uncertainty_notes: 'Visual inspection model identified overflowing box drain inlet clogged with vegetable crates and plastic wrap.',
    review_state: 'New',
    source: 'Citizen Report (Demo Fixture)',
    data_status: 'AI estimate',
    report_count: 3,
    image_url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80',
    image_caption: 'Citizen photo: Water overflowing market pavement curbs toward storefronts',
    reporter_summary: 'Citizen report fixture (+91 91*** ***44 - demo)',
    notes: 'Surface runoff entering low-lying retail doorways along Lane 3.',
    has_recurrence_flag: false,
  },
  {
    incident_id: 'INC-2026-084',
    zone_id: 'NZ-NER-03',
    location_name: 'Nerul MIDC Industrial Corridor (Road 2)',
    coordinates: [19.0345, 73.0298],
    timestamp: '2026-10-15T13:28:00Z',
    relative_time: '1h 02m ago',
    category: 'Carriageway Waterlogging',
    visual_severity: 'moderate',
    ai_confidence: 0.82,
    ai_uncertainty_notes: 'Moderate confidence. Water pooling across 2 lanes of commercial carriageway. Heavy vehicles passing with moderate spray.',
    review_state: 'In Progress',
    source: 'Citizen Report (Demo Fixture)',
    data_status: 'AI estimate',
    report_count: 2,
    image_url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80',
    image_caption: 'Citizen photo: Left carriageway submerged up to median curb',
    reporter_summary: 'Transporter report fixture (+91 97*** ***89 - demo)',
    notes: 'Assigned to Ward D Quick Response Team for suction pump dispatch.',
    has_recurrence_flag: false,
  },
  {
    incident_id: 'INC-2026-081',
    zone_id: 'NZ-SAN-04',
    location_name: 'Palm Beach Rd - Sanpada Junction',
    coordinates: [19.0582, 73.0035],
    timestamp: '2026-10-15T12:45:00Z',
    relative_time: '1h 45m ago',
    category: 'Lateral Gutter Overflow',
    visual_severity: 'moderate',
    ai_confidence: 0.79,
    ai_uncertainty_notes: 'Runoff accumulating along high-speed deceleration lane. Water film 5-10cm causing hydroplaning hazard.',
    review_state: 'Confirmed',
    source: 'Citizen Report (Demo Fixture)',
    data_status: 'AI estimate',
    report_count: 2,
    image_url: 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=600&q=80',
    image_caption: 'Citizen photo: Surface runoff sheet across Palm Beach speed lane',
    reporter_summary: 'Commuter report fixture (+91 99*** ***50 - demo)',
    notes: 'Traffic police advisory issued. Road safety barricades placed.',
    has_recurrence_flag: false,
  },
  {
    incident_id: 'INC-2026-075',
    zone_id: 'NZ-NER-05',
    location_name: 'Nerul Sector 42 Nallah Buffer',
    coordinates: [19.0225, 73.0112],
    timestamp: '2026-10-15T10:15:00Z',
    relative_time: '4h 15m ago',
    category: 'High Tide Nallah Monitoring',
    visual_severity: 'low',
    ai_confidence: 0.88,
    ai_uncertainty_notes: 'High confidence. Nallah water level at 65% capacity. Flap gates operating normally with no overtopping.',
    review_state: 'Closed',
    source: 'Field Inspector Log',
    data_status: 'Observed',
    report_count: 1,
    image_url: 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?auto=format&fit=crop&w=600&q=80',
    image_caption: 'Inspector photo: Flap gate discharge into creek channel operating smoothly',
    reporter_summary: 'NMMC Field Ward Inspector S. Shinde',
    notes: 'Routine high-tide check completed. Silt trap functioning satisfactorily.',
    has_recurrence_flag: false,
  },
  {
    incident_id: 'INC-2026-068',
    zone_id: 'NZ-SAN-01',
    location_name: 'Sanpada Sector 3 (Approximate - Missing GPS)',
    coordinates: [19.068, 73.012],
    timestamp: '2026-10-15T09:40:00Z',
    relative_time: '4h 50m ago',
    category: 'Unverified Location Waterlogging',
    visual_severity: 'moderate',
    ai_confidence: 0.52,
    ai_uncertainty_notes: 'Low confidence / Location uncertain. Demo report shared photo without live GPS pin. Approximate cell tagged based on text landmark mention.',
    review_state: 'Needs Review',
    source: 'Citizen Report (Demo Fixture)',
    data_status: 'Inferred',
    report_count: 1,
    image_url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80',
    image_caption: 'Citizen photo: Residential lane pooling without exact geotag metadata',
    reporter_summary: 'Citizen report fixture (+91 93*** ***77 - demo)',
    notes: 'Awaiting citizen clarification or roving ward patrol confirmation.',
    has_recurrence_flag: false,
  },
  {
    incident_id: 'INC-2026-065',
    zone_id: 'NZ-NER-02',
    location_name: 'Nerul Station West Crossway',
    coordinates: [19.043, 73.017],
    timestamp: '2026-10-15T08:55:00Z',
    relative_time: '5h 35m ago',
    category: 'Pedestrian Subway Waterlogging',
    visual_severity: 'moderate',
    ai_confidence: 0.90,
    ai_uncertainty_notes: 'Duplicate group #D-14: 3 separate photos of the same subway staircase matched by feature similarity.',
    review_state: 'Duplicate',
    source: 'Citizen Report (Demo Fixture)',
    data_status: 'AI estimate',
    report_count: 3,
    image_url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80',
    image_caption: 'Duplicate cluster: Station subway staircase ingress',
    reporter_summary: '3 independent citizens merged into Duplicate Group #D-14',
    notes: 'Merged into primary incident record INC-2026-088.',
    has_recurrence_flag: false,
    duplicate_group_id: 'D-14',
  },
];

// Seeded Maintenance Actions showcasing the evidence audit trail
export const SEED_MAINTENANCE: MaintenanceAction[] = [
  {
    action_id: 'MNT-2026-042',
    zone_id: 'NZ-SAN-01',
    incident_id: 'INC-2026-051',
    location_name: 'Sanpada Railway Underpass (Sector 4)',
    action_type: 'Clean / Desilt',
    actor: 'Divisional Engineer R. Kadam (NMMC Zone 4)',
    status: 'Completed & Verified',
    created_at: '2026-10-12T10:00:00Z',
    completed_at: '2026-10-12T15:30:00Z',
    notes: 'Desilted 1.8 metric tonnes of sediment and plastic debris from stormwater sump grates. Gravity drainage tested clear at conclusion of work.',
    verification_status: true,
    data_status: 'Demo action',
  },
  {
    action_id: 'MNT-2026-039',
    zone_id: 'NZ-NER-03',
    incident_id: 'INC-2026-044',
    location_name: 'Nerul MIDC Industrial Corridor (Road 2)',
    action_type: 'Culvert Clearing',
    actor: 'Supervisor V. Patil (Roads & Drainage)',
    status: 'Completed & Verified',
    created_at: '2026-10-10T09:15:00Z',
    completed_at: '2026-10-10T14:00:00Z',
    notes: 'Cleared concrete washout sediment from lateral culvert opening #4.',
    verification_status: true,
    data_status: 'Demo action',
  },
  {
    action_id: 'MNT-2026-035',
    zone_id: 'NZ-NER-02',
    incident_id: 'INC-2026-031',
    location_name: 'Nerul Sector 19A Market Complex',
    action_type: 'Inspect',
    actor: 'Contract Crew B (NMMC Sanitation)',
    status: 'Completed & Verified',
    created_at: '2026-10-08T11:00:00Z',
    completed_at: '2026-10-08T13:45:00Z',
    notes: 'Removed vegetable waste blockage from surface grating. Recommended solid-waste enforcement.',
    verification_status: true,
    data_status: 'Demo action',
  },
];

// Seeded Priority Action Queue with v3 Engine Factors
export const SEED_QUEUE: QueueItem[] = [
  {
    rank: 1,
    hotspot_id: 'HS-01',
    zone_id: 'NZ-SAN-01',
    location_name: 'Sanpada Railway Underpass (Sector 4)',
    risk_band: 'high',
    priority_score: 78,
    priority_band: 'Urgent',
    issue_type: 'Recurring Underpass Inundation',
    report_count: 4,
    corroboration_summary: '4 citizen photos + vehicular stall confirmed',
    latest_report_time: '18m ago',
    suggested_action: 'Escalate for Engineering Assessment',
    action_rationale: 'Recurring inundation after desilting suggests hydraulic backflow or culvert undersizing.',
    status: 'Needs Review',
    ranking_reasons: [
      'Recurrence after recorded maintenance (72h post-action flag)',
      '1 high-severity active waterlogging incident(s)',
      'Physical constraint: Depression basin (-2.4m below surrounding grade)',
      '4 citizen submissions with photo evidence',
    ],
    has_recurrence: true,
    missing_inputs: ['Tidal gate sensor feed (uncalibrated)'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '4 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '1 verified maintenance logs on file',
      terrain_model: 'Depression basin (-2.4m below surrounding grade)',
    },
    engine_version: 'v3.0.0-rule-deterministic',
  },
  {
    rank: 2,
    hotspot_id: 'HS-02',
    zone_id: 'NZ-NER-02',
    location_name: 'Nerul Sector 19A Market Complex',
    risk_band: 'high',
    priority_score: 47,
    priority_band: 'High',
    issue_type: 'Storm Drain Blockage & Market Overflow',
    report_count: 3,
    corroboration_summary: '3 reports + vendor video submission',
    latest_report_time: '26m ago',
    suggested_action: 'Clean / Desilt',
    action_rationale: 'Immediate debris clearance needed to restore gravity storm discharge.',
    status: 'New',
    ranking_reasons: [
      '1 high-severity active waterlogging incident(s)',
      'Physical constraint: Flat commercial precinct (0.8% slope toward arterial)',
      '3 citizen submissions with photo evidence',
    ],
    has_recurrence: false,
    missing_inputs: ['Solid-waste blockage ultrasonic detector'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '3 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '1 verified maintenance logs on file',
      terrain_model: 'Flat commercial precinct (0.8% slope toward arterial)',
    },
    engine_version: 'v3.0.0-rule-deterministic',
  },
  {
    rank: 3,
    hotspot_id: 'HS-03',
    zone_id: 'NZ-NER-03',
    location_name: 'Nerul MIDC Industrial Corridor (Road 2)',
    risk_band: 'moderate',
    priority_score: 34,
    priority_band: 'Moderate',
    issue_type: 'Carriageway Backflow Pooling',
    report_count: 2,
    corroboration_summary: '2 truck driver reports',
    latest_report_time: '1h 02m ago',
    suggested_action: 'Inspect',
    action_rationale: 'Verify inlet grates and lateral curb connections on-site.',
    status: 'In Progress',
    ranking_reasons: [
      'Physical constraint: Low longitudinal gradient (0.3%) along railway embankment',
      '2 citizen submissions with photo evidence',
    ],
    has_recurrence: false,
    missing_inputs: ['Live culvert level sensor (uncalibrated)'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '2 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '1 verified maintenance logs on file',
      terrain_model: 'Low longitudinal gradient (0.3%) along railway embankment',
    },
    engine_version: 'v3.0.0-rule-deterministic',
  },
  {
    rank: 4,
    hotspot_id: 'HS-04',
    zone_id: 'NZ-SAN-04',
    location_name: 'Palm Beach Rd - Sanpada Junction',
    risk_band: 'moderate',
    priority_score: 22,
    priority_band: 'Moderate',
    issue_type: 'Lateral Gutter Sheet Runoff',
    report_count: 2,
    corroboration_summary: '2 highway commuter reports',
    latest_report_time: '1h 45m ago',
    suggested_action: 'Culvert Clearing',
    action_rationale: 'Preventative clearing in high-susceptibility depression zone.',
    status: 'Needs Review',
    ranking_reasons: [
      'Physical constraint: Crest-to-sag transition (2.1% longitudinal gradient)',
      '2 citizen submissions with photo evidence',
    ],
    has_recurrence: false,
    missing_inputs: ['Road surface water film depth sensor'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '2 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '0 verified maintenance logs on file',
      terrain_model: 'Crest-to-sag transition (2.1% longitudinal gradient)',
    },
    engine_version: 'v3.0.0-rule-deterministic',
  },
  {
    rank: 5,
    hotspot_id: 'HS-05',
    zone_id: 'NZ-NER-05',
    location_name: 'Nerul Sector 42 Nallah Buffer',
    risk_band: 'low',
    priority_score: 0,
    priority_band: 'Monitor',
    issue_type: 'High Tide Watch (Channel Clear)',
    report_count: 1,
    corroboration_summary: '1 routine field inspection report',
    latest_report_time: '4h 15m ago',
    suggested_action: 'Monitor',
    action_rationale: 'Maintain baseline sensor watch; gravity discharge operating normally.',
    status: 'Closed',
    ranking_reasons: [
      'Routine monitoring; safe operational margins',
    ],
    has_recurrence: false,
    missing_inputs: ['Creek tidal level telemetry integration'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '1 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '0 verified maintenance logs on file',
      terrain_model: 'Tidal mangrove margin (+1.2m above mean sea level)',
    },
    engine_version: 'v5.0.0-weather-aware',
  },
];

export const SEED_REGIONAL_WEATHER: RegionalWeatherUrgency = {
  urgency_band: 'Moderate',
  urgency_score: 38,
  recent_6h_volume_mm: 18.2,
  forecast_6h_volume_mm: 12.0,
  current_intensity_mm_hr: 8.5,
  peak_forecast_intensity_mm_hr: 14.0,
  weather_status: 'Simulated',
  weather_source: 'Open-Meteo Best Match (Simulated)',
  weather_timestamp: '2026-10-18T18:00',
  retrieval_timestamp: '2026-10-18T18:05:00Z',
  urgency_rationale: 'Moderate convective rainfall observed across the Navi Mumbai cluster (~18 mm 6h volume). Shared regional signal without localized micro-bursts.',
  is_shared_regional_signal: true,
  cluster_scope_note: 'Regional ~0.1° (~11 km) grid encompasses the pilot cluster uniformly.',
  confidence: 'Moderate',
  confidence_limitations: [
    'Simulated demonstration payload; not connected to live satellite or NWP feed.',
    'Rule-based decision support prototype; not a calibrated 2D hydrodynamic inundation model.',
  ],
};

export const SEED_EVALUATIONS: PriorityEvaluation[] = [
  {
    zone_id: 'NZ-SAN-01',
    zone_name: 'Sanpada Railway Underpass (Sector 4)',
    ward: 'Sanpada Ward C',
    priority_score: 78,
    priority_band: 'Urgent',
    risk_score: 88,
    risk_band: 'high',
    suggested_action: 'Escalate for Engineering Assessment',
    action_rationale: 'Recurring inundation after desilting suggests hydraulic backflow or culvert undersizing.',
    has_recurrence: true,
    active_incidents_count: 1,
    total_incidents_count: 2,
    total_reports_count: 4,
    regional_weather: SEED_REGIONAL_WEATHER,
    ranking_reasons: [
      'Recurrence after recorded maintenance (72h post-action flag)',
      '1 high-severity active waterlogging incident(s)',
      'Physical constraint: Depression basin (-2.4m below surrounding grade)',
      '4 citizen submissions with photo evidence',
    ],
    factors: {
      severity: {
        score: 25.0,
        max: 35,
        weight_pct: 35,
        rationale: '1 high-severity unclosed incident(s) requiring urgent attention.',
        high_count: 1,
        moderate_count: 0,
        low_count: 0,
      },
      recurrence: {
        score: 30.0,
        max: 30,
        weight_pct: 30,
        rationale: 'Recurrence after recorded maintenance (72h post-action penalty).',
        has_recurrence: true,
      },
      velocity_and_corroboration: {
        score: 13.0,
        max: 20,
        weight_pct: 20,
        rationale: 'Active citizen reports: 4 verified submissions.',
        active_reports: 4,
        total_reports: 4,
      },
      recency: {
        score: 10.0,
        max: 15,
        weight_pct: 15,
        rationale: 'Recent report logged within past 3 hours.',
        most_recent_time: '2026-10-15T14:12:00Z',
      },
    },
    missing_inputs: ['Tidal gate sensor feed (uncalibrated)'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '4 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '1 verified maintenance logs on file',
      terrain_model: 'Depression basin (-2.4m below surrounding grade)',
    },
    engine_version: 'v3.0.0-rule-deterministic',
    evaluated_at: '2026-10-18T12:00:00Z',
  },
  {
    zone_id: 'NZ-NER-02',
    zone_name: 'Nerul Sector 19A Market Complex',
    ward: 'Nerul Ward D',
    priority_score: 47,
    priority_band: 'High',
    risk_score: 79,
    risk_band: 'high',
    suggested_action: 'Clean / Desilt',
    action_rationale: 'Immediate debris clearance needed to restore gravity storm discharge.',
    has_recurrence: false,
    active_incidents_count: 1,
    total_incidents_count: 1,
    total_reports_count: 3,
    regional_weather: SEED_REGIONAL_WEATHER,
    ranking_reasons: [
      '1 high-severity active waterlogging incident(s)',
      'Physical constraint: Flat commercial precinct (0.8% slope toward arterial)',
      '3 citizen submissions with photo evidence',
    ],
    factors: {
      severity: {
        score: 25.0,
        max: 35,
        weight_pct: 35,
        rationale: '1 high-severity unclosed incident(s) requiring urgent attention.',
        high_count: 1,
        moderate_count: 0,
        low_count: 0,
      },
      recurrence: {
        score: 0.0,
        max: 30,
        weight_pct: 30,
        rationale: 'No post-maintenance recurrence detected within 72 hours.',
        has_recurrence: false,
      },
      velocity_and_corroboration: {
        score: 12.0,
        max: 20,
        weight_pct: 20,
        rationale: 'Active citizen reports: 3 verified submissions.',
        active_reports: 3,
        total_reports: 3,
      },
      recency: {
        score: 10.0,
        max: 15,
        weight_pct: 15,
        rationale: 'Recent report logged within past 3 hours.',
        most_recent_time: '2026-10-15T14:04:00Z',
      },
    },
    missing_inputs: ['Solid-waste blockage ultrasonic detector'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '3 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '1 verified maintenance logs on file',
      terrain_model: 'Flat commercial precinct (0.8% slope toward arterial)',
    },
    engine_version: 'v5.0.0-weather-aware',
    evaluated_at: '2026-10-18T12:00:00Z',
  },
  {
    zone_id: 'NZ-NER-03',
    zone_name: 'Nerul MIDC Industrial Corridor (Road 2)',
    ward: 'Nerul Ward D',
    priority_score: 34,
    priority_band: 'Moderate',
    risk_score: 64,
    risk_band: 'moderate',
    suggested_action: 'Inspect',
    action_rationale: 'Verify inlet grates and lateral curb connections on-site.',
    has_recurrence: false,
    active_incidents_count: 1,
    total_incidents_count: 1,
    total_reports_count: 2,
    regional_weather: SEED_REGIONAL_WEATHER,
    ranking_reasons: [
      'Physical constraint: Low longitudinal gradient (0.3%) along railway embankment',
      '2 citizen submissions with photo evidence',
    ],
    factors: {
      severity: {
        score: 12.0,
        max: 35,
        weight_pct: 35,
        rationale: '1 moderate-severity incident(s) under review.',
        high_count: 0,
        moderate_count: 1,
        low_count: 0,
      },
      recurrence: {
        score: 0.0,
        max: 30,
        weight_pct: 30,
        rationale: 'No post-maintenance recurrence detected within 72 hours.',
        has_recurrence: false,
      },
      velocity_and_corroboration: {
        score: 12.0,
        max: 20,
        weight_pct: 20,
        rationale: 'Active citizen reports: 2 verified submissions.',
        active_reports: 2,
        total_reports: 2,
      },
      recency: {
        score: 10.0,
        max: 15,
        weight_pct: 15,
        rationale: 'Recent report logged within past 3 hours.',
        most_recent_time: '2026-10-15T13:28:00Z',
      },
    },
    missing_inputs: ['Live culvert level sensor (uncalibrated)'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '2 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '1 verified maintenance logs on file',
      terrain_model: 'Low longitudinal gradient (0.3%) along railway embankment',
    },
    engine_version: 'v5.0.0-weather-aware',
    evaluated_at: '2026-10-18T12:00:00Z',
  },
  {
    zone_id: 'NZ-SAN-04',
    zone_name: 'Palm Beach Rd - Sanpada Junction',
    ward: 'Sanpada Ward C',
    priority_score: 22,
    priority_band: 'Moderate',
    risk_score: 58,
    risk_band: 'moderate',
    suggested_action: 'Culvert Clearing',
    action_rationale: 'Preventative clearing in high-susceptibility depression zone.',
    has_recurrence: false,
    active_incidents_count: 0,
    total_incidents_count: 1,
    total_reports_count: 2,
    regional_weather: SEED_REGIONAL_WEATHER,
    ranking_reasons: [
      'Physical constraint: Crest-to-sag transition (2.1% longitudinal gradient)',
      '2 citizen submissions with photo evidence',
    ],
    factors: {
      severity: {
        score: 0.0,
        max: 35,
        weight_pct: 35,
        rationale: 'No active unaddressed high/moderate incidents.',
        high_count: 0,
        moderate_count: 0,
        low_count: 0,
      },
      recurrence: {
        score: 0.0,
        max: 30,
        weight_pct: 30,
        rationale: 'No post-maintenance recurrence detected within 72 hours.',
        has_recurrence: false,
      },
      velocity_and_corroboration: {
        score: 12.0,
        max: 20,
        weight_pct: 20,
        rationale: 'Historical reports on record.',
        active_reports: 0,
        total_reports: 2,
      },
      recency: {
        score: 10.0,
        max: 15,
        weight_pct: 15,
        rationale: 'Incident recorded in current event cycle.',
        most_recent_time: '2026-10-15T12:45:00Z',
      },
    },
    missing_inputs: ['Road surface water film depth sensor'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '2 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '0 verified maintenance logs on file',
      terrain_model: 'Crest-to-sag transition (2.1% longitudinal gradient)',
    },
    engine_version: 'v5.0.0-weather-aware',
    evaluated_at: '2026-10-18T12:00:00Z',
  },
  {
    zone_id: 'NZ-NER-05',
    zone_name: 'Nerul Sector 42 Nallah Buffer',
    ward: 'Nerul Ward D',
    priority_score: 0,
    priority_band: 'Monitor',
    risk_score: 35,
    risk_band: 'low',
    suggested_action: 'Monitor',
    action_rationale: 'Maintain baseline sensor watch; gravity discharge operating normally.',
    has_recurrence: false,
    active_incidents_count: 0,
    total_incidents_count: 1,
    total_reports_count: 1,
    regional_weather: SEED_REGIONAL_WEATHER,
    ranking_reasons: [
      'Routine monitoring; safe operational margins',
    ],
    factors: {
      severity: {
        score: 0.0,
        max: 35,
        weight_pct: 35,
        rationale: 'No active unaddressed high/moderate incidents.',
        high_count: 0,
        moderate_count: 0,
        low_count: 0,
      },
      recurrence: {
        score: 0.0,
        max: 30,
        weight_pct: 30,
        rationale: 'No post-maintenance recurrence detected.',
        has_recurrence: false,
      },
      velocity_and_corroboration: {
        score: 0.0,
        max: 20,
        weight_pct: 20,
        rationale: 'Routine observation; no active citizen reports.',
        active_reports: 0,
        total_reports: 1,
      },
      recency: {
        score: 0.0,
        max: 15,
        weight_pct: 15,
        rationale: 'No recent active unaddressed incidents.',
        most_recent_time: null,
      },
    },
    missing_inputs: ['Creek tidal level telemetry integration'],
    provenance: {
      rainfall_data: 'Simulated monsoon radar feed (28 mm/h spell)',
      citizen_reports: '1 pilot report fixtures (demonstration baseline)',
      maintenance_audit: '0 verified maintenance logs on file',
      terrain_model: 'Tidal mangrove margin (+1.2m above mean sea level)',
    },
    engine_version: 'v5.0.0-weather-aware',
    evaluated_at: '2026-10-18T12:00:00Z',
  },
];

// Seeded Hourly Rainfall Records (Simulated AWS - Nerul)
export const SEED_RAINFALL: RainfallObservation[] = [
  { time: '09:00', rainfall_mm: 3.2, risk_index: 22, source: 'AWS-Nerul', data_status: 'Simulated' },
  { time: '10:00', rainfall_mm: 6.8, risk_index: 34, source: 'AWS-Nerul', data_status: 'Simulated' },
  { time: '11:00', rainfall_mm: 14.5, risk_index: 52, source: 'AWS-Nerul', data_status: 'Simulated' },
  { time: '12:00', rainfall_mm: 22.0, risk_index: 68, source: 'AWS-Nerul', data_status: 'Simulated' },
  { time: '13:00', rainfall_mm: 31.4, risk_index: 84, source: 'AWS-Nerul', data_status: 'Simulated' },
  { time: '14:00', rainfall_mm: 24.5, risk_index: 76, source: 'AWS-Nerul', data_status: 'Simulated' },
];

// Seeded Notifications for Control Room
export const SEED_ALERTS: AlertNotification[] = [
  {
    id: 'ALT-01',
    zone_id: 'NZ-SAN-01',
    title: 'Recurrence Flag: Sanpada Railway Underpass',
    message: 'New incident reported 68h after MNT-2026-042 culvert desilting. Review recommended.',
    level: 'high',
    timestamp: '18m ago',
    read: false,
  },
  {
    id: 'ALT-02',
    zone_id: 'NZ-NER-02',
    title: 'High Severity Inundation: Sector 19A Market',
    message: '3 citizen reports confirm water ingress into commercial shops along Lane 3.',
    level: 'warning',
    timestamp: '26m ago',
    read: false,
  },
  {
    id: 'ALT-03',
    zone_id: 'NZ-NER-03',
    title: 'QRT Dispatched: MIDC Road 2',
    message: 'Ward D Quick Response Team en-route with suction pump trailer #4.',
    level: 'info',
    timestamp: '52m ago',
    read: true,
  },
];

// Historical Case Study: July 3-5, 2026 Navi Mumbai Monsoon Surge
export const HISTORICAL_CASE_STUDY = {
  event_id: 'HIST-2026-JULY',
  title: 'Navi Mumbai Monsoon Surge Case Study (July 3–5, 2026)',
  citation: 'Curated from Times of India (Navi Mumbai Bureau), The Free Press Journal & NMMC Disaster Control Room Logs',
  total_rainfall_mm: 342.8,
  peak_intensity_mm_hr: 54.2,
  reports_logged: 28,
  hotspots_identified: 7,
  limitation_notice: 'Historical evaluation uses 28 published news accounts and archived ward logs. It provides retrospective model validation and replay demonstration, not comprehensive ground-truth instrumentation for all municipal culverts.',
  timeline_steps: [
    {
      hour: 'July 3, 18:00',
      description: 'IMD Red Alert issued. High tide of 4.48m coincides with convective rainband onset over Thane Creek.',
      radar_intensity: 'Heavy',
      active_incidents: 4,
    },
    {
      hour: 'July 4, 02:00',
      description: 'Sanpada Underpass and Nerul Sector 19A reach high risk thresholds. 11 citizen reports received in 90 minutes.',
      radar_intensity: 'Severe',
      active_incidents: 12,
    },
    {
      hour: 'July 4, 09:30',
      description: 'Emergency municipal pumps deployed. Priority queue correctly elevated Sanpada Underpass to Rank 1 due to prior recurrence history.',
      radar_intensity: 'Moderate',
      active_incidents: 19,
    },
    {
      hour: 'July 5, 12:00',
      description: 'Tidal level recedes, stormwater discharge resumes. Post-event review reveals 85.7% hotspot precision across identified pilot zones.',
      radar_intensity: 'Light',
      active_incidents: 6,
    },
  ],
};
