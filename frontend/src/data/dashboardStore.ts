import { useState, useEffect, useCallback } from 'react';
import type {
  PilotZone,
  IncidentRecord,
  MaintenanceAction,
  QueueItem,
  RainfallObservation,
  AlertNotification,
  PriorityEvaluation,
  ResourceScenarioRequest,
  ResourceScenarioResponse,
  WeatherSnapshot,
} from './dashboardData';
import {
  SEED_ZONES,
  SEED_INCIDENTS,
  SEED_MAINTENANCE,
  SEED_QUEUE,
  SEED_RAINFALL,
  SEED_ALERTS,
  SEED_EVALUATIONS,
} from './dashboardData';
import { api, ApiError } from '../services/api';

const STORAGE_KEY = 'jaldrishti_officer_dashboard_state_v1';
const DATA_MODE_STORAGE_KEY = 'jaldrishti_data_mode_preference';

export type DashboardView =
  | 'overview'
  | 'incidents'
  | 'map'
  | 'queue'
  | 'maintenance'
  | 'analytics'
  | 'data_layers'
  | 'zones'
  | 'settings';

export type DataMode = 'api' | 'demo';

export interface DashboardState {
  currentView: DashboardView;
  selectedZoneId: string;
  selectedIncidentId: string;
  zones: PilotZone[];
  incidents: IncidentRecord[];
  maintenance: MaintenanceAction[];
  queue: QueueItem[];
  evaluations: PriorityEvaluation[];
  scenarioResults: ResourceScenarioResponse | null;
  isScenarioLoading: boolean;
  rainfall: RainfallObservation[];
  weatherSnapshot: WeatherSnapshot | null;
  isWeatherLoading: boolean;
  isWeatherRefreshing: boolean;
  weatherError: string | null;
  alerts: AlertNotification[];
  layerState: {
    relativeRisk: boolean;
    recentIncidents: boolean;
    rainfallRadar: boolean;
    drainageAssets: boolean;
    criticalRoutes: boolean;
  };
  demoMode: boolean; // true if running simulated demo fixtures or in demo mode
  dataMode: DataMode;
  isLoading: boolean;
  isSaving: boolean;
  apiConnected: boolean;
  apiError: string | null;
  filterStatus: string;
  searchQuery: string;
  isNotificationsOpen: boolean;
  isActionModalOpen: boolean;
}

const getInitialDataMode = (): DataMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(DATA_MODE_STORAGE_KEY);
    if (saved === 'api' || saved === 'demo') {
      return saved;
    }
  }
  const envMode = import.meta.env.VITE_DATA_MODE;
  if (envMode === 'demo') return 'demo';
  return 'api';
};

import { simulateDemoScenario } from '../utils/scenarioUtils';

const getDefaultLocalState = (dataMode: DataMode): DashboardState => ({
  currentView: 'overview',
  selectedZoneId: 'NZ-SAN-01',
  selectedIncidentId: 'INC-2026-089',
  zones: SEED_ZONES,
  incidents: SEED_INCIDENTS,
  maintenance: SEED_MAINTENANCE,
  queue: SEED_QUEUE,
  evaluations: SEED_EVALUATIONS,
  scenarioResults: null,
  isScenarioLoading: false,
  rainfall: SEED_RAINFALL,
  weatherSnapshot: null,
  isWeatherLoading: false,
  isWeatherRefreshing: false,
  weatherError: null,
  alerts: SEED_ALERTS,
  layerState: {
    relativeRisk: true,
    recentIncidents: true,
    rainfallRadar: true,
    drainageAssets: true,
    criticalRoutes: true,
  },
  demoMode: dataMode === 'demo',
  dataMode,
  isLoading: dataMode === 'api',
  isSaving: false,
  apiConnected: false,
  apiError: null,
  filterStatus: 'All',
  searchQuery: '',
  isNotificationsOpen: false,
  isActionModalOpen: false,
});

