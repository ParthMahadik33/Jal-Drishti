import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Map,
  ListOrdered,
  Wrench,
  BarChart3,
  Layers,
  MapPin,
  Settings,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { DashboardView } from '../../data/dashboardStore';
import logoWithText from '../../assets/logo-with-text.png';

interface SidebarProps {
  currentView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  onNavigateHome: () => void;
  dataMode?: 'api' | 'demo';
  onToggleDataMode?: () => void;
}

const NAV_ITEMS: { id: DashboardView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'map', label: 'Risk Map', icon: Map },
  { id: 'queue', label: 'Action Queue', icon: ListOrdered },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'data_layers', label: 'Data & Layers', icon: Layers },
  { id: 'zones', label: 'Zones', icon: MapPin },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onNavigateHome,
  dataMode = 'api',
  onToggleDataMode,
}) => {
  return (
    <aside
      className="w-64 bg-white border-r border-[#DCE6EF] flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-20"
      aria-label="Officer Dashboard Navigation"
    >
      {/* Top Brand & Navigation */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-[#DCE6EF] flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2 group text-left focus:outline-none"
              title="Return to JalDrishti public homepage"
            >
              <img
                src={logoWithText}
                alt="JalDrishti"
                className="h-10 w-auto object-contain transition-transform group-hover:scale-[1.02]"
                style={{ mixBlendMode: 'multiply' }}
              />
            </button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] font-semibold text-[#1769C2] tracking-[0.16em] uppercase">
              OFFICER CONTROL ROOM
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EAF5FF] text-[#1769C2] border border-[#CADDF0]">
              PILOT V1.0
            </span>
          </div>
        </div>

        {/* Navigation Rail */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#1769C2] text-white shadow-xs font-semibold'
                    : 'text-[#526984] hover:bg-[#F5F8FC] hover:text-[#10243B]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-[#526984]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile, Demo Mode, & Public Site Link */}
      <div className="p-4 border-t border-[#DCE6EF] space-y-3 bg-[#F5F8FC]/60">
        {/* Persistent Mode Indicator */}
        <div
          className={`border rounded-lg p-2.5 flex items-start gap-2 ${
            dataMode === 'api'
              ? 'bg-emerald-50 border-emerald-200/80 text-emerald-950'
              : 'bg-amber-50 border-amber-200/80 text-amber-950'
          }`}
        >
          <ShieldCheck
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              dataMode === 'api' ? 'text-emerald-700' : 'text-amber-700'
            }`}
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  dataMode === 'api' ? 'text-emerald-900' : 'text-amber-900'
                }`}
              >
                {dataMode === 'api' ? 'API PERSISTENCE' : 'DEMO MODE'}
              </span>
            </div>
            <p
              className={`text-[11px] leading-tight mt-0.5 ${
                dataMode === 'api'
                  ? 'text-emerald-800/90'
                  : 'text-amber-800/90'
              }`}
            >
              {dataMode === 'api'
                ? 'Flask API + SQLite database active.'
                : 'Simulated weather & local fixtures.'}
            </p>
            {onToggleDataMode && (
              <button
                type="button"
                onClick={onToggleDataMode}
                className="mt-1 text-[10px] font-semibold text-[#1769C2] hover:underline block"
              >
                Switch to {dataMode === 'api' ? 'Local Demo' : 'API Mode'}
              </button>
            )}
          </div>
        </div>

        {/* Signed-in Officer Context */}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="w-8 h-8 rounded-full bg-[#1769C2] text-white flex items-center justify-center font-bold text-[12px] shadow-xs">
            PD
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-[#10243B] truncate leading-tight">
              Officer P. Deshmukh
            </div>
            <div className="text-[11px] text-[#526984] truncate">
              Zone 4 Control &middot; NMMC
            </div>
          </div>
        </div>

        {/* Switch back to Public Website */}
        <button
          onClick={onNavigateHome}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[12px] font-medium text-[#1769C2] bg-white border border-[#CADDF0] hover:border-[#1769C2] hover:bg-[#EAF5FF]/50 rounded-lg transition-colors shadow-xs"
        >
          <span>Return to Homepage</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
