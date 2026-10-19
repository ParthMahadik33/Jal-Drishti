import React from 'react';
import {
  FileText,
  AlertTriangle,
  CloudRain,
  Wrench,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { MapLibreRiskMap } from '../MapLibreRiskMap';
import { OverviewPriorityQueue } from '../OverviewPriorityQueue';
import { HotspotInspector } from '../HotspotInspector';
import type {
  PilotZone,
  IncidentRecord,
  MaintenanceAction,
  QueueItem,
  RainfallObservation,
  PriorityEvaluation,
  WeatherSnapshot,
} from '../../../data/dashboardData';

interface OverviewViewProps {
  zones: PilotZone[];
  incidents: IncidentRecord[];
  maintenance: MaintenanceAction[];
  queue: QueueItem[];
  rainfall: RainfallObservation[];
  weatherSnapshot?: WeatherSnapshot | null;
  isWeatherLoading?: boolean;
  isWeatherRefreshing?: boolean;
  weatherError?: string | null;
  isDemoMode?: boolean;
  onRefreshWeather?: () => void;
  selectedZone: PilotZone;
  selectedIncident: IncidentRecord;
  selectedEvaluation?: PriorityEvaluation;
  evaluations?: PriorityEvaluation[];
  zoneIncidents: IncidentRecord[];
  zoneMaintenance: MaintenanceAction[];
  selectedZoneId: string;
  selectedIncidentId: string;
  onSelectZone: (zoneId: string) => void;
  onSelectIncident: (incidentId: string) => void;
  onSelectQueueItem: (hotspotId: string) => void;
  onUpdateIncidentState: (incidentId: string, newState: IncidentRecord['review_state']) => void;
  onOpenRecordAction: () => void;
  onRecurrenceDecision: (incidentId: string, decision: 'confirmed' | 'dismissed', rationale: string) => void;
  onOpenHistoricalReplay?: () => void;
  onNavigateToRiskMap?: () => void;
  layerState: {
    relativeRisk: boolean;
    recentIncidents: boolean;
    rainfallRadar: boolean;
    drainageAssets: boolean;
    criticalRoutes: boolean;
  };
  onToggleLayer: (
    layer: 'relativeRisk' | 'recentIncidents' | 'rainfallRadar' | 'drainageAssets' | 'criticalRoutes'
  ) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  zones,
  incidents,
  maintenance,
  queue,
  rainfall,
  weatherSnapshot,
  isWeatherLoading = false,
  isWeatherRefreshing = false,
  weatherError = null,
  isDemoMode = false,
  onRefreshWeather,
  selectedZone,
  selectedIncident,
  selectedEvaluation,
  evaluations = [],
  zoneIncidents,
  zoneMaintenance,
  selectedZoneId,
  selectedIncidentId,
  onSelectZone,
  onSelectIncident,
  onSelectQueueItem,
  onUpdateIncidentState,
  onOpenRecordAction,
  onRecurrenceDecision,
  layerState,
}) => {
  // 1. Calculate Compact Summary Metrics strictly from active database state
  const openIncidents = incidents.filter(
    (i) => i.review_state !== 'Closed'
  );
  const unassessedCount = openIncidents.filter(
    (i) => i.visual_severity === 'unassessed'
  ).length;
  const confirmedCount = openIncidents.filter(
    (i) => i.review_state === 'Confirmed'
  ).length;

  const highPriorityZones = queue.filter(
    (q) => q.priority_band === 'Urgent' || q.priority_band === 'High' || q.risk_band === 'high'
  );

  const currentIntensity =
    weatherSnapshot?.current_intensity_mm_hr ??
    rainfall[rainfall.length - 1]?.rainfall_mm ??
    0;

  const weatherStatusText = isDemoMode || weatherSnapshot?.is_simulated
    ? 'Simulated Data'
    : weatherSnapshot?.is_stale
    ? 'Stale Model'
    : 'Current Observation';

  const weatherTimestamp = weatherSnapshot?.retrieved_at
    ? new Date(weatherSnapshot.retrieved_at).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' IST'
    : 'Live Observation';

  const pendingMaintenance = maintenance.filter(
    (m) => m.status !== 'Completed & Verified'
  );

  return (
    <div className="space-y-6">
      {/* SECTION 1: Compact Summary Metrics Row (Derived strictly from persistent backend) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Open Citizen & Incident Reports */}
        <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526984]">
              Open Incident Reports
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1769C2] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[26px] font-bold text-[#10243B] leading-none">
              {openIncidents.length}
            </div>
            <div className="text-[11.5px] text-[#526984] mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span>{unassessedCount} unassessed</span>
              <span>&middot;</span>
              <span>{confirmedCount} confirmed</span>
            </div>
            <div className="text-[10.5px] text-[#526984]/80 mt-0.5 truncate">
              Source: Demonstration incident fixtures (pilot baseline)
            </div>
          </div>
        </div>

        {/* Metric 2: High-Priority Zones */}
        <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526984]">
              High-Priority Zones
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-[#D9952C] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[26px] font-bold text-[#10243B] leading-none">
              {highPriorityZones.length}{' '}
              <span className="text-[14px] font-normal text-[#526984]">/ {zones.length}</span>
            </div>
            <div className="text-[11.5px] text-[#526984] mt-1.5">
              Urgent or High action priority
            </div>
            <div className="text-[10.5px] text-[#526984]/80 mt-0.5 truncate">
              Source: Decision Engine v5.0 evaluation
            </div>
          </div>
        </div>

        {/* Metric 3: Current Weather-Model Status */}
        <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526984]">
              Weather Model Signal
            </span>
            <div className="flex items-center gap-1.5">
              {onRefreshWeather && (
                <button
                  type="button"
                  onClick={onRefreshWeather}
                  disabled={isWeatherRefreshing || isWeatherLoading}
                  title="Query Open-Meteo for latest model forecast"
                  className="p-1 text-[#526984] hover:text-[#1769C2] rounded transition-colors disabled:opacity-50 cursor-pointer"
                  aria-label="Refresh numerical weather model"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isWeatherRefreshing || isWeatherLoading ? 'animate-spin text-[#1769C2]' : ''
                    }`}
                  />
                </button>
              )}
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#288EE8] flex items-center justify-center">
                <CloudRain className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[26px] font-bold text-[#10243B] leading-none">
              {Number(currentIntensity).toFixed(1)}{' '}
              <span className="text-[13px] font-normal text-[#526984]">mm/hr</span>
            </div>
            <div className="text-[11.5px] text-[#1769C2] font-medium mt-1.5 flex items-center gap-1">
              <span>{weatherStatusText}</span>
              <span>&middot;</span>
              <span>{weatherTimestamp}</span>
            </div>
            <div className="text-[10.5px] text-[#526984]/80 mt-0.5 truncate">
              Source: Open-Meteo NWP (~0.1&deg; grid)
            </div>
          </div>
        </div>

        {/* Metric 4: Pending Maintenance Actions */}
        <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#526984]">
              Maintenance Activity
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[26px] font-bold text-[#10243B] leading-none">
              {pendingMaintenance.length > 0 ? (
                `${pendingMaintenance.length} Pending`
              ) : (
                '0 Pending'
              )}
            </div>
            <div className="text-[11.5px] text-emerald-800 font-medium mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{maintenance.length} Recorded Action Log(s)</span>
            </div>
            <div className="text-[10.5px] text-[#526984] mt-0.5 truncate">
              {maintenance.filter((m) => m.data_status !== 'Demo action').length > 0
                ? `${maintenance.filter((m) => m.data_status !== 'Demo action').length} officer field log, `
                : ''}
              {maintenance.filter((m) => m.data_status === 'Demo action').length} demo fixture(s)
            </div>
            <div className="text-[10px] text-[#526984]/70 mt-0.5 truncate italic" title="Officer sign-off on record; independent physical verification pending.">
              Officer sign-off on record &middot; Physical sensor verification pending
            </div>
          </div>
        </div>
      </div>

      {/* Weather Refresh Notice if Error Occurs */}
      {weatherError && !isDemoMode && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-[12px] text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{weatherError}</span>
        </div>
      )}

      {/* SECTION 2: Balanced Two-Column Workspace (Map on Left, Priority Queue on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Geographic Risk Map (MapLibre CARTO) */}
        <div className="lg:col-span-6 flex flex-col">
          <MapLibreRiskMap
            zones={zones}
            incidents={incidents}
            selectedZoneId={selectedZoneId}
            selectedIncidentId={selectedIncidentId}
            onSelectZone={onSelectZone}
            onSelectIncident={onSelectIncident}
            layerState={layerState}
            variant="overview"
          />
        </div>

        {/* Right Column: Operational Priority Queue Table */}
        <div className="lg:col-span-6 flex flex-col">
          <OverviewPriorityQueue
            queue={queue}
            zones={zones}
            evaluations={evaluations}
            selectedZoneId={selectedZoneId}
            onSelectQueueItem={onSelectQueueItem}
            onSelectZone={onSelectZone}
          />
        </div>
      </div>

      {/* SECTION 3: Selected Zone Inspection Detail (Clean 3-Column Inspection) */}
      <HotspotInspector
        zone={selectedZone}
        incident={selectedIncident}
        zoneIncidents={zoneIncidents}
        zoneMaintenance={zoneMaintenance}
        evaluation={selectedEvaluation}
        allZones={zones}
        allEvaluations={evaluations}
        onUpdateIncidentState={onUpdateIncidentState}
        onOpenRecordAction={onOpenRecordAction}
        onRecurrenceDecision={onRecurrenceDecision}
        onSelectIncident={onSelectIncident}
        onSelectZone={onSelectZone}
      />
    </div>
  );
};
