import type {
  PilotZone,
  IncidentRecord,
  MaintenanceAction,
  QueueItem,
  PriorityEvaluation,
  ResourceScenarioRequest,
  ResourceScenarioResponse,
  WeatherSnapshot,
} from '../data/dashboardData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let detail = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const body = await response.json();
        if (body.detail) {
          detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
        }
      } catch {
        // use fallback detail
      }
      throw new ApiError(detail, response.status);
    }
    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(
      `Cannot connect to JalDrishti backend at ${API_BASE_URL}. Ensure the Flask server is running. (${message})`,
      0
    );
  }
}

export const api = {
  /** Health check */
  async checkHealth(): Promise<{ status: string; database: string }> {
    return request<{ status: string; database: string }>('/health');
  },

  /** Zones */
  async getZones(): Promise<PilotZone[]> {
    return request<PilotZone[]>('/api/zones');
  },

  async getZone(zoneId: string): Promise<PilotZone> {
    return request<PilotZone>(`/api/zones/${encodeURIComponent(zoneId)}`);
  },

  /** Incidents */
  async getIncidents(filters?: { zone_id?: string; status?: string; severity?: string }): Promise<IncidentRecord[]> {
    const params = new URLSearchParams();
    if (filters?.zone_id) params.append('zone_id', filters.zone_id);
    if (filters?.status && filters.status !== 'All') params.append('status', filters.status);
    if (filters?.severity && filters.severity !== 'All') params.append('severity', filters.severity);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<IncidentRecord[]>(`/api/incidents${qs}`);
  },

  async createIncident(data: {
    zone_id: string;
    location_name?: string;
    category: string;
    severity?: 'high' | 'moderate' | 'low' | 'unassessed';
    notes?: string;
    report_count?: number;
    image_url?: string;
    image_caption?: string;
    data_status?: string;
  }): Promise<IncidentRecord> {
    return request<IncidentRecord>('/api/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateIncident(
    incidentId: string,
    data: {
      status?: string;
      review_state?: string;
      review_notes?: string;
      has_recurrence_flag?: boolean;
      recurrence_details?: Record<string, unknown>;
    }
  ): Promise<IncidentRecord> {
    return request<IncidentRecord>(`/api/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** Maintenance Actions */
  async getMaintenance(zoneId?: string): Promise<MaintenanceAction[]> {
    const qs = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : '';
    return request<MaintenanceAction[]>(`/api/maintenance${qs}`);
  },

  async createMaintenanceAction(data: {
    zone_id: string;
    action_type: string;
    supervisor?: string;
    actor?: string;
    work_notes?: string;
    notes?: string;
    verification_status?: boolean;
    cost_estimate?: number;
  }): Promise<MaintenanceAction> {
    return request<MaintenanceAction>('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Action Queue */
  async getActionQueue(): Promise<QueueItem[]> {
    return request<QueueItem[]>('/api/action-queue');
  },

  /** Explainable Prioritisation Evaluations (v3) */
  async getPrioritisationEvaluations(): Promise<PriorityEvaluation[]> {
    return request<PriorityEvaluation[]>('/api/prioritisation/evaluations');
  },

  async getZoneEvaluation(zoneId: string): Promise<PriorityEvaluation> {
    return request<PriorityEvaluation>(`/api/prioritisation/evaluations/${encodeURIComponent(zoneId)}`);
  },

  /** What-If Resource Allocation Scenario (v3) */
  async calculateResourceScenario(data: ResourceScenarioRequest): Promise<ResourceScenarioResponse> {
    return request<ResourceScenarioResponse>('/api/prioritisation/scenario', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Weather & Precipitation Data (v4) */
  async getCurrentRainfall(zoneId?: string): Promise<WeatherSnapshot> {
    const qs = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : '';
    return request<WeatherSnapshot>(`/api/rainfall/current${qs}`);
  },

  async getRainfallHistory(zoneId?: string): Promise<WeatherSnapshot> {
    const qs = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : '';
    return request<WeatherSnapshot>(`/api/rainfall/history${qs}`);
  },

  async refreshRainfall(zoneId?: string): Promise<WeatherSnapshot> {
    const qs = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : '';
    return request<WeatherSnapshot>(`/api/rainfall/refresh${qs}`, {
      method: 'POST',
    });
  },

  /** Demo Reset (Dev only) */
  async resetDemo(): Promise<{ message: string; status: string }> {
    return request<{ message: string; status: string }>('/api/demo/reset', {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
  },

  /** Autonomous Source Registry & Ingestion (v1) */
  async getSources(): Promise<SourceRegistryItem[]> {
    return request<SourceRegistryItem[]>('/api/sources');
  },

  async getSource(sourceId: string): Promise<SourceRegistryItem> {
    return request<SourceRegistryItem>(`/api/sources/${encodeURIComponent(sourceId)}`);
  },

  async getSourceRuns(sourceId: string, limit: number = 20): Promise<IngestionRunItem[]> {
    return request<IngestionRunItem[]>(`/api/sources/${encodeURIComponent(sourceId)}/runs?limit=${limit}`);
  },

  async refreshSource(sourceId: string): Promise<SourceRefreshResult> {
    return request<SourceRefreshResult>(`/api/sources/${encodeURIComponent(sourceId)}/refresh`, {
      method: 'POST',
    });
  },

  async getGeographicFeatures(params?: { category?: string; format?: string }): Promise<GeographicFeatureItem[]> {
    const search = new URLSearchParams();
    if (params?.category) search.append('category', params.category);
    if (params?.format) search.append('format', params.format);
    const qs = search.toString() ? `?${search.toString()}` : '';
    return request<GeographicFeatureItem[]>(`/api/geographic-features${qs}`);
  },

  async getGeographicFeaturesGeoJSON(category?: string): Promise<any> {
    const search = new URLSearchParams({ format: 'geojson' });
    if (category) search.append('category', category);
    return request<any>(`/api/geographic-features?${search.toString()}`);
  },

  async getSourceEvidence(): Promise<SourceEvidenceItem[]> {
    return request<SourceEvidenceItem[]>('/api/source-evidence');
  },

  async getCollectorStatus(): Promise<CollectorStatus> {
    return request<CollectorStatus>('/api/collector/status');
  },
};

export interface SourceRegistryItem {
  id: string;
  name: string;
  provider: string;
  category: string;
  endpoint_url?: string | null;
  geographic_coverage: string;
  access_method: string;
  attribution: string;
  license: string;
  collection_interval_seconds?: number | null;
  is_enabled: boolean;
  status: string;
  last_attempt_at?: string | null;
  last_success_at?: string | null;
  last_data_timestamp?: string | null;
  records_retrieved: number;
  records_inserted: number;
  records_updated: number;
  records_rejected: number;
  records_unchanged: number;
  error_summary?: string | null;
  limitations?: string[] | null;
  data_age_seconds?: number | null;
  data_age_label?: string | null;
  recent_runs?: IngestionRunItem[];
}

export interface IngestionRunItem {
  id: number;
  source_id: string;
  started_at: string;
  completed_at?: string | null;
  status: string;
  records_retrieved: number;
  records_inserted: number;
  records_updated: number;
  records_rejected: number;
  records_unchanged: number;
  error_message?: string | null;
  run_metadata?: Record<string, unknown> | null;
  duration_seconds?: number | null;
}

export interface GeographicFeatureItem {
  id: number;
  osm_type: string;
  osm_id: number;
  category: string;
  feature_type: string;
  name?: string | null;
  geometry_type: string;
  coordinates_json: any;
  tags: Record<string, unknown>;
  source_attribution: string;
  data_origin: 'official' | 'live-collected' | 'curated';
  import_timestamp: string;
  last_updated_at: string;
}

export interface SourceEvidenceItem {
  id: string;
  source_id: string;
  publisher: string;
  canonical_url?: string | null;
  publication_date?: string | null;
  event_date?: string | null;
  location_phrase: string;
  evidence_text: string;
  geographic_precision: string;
  verification_status: string;
  associated_zone_id?: string | null;
  created_at: string;
}

export interface CollectorStatus {
  worker_id: string;
  is_running: boolean;
  last_heartbeat_at?: string | null;
  heartbeat_age_seconds?: number | null;
  heartbeat_status: 'Healthy' | 'Stale' | 'Offline';
  active_job?: string | null;
  next_scheduled_runs?: Record<string, string> | null;
  started_at?: string | null;
  pid?: number | null;
}

export interface SourceRefreshResult {
  source_id: string;
  status: string;
  message: string;
  run_id?: number | null;
  records_retrieved: number;
  records_inserted: number;
  records_updated: number;
}