export const useDashboardStore = () => {
  const [state, setState] = useState<DashboardState>(() => {
    const dataMode = getInitialDataMode();
    if (dataMode === 'demo') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...parsed,
            dataMode: 'demo',
            demoMode: true,
            isLoading: false,
            apiError: null,
          };
        }
      } catch {
        // Fallback on parsing error
      }
    }
    return getDefaultLocalState(dataMode);
  });

  // Load data from FastAPI Backend
  const loadApiData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, isWeatherLoading: true, apiError: null }));
    try {
      const [health, zones, incidents, maintenance, queue, evaluations, weatherRes] = await Promise.all([
        api.checkHealth(),
        api.getZones(),
        api.getIncidents(),
        api.getMaintenance(),
        api.getActionQueue(),
        api.getPrioritisationEvaluations(),
        api.getRainfallHistory().catch((wErr: unknown) => {
          console.warn('Weather fetch non-fatal error:', wErr);
          return null;
        }),
      ]);

      setState((prev) => {
        // Find if current selected zone/incident exists in retrieved records
        const activeZoneId = zones.some((z) => z.zone_id === prev.selectedZoneId)
          ? prev.selectedZoneId
          : zones[0]?.zone_id || 'NZ-SAN-01';

        const matchingIncident = incidents.find((i) => i.zone_id === activeZoneId);
        const activeIncidentId = matchingIncident
          ? matchingIncident.incident_id
          : incidents[0]?.incident_id || 'INC-2026-089';

        let mappedRainfall = prev.rainfall;
        if (weatherRes && weatherRes.past_records && weatherRes.past_records.length > 0) {
          mappedRainfall = weatherRes.past_records.map((r) => ({
            time: r.time,
            rainfall_mm: r.precipitation_mm,
            risk_index: Math.min(100, Math.round(r.precipitation_mm * 3.5)),
            source: 'Open-Meteo NWP',
            data_status: 'Weather Model',
            is_forecast: false,
            timestamp_iso: r.timestamp_iso,
          }));
        }

        return {
          ...prev,
          zones,
          incidents,
          maintenance,
          queue,
          evaluations,
          weatherSnapshot: weatherRes || prev.weatherSnapshot,
          rainfall: mappedRainfall,
          isWeatherLoading: false,
          weatherError: weatherRes ? null : (prev.weatherSnapshot ? 'Live refresh failed; displaying retained forecast.' : 'Weather provider currently unavailable.'),
          selectedZoneId: activeZoneId,
          selectedIncidentId: activeIncidentId,
          apiConnected: health.status === 'ok',
          apiError: null,
          isLoading: false,
          demoMode: false,
        };
      });
    } catch (err: unknown) {
      const errMsg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to communicate with JalDrishti backend.';
      setState((prev) => ({
        ...prev,
        apiConnected: false,
        apiError: errMsg,
        isLoading: false,
        isWeatherLoading: false,
      }));
    }
  }, []);

  // Sync mode changes & initial fetch on mount
  useEffect(() => {
    if (state.dataMode === 'api') {
      loadApiData();
    }
  }, [state.dataMode, loadApiData]);

  // Persist demo mode state in localStorage
  useEffect(() => {
    if (state.dataMode === 'demo') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore quota exceptions
      }
    }
  }, [state]);

  // Set Active View
  const setView = useCallback((view: DashboardView) => {
    setState((prev) => ({ ...prev, currentView: view }));
  }, []);

  // Select Zone
  const selectZone = useCallback((zoneId: string) => {
    setState((prev) => {
      const matchingInc = prev.incidents.find((inc) => inc.zone_id === zoneId);
      return {
        ...prev,
        selectedZoneId: zoneId,
        selectedIncidentId: matchingInc ? matchingInc.incident_id : prev.selectedIncidentId,
      };
    });
  }, []);

  // Select Incident
  const selectIncident = useCallback((incidentId: string) => {
    setState((prev) => {
      const inc = prev.incidents.find((i) => i.incident_id === incidentId);
      return {
        ...prev,
        selectedIncidentId: incidentId,
        selectedZoneId: inc ? inc.zone_id : prev.selectedZoneId,
      };
    });
  }, []);

  // Select Queue Row
  const selectQueueItem = useCallback((hotspotId: string) => {
    setState((prev) => {
      const q = prev.queue.find((item) => item.hotspot_id === hotspotId);
      if (!q) return prev;
      const matchingInc = prev.incidents.find((i) => i.zone_id === q.zone_id);
      return {
        ...prev,
        selectedZoneId: q.zone_id,
        selectedIncidentId: matchingInc ? matchingInc.incident_id : prev.selectedIncidentId,
      };
    });
  }, []);

  // Update Incident Review State
  const updateIncidentState = useCallback(
    async (incidentId: string, newState: IncidentRecord['review_state']) => {
      if (state.dataMode === 'api') {
        try {
          const updated = await api.updateIncident(incidentId, { status: newState });
          setState((prev) => {
            const updatedIncidents = prev.incidents.map((i) =>
              i.incident_id === incidentId ? updated : i
            );
            return { ...prev, incidents: updatedIncidents };
          });
          // Refresh queue from server
          const newQueue = await api.getActionQueue();
          setState((prev) => ({ ...prev, queue: newQueue }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update incident on server';
          alert(`Error updating incident: ${msg}`);
        }
      } else {
        // Local Demo Mode
        setState((prev) => {
          const updatedIncidents = prev.incidents.map((inc) =>
            inc.incident_id === incidentId ? { ...inc, review_state: newState } : inc
          );
          const inc = prev.incidents.find((i) => i.incident_id === incidentId);
          const updatedQueue = prev.queue.map((q) => {
            if (inc && q.zone_id === inc.zone_id) {
              let queueStatus: QueueItem['status'] = 'Needs Review';
              if (newState === 'Closed') queueStatus = 'Closed';
              else if (newState === 'Confirmed') queueStatus = 'In Progress';
              else if (newState === 'New') queueStatus = 'New';
              return { ...q, status: queueStatus };
            }
            return q;
          });

          return {
            ...prev,
            incidents: updatedIncidents,
            queue: updatedQueue,
          };
        });
      }
    },
    [state.dataMode]
  );

  // Record a New Maintenance Action
  const recordMaintenanceAction = useCallback(
    async (actionData: {
      zone_id: string;
      action_type: MaintenanceAction['action_type'];
      actor: string;
      notes: string;
      verification_status: boolean;
    }) => {
      setState((prev) => ({ ...prev, isSaving: true }));

      if (state.dataMode === 'api') {
        try {
          await api.createMaintenanceAction({
            zone_id: actionData.zone_id,
            action_type: actionData.action_type,
            supervisor: actionData.actor,
            work_notes: actionData.notes,
            verification_status: actionData.verification_status,
          });

          // Refresh maintenance, zones, and queue from server
          const [newMaintenance, newQueue, newZones] = await Promise.all([
            api.getMaintenance(),
            api.getActionQueue(),
            api.getZones(),
          ]);

          setState((prev) => ({
            ...prev,
            maintenance: newMaintenance,
            queue: newQueue,
            zones: newZones,
            isSaving: false,
            isActionModalOpen: false,
          }));
        } catch (err: unknown) {
          setState((prev) => ({ ...prev, isSaving: false }));
          const msg = err instanceof Error ? err.message : 'Failed to save maintenance action';
          alert(`Error recording maintenance: ${msg}`);
        }
      } else {
        // Local Demo Mode
        setState((prev) => {
          const targetZone = prev.zones.find((z) => z.zone_id === actionData.zone_id);
          const newActionId = `MNT-2026-0${prev.maintenance.length + 45}`;
          const newAction: MaintenanceAction = {
            action_id: newActionId,
            zone_id: actionData.zone_id,
            location_name: targetZone ? targetZone.name : 'Nerul Pilot Sector',
            action_type: actionData.action_type,
            actor: actionData.actor || 'Officer P. Deshmukh (NMMC)',
            status: 'Completed & Verified',
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            notes: actionData.notes,
            verification_status: actionData.verification_status,
            data_status: 'Demo action',
          };

          const updatedQueue = prev.queue.map((q) =>
            q.zone_id === actionData.zone_id
              ? { ...q, status: 'In Progress' as const, suggested_action: 'Monitor Hotspot' }
              : q
          );

          return {
            ...prev,
            maintenance: [newAction, ...prev.maintenance],
            queue: updatedQueue,
            isSaving: false,
            isActionModalOpen: false,
          };
        });
      }
    },
    [state.dataMode]
  );

  // Recurrence Review Actions: Confirm Recurrence or Dismiss with Rationale
  const handleRecurrenceReview = useCallback(
    async (incidentId: string, decision: 'confirmed' | 'dismissed', rationale: string) => {
      if (state.dataMode === 'api') {
        try {
          const targetInc = state.incidents.find((i) => i.incident_id === incidentId);
          const updatedRecurrenceDetails = targetInc?.recurrence_details
            ? { ...targetInc.recurrence_details, status: decision, rationale }
            : { status: decision, rationale };

          await api.updateIncident(incidentId, {
            has_recurrence_flag: decision === 'confirmed',
            recurrence_details: updatedRecurrenceDetails,
            review_notes: rationale,
          });

          // Refresh from server
          const [newIncidents, newZones, newQueue] = await Promise.all([
            api.getIncidents(),
            api.getZones(),
            api.getActionQueue(),
          ]);

          setState((prev) => ({
            ...prev,
            incidents: newIncidents,
            zones: newZones,
            queue: newQueue,
          }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update recurrence on server';
          alert(`Error saving recurrence decision: ${msg}`);
        }
      } else {
        // Local Demo Mode
        setState((prev) => {
          const updatedIncidents = prev.incidents.map((inc) => {
            if (inc.incident_id === incidentId && inc.recurrence_details) {
              return {
                ...inc,
                recurrence_details: {
                  ...inc.recurrence_details,
                  status: decision,
                  rationale,
                },
                has_recurrence_flag: decision === 'confirmed',
              };
            }
            return inc;
          });

          const targetInc = prev.incidents.find((i) => i.incident_id === incidentId);
          const updatedZones = prev.zones.map((z) => {
            if (targetInc && z.zone_id === targetInc.zone_id) {
              return { ...z, has_recurrence_flag: decision === 'confirmed' };
            }
            return z;
          });

          const updatedQueue = prev.queue.map((q) => {
            if (targetInc && q.zone_id === targetInc.zone_id) {
              return {
                ...q,
                status: decision === 'confirmed' ? ('Escalated' as const) : ('Closed' as const),
                suggested_action:
                  decision === 'confirmed'
                    ? 'Escalate for Engineering Assessment'
                    : 'Monitor Hotspot',
                has_recurrence: decision === 'confirmed',
              };
            }
            return q;
          });

          return {
            ...prev,
            incidents: updatedIncidents,
            zones: updatedZones,
            queue: updatedQueue,
          };
        });
      }
    },
    [state.dataMode, state.incidents]
  );

  // Recurrence Simulation Trigger (Differentiator Demo)
  const triggerRecurrenceSimulation = useCallback(
    async (zoneId: string) => {
      const zone = state.zones.find((z) => z.zone_id === zoneId);
      if (!zone) return;

      if (state.dataMode === 'api') {
        try {
          setState((prev) => ({ ...prev, isLoading: true }));
          const newInc = await api.createIncident({
            zone_id: zoneId,
            category: 'Follow-up Inundation Report',
            severity: 'high',
            notes: `Recurrence trigger: New waterlogging report logged following recent maintenance. System automatically flagged for human review.`,
            report_count: 3,
            image_url:
              'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80',
            image_caption: 'Simulated citizen report: Waterlogging reappeared after recent maintenance',
            data_status: 'Simulated',
          });

          const [newIncidents, newZones, newQueue] = await Promise.all([
            api.getIncidents(),
            api.getZones(),
            api.getActionQueue(),
          ]);

          const newAlert: AlertNotification = {
            id: `ALT-0${Date.now() % 1000}`,
            zone_id: zoneId,
            title: `⚠️ Recurrence Detected: ${zone.name}`,
            message: `New waterlogging reports received after maintenance. Flagged for review.`,
            level: 'high',
            timestamp: 'Just now',
            read: false,
          };

          setState((prev) => ({
            ...prev,
            selectedZoneId: zoneId,
            selectedIncidentId: newInc.incident_id,
            incidents: newIncidents,
            zones: newZones,
            queue: newQueue,
            alerts: [newAlert, ...prev.alerts],
            isNotificationsOpen: true,
            isLoading: false,
          }));
        } catch (err: unknown) {
          setState((prev) => ({ ...prev, isLoading: false }));
          const msg = err instanceof Error ? err.message : 'Failed to simulate recurrence';
          alert(`Simulation error: ${msg}`);
        }
      } else {
        // Local Demo Mode
        setState((prev) => {
          const latestAction = prev.maintenance.find((m) => m.zone_id === zoneId);
          const newIncId = `INC-2026-0${prev.incidents.length + 95}`;

          const newSimulatedIncident: IncidentRecord = {
            incident_id: newIncId,
            zone_id: zoneId,
            location_name: zone.name,
            coordinates: zone.coordinates,
            timestamp: new Date().toISOString(),
            relative_time: 'Just now (Simulated)',
            category: 'Follow-up Inundation Report',
            visual_severity: 'high',
            ai_confidence: 0.93,
            ai_uncertainty_notes:
              'Automated AI vision classified 32cm water depth over curb following rainfall convective spell.',
            review_state: 'Needs Review',
            source: 'Citizen Report (Demo Simulation)',
            data_status: 'Simulated',
            report_count: 3,
            image_url:
              'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80',
            image_caption: 'Simulated citizen report: Waterlogging reappeared after recent maintenance',
            reporter_summary: 'Citizen report fixture (+91 98*** ***12 - demo simulation)',
            notes: `Recurrence trigger: New report received following ${
              latestAction ? latestAction.action_type : 'desilting'
            }. Flagged for engineering review.`,
            has_recurrence_flag: true,
            recurrence_details: {
              prior_action_id: latestAction ? latestAction.action_id : 'MNT-2026-042',
              prior_action_title: latestAction
                ? latestAction.action_type
                : 'Desilt Culvert / Clear Intake Grates',
              prior_action_date: latestAction ? latestAction.created_at : 'Oct 12, 2026',
              time_elapsed: 'Within 72 hours of maintenance',
              rule_explanation:
                'Waterlogging reported at the same culvert cell within configured 72-hour window post-maintenance. Suggests structural grade issue or creek backwater rather than simple surface silt.',
              status: 'flagged',
            },
          };

          const updatedZones = prev.zones.map((z) =>
            z.zone_id === zoneId ? { ...z, has_recurrence_flag: true, risk_band: 'high' as const } : z
          );

          const updatedQueue = prev.queue.map((q) => {
            if (q.zone_id === zoneId) {
              return {
                ...q,
                rank: 1,
                risk_band: 'high' as const,
                suggested_action: 'Escalate for Engineering Assessment',
                status: 'Needs Review' as const,
                has_recurrence: true,
                report_count: q.report_count + 3,
                latest_report_time: 'Just now',
              };
            }
            return q;
          });

          const newAlert: AlertNotification = {
            id: `ALT-0${prev.alerts.length + 10}`,
            zone_id: zoneId,
            title: `⚠️ Recurrence Detected: ${zone.name}`,
            message: `New waterlogging reports received after maintenance ${
              latestAction?.action_id || ''
            }. Flagged for review.`,
            level: 'high',
            timestamp: 'Just now',
            read: false,
          };

          return {
            ...prev,
            selectedZoneId: zoneId,
            selectedIncidentId: newIncId,
            incidents: [newSimulatedIncident, ...prev.incidents],
            zones: updatedZones,
            queue: updatedQueue,
            alerts: [newAlert, ...prev.alerts],
            isNotificationsOpen: true,
          };
        });
      }
    },
    [state.dataMode, state.zones]
  );

  // Switch between API Mode and Demo Mode
  const setDataMode = useCallback((mode: DataMode) => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, mode);
    if (mode === 'demo') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setState({
            ...parsed,
            dataMode: 'demo',
            demoMode: true,
            isLoading: false,
            apiError: null,
          });
          return;
        }
      } catch {
        // Fallback
      }
      setState((prev) => ({
        ...prev,
        ...getDefaultLocalState('demo'),
      }));
    } else {
      setState((prev) => ({
        ...prev,
        dataMode: 'api',
        demoMode: false,
      }));
    }
  }, []);

  // Reset Demo State
  const resetDemoState = useCallback(async () => {
    if (state.dataMode === 'api') {
      try {
        await api.resetDemo();
        await loadApiData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reset demo on backend';
        alert(`Reset error: ${msg}`);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setState(getDefaultLocalState('demo'));
    }
  }, [state.dataMode, loadApiData]);

  // Layer Toggles
  const toggleLayer = useCallback((layer: keyof DashboardState['layerState']) => {
    setState((prev) => ({
      ...prev,
      layerState: {
        ...prev.layerState,
        [layer]: !prev.layerState[layer],
      },
    }));
  }, []);

  // Filter & Search
  const setFilterStatus = useCallback((status: string) => {
    setState((prev) => ({ ...prev, filterStatus: status }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  // Modals & Panels
  const setNotificationsOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, isNotificationsOpen: open }));
  }, []);

  const setActionModalOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, isActionModalOpen: open }));
  }, []);

  // Mark all notifications read
  const markAlertsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) => ({ ...a, read: true })),
    }));
  }, []);

  // What-If Resource Scenario Simulation (v3)
  const runResourceScenario = useCallback(
    async (req: ResourceScenarioRequest): Promise<ResourceScenarioResponse> => {
      setState((prev) => ({ ...prev, isScenarioLoading: true }));
      try {
        let res: ResourceScenarioResponse;
        if (state.dataMode === 'api') {
          res = await api.calculateResourceScenario(req);
        } else {
          res = simulateDemoScenario(state.evaluations, req);
        }
        setState((prev) => ({ ...prev, scenarioResults: res, isScenarioLoading: false }));
        return res;
      } catch (err: unknown) {
        setState((prev) => ({ ...prev, isScenarioLoading: false }));
        throw err;
      }
    },
    [state.dataMode, state.evaluations]
  );

  // Selected Zone & Incident Helpers
  const selectedZone = state.zones.find((z) => z.zone_id === state.selectedZoneId) || state.zones[0] || SEED_ZONES[0];
  const selectedIncident =
    state.incidents.find((i) => i.incident_id === state.selectedIncidentId) ||
    state.incidents.find((i) => i.zone_id === state.selectedZoneId) ||
    state.incidents[0] ||
    SEED_INCIDENTS[0];

  const selectedEvaluation =
    state.evaluations.find((e) => e.zone_id === state.selectedZoneId) ||
    state.evaluations[0] ||
    SEED_EVALUATIONS[0];

  const zoneIncidents = state.incidents.filter((i) => i.zone_id === state.selectedZoneId);
  const zoneMaintenance = state.maintenance.filter((m) => m.zone_id === state.selectedZoneId);

  // Refresh Weather from Open-Meteo API
  const refreshWeather = useCallback(async (zoneId?: string) => {
    if (state.dataMode === 'demo') {
      setState((prev) => ({ ...prev, isWeatherRefreshing: true }));
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          isWeatherRefreshing: false,
          rainfall: SEED_RAINFALL,
        }));
      }, 500);
      return;
    }

    setState((prev) => ({
      ...prev,
      isWeatherRefreshing: true,
      weatherError: null,
    }));

    try {
      const targetZoneId = zoneId || state.selectedZoneId;
      const refreshedSnapshot = await api.refreshRainfall(targetZoneId);
      const mappedRainfall: RainfallObservation[] = refreshedSnapshot.past_records.map((r) => ({
        time: r.time,
        rainfall_mm: r.precipitation_mm,
        risk_index: Math.min(100, Math.round(r.precipitation_mm * 3.5)),
        source: 'Open-Meteo NWP',
        data_status: 'Weather Model',
        is_forecast: false,
        timestamp_iso: r.timestamp_iso,
      }));

      setState((prev) => ({
        ...prev,
        weatherSnapshot: refreshedSnapshot,
        rainfall: mappedRainfall.length > 0 ? mappedRainfall : prev.rainfall,
        isWeatherRefreshing: false,
        weatherError: null,
      }));
    } catch (err: unknown) {
      const errMsg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to refresh numerical weather model data.';
      setState((prev) => ({
        ...prev,
        isWeatherRefreshing: false,
        weatherError: errMsg,
      }));
    }
  }, [state.dataMode, state.selectedZoneId]);

  return {
    state,
    selectedZone,
    selectedIncident,
    selectedEvaluation,
    zoneIncidents,
    zoneMaintenance,
    setView,
    selectZone,
    selectIncident,
    selectQueueItem,
    updateIncidentState,
    recordMaintenanceAction,
    handleRecurrenceReview,
    triggerRecurrenceSimulation,
    runResourceScenario,
    refreshWeather,
    toggleLayer,
    setFilterStatus,
    setSearchQuery,
    setNotificationsOpen,
    setActionModalOpen,
    markAlertsRead,
    resetDemoState,
    setDataMode,
    retryConnection: loadApiData,
  };
};
