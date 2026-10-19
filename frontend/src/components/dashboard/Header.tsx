import {
  AlertTriangle,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import type { DashboardView, DataMode } from '../../data/dashboardStore';

interface HeaderProps {
  currentView: DashboardView;
  unreadAlertsCount: number;
  dataMode: DataMode;
  apiConnected: boolean;
  apiError: string | null;
  isLoading: boolean;
  onToggleNotifications: () => void;
  onOpenRecordAction: () => void;
  onTriggerRecurrenceSim: () => void;
  onRetryConnection?: () => void;
  onToggleDataMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  unreadAlertsCount: _unreadAlertsCount,
  dataMode,
  apiConnected,
  apiError,
  isLoading,
  onToggleNotifications: _onToggleNotifications,
  onOpenRecordAction,
  onTriggerRecurrenceSim: _onTriggerRecurrenceSim,
  onRetryConnection,
  onToggleDataMode,
}) => {
  const getPageTitle = () => {
    switch (currentView) {
      case 'overview':
        return {
          title: 'Operations Overview',
          subtitle:
            'Nerul–Sanpada pilot catchment, Navi Mumbai',
        };
      case 'incidents':
        return {
          title: 'Citizen Incident Triage',
          subtitle:
            'Review, verify, and deduplicate citizen waterlogging reports with photo evidence.',
        };
      case 'map':
        return {
          title: 'GIS Flood Risk Map',
          subtitle:
            'Spatial visualization of depression basins, verified citizen GPS geotags, and zone risk.',
        };
      case 'queue':
        return {
          title: 'Priority Action Queue',
          subtitle:
            'Deterministic, evidence-ranked action shortlist for municipal maintenance crews.',
        };
      case 'maintenance':
        return {
          title: 'Maintenance Log & Audit Trail',
          subtitle:
            'Chronological record of desilting, culvert clearing, and verified municipal actions.',
        };
      case 'analytics':
        return {
          title: 'Historical Event Replay',
          subtitle:
            'Model calibration against extreme monsoon case studies in Navi Mumbai.',
        };
      case 'data_layers':
        return {
          title: 'Data Sources & Provenance',
          subtitle:
            'Catalog of weather feeds, spatial boundaries, and municipal infrastructure layers.',
        };
      case 'zones':
        return {
          title: 'Pilot Zone Directory',
          subtitle:
            'Catchment profiles, physical terrain risk factors, and drainage outfall parameters.',
        };
      case 'settings':
        return {
          title: 'Control Room Preferences',
          subtitle:
            'Recurrence threshold settings, alert rules, and simulation controls.',
        };
      default:
        return {
          title: 'Operations Overview',
          subtitle:
            'Nerul–Sanpada pilot catchment, Navi Mumbai',
        };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <header className="bg-white border-b border-[#DCE6EF] px-6 py-3.5 sticky top-0 z-10 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Title & Subtitle */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-[24px] lg:text-[26px] font-normal text-[#10243B] leading-tight tracking-tight">
              {title}
            </h1>

            {/* Single Source/System Status Indicator */}
            {dataMode === 'api' ? (
              apiConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>Flask API Connected</span>
                </span>
              ) : isLoading ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-[#1769C2] border border-blue-200">
                  <RefreshCw className="w-3 h-3 animate-spin text-[#1769C2]" />
                  <span>Connecting...</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                  <span>Backend Offline</span>
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Demo Mode</span>
              </span>
            )}
          </div>
          <p className="font-sans text-[12.5px] text-[#526984] mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Right: Actions (Hidden on Overview to avoid duplicate/unconnected controls) */}
        {currentView !== 'overview' && (
          <div className="flex items-center gap-2">
            {/* Record Action CTA */}
            <button
              type="button"
              onClick={onOpenRecordAction}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-lg text-[12px] font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Action</span>
            </button>
          </div>
        )}
      </div>

      {/* Connection Error Banner (When API is offline in API mode) */}
      {dataMode === 'api' && apiError && (
        <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[12px] text-red-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{apiError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRetryConnection && (
              <button
                type="button"
                onClick={onRetryConnection}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
            {onToggleDataMode && (
              <button
                type="button"
                onClick={onToggleDataMode}
                className="px-2.5 py-1 bg-white hover:bg-red-100 text-red-900 border border-red-300 rounded text-[11px] font-medium transition-colors cursor-pointer"
              >
                Switch to Demo Mode
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
