import React, { useState } from 'react';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Compass,
  Info,
  Navigation,
} from 'lucide-react';
import type { PilotZone, IncidentRecord } from '../../data/dashboardData';

interface GisMapProps {
  zones: PilotZone[];
  incidents: IncidentRecord[];
  selectedZoneId: string;
  selectedIncidentId: string;
  onSelectZone: (zoneId: string) => void;
  onSelectIncident: (incidentId: string) => void;
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
  onSwitchToMapLibre?: () => void;
}

export const GisMap: React.FC<GisMapProps> = ({
  zones,
  incidents,
  selectedZoneId,
  selectedIncidentId,
  onSelectZone,
  onSelectIncident,
  layerState,
  onToggleLayer,
  onSwitchToMapLibre,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.2, 1.8));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.2, 0.8));
  const handleResetZoom = () => setZoomLevel(1);

  // Risk band styling helper
  const getRiskColor = (band: PilotZone['risk_band']) => {
    switch (band) {
      case 'high':
        return { fill: 'rgba(217, 76, 85, 0.28)', stroke: '#D94C55', badge: 'bg-[#D94C55]' };
      case 'moderate':
        return { fill: 'rgba(217, 149, 44, 0.25)', stroke: '#D9952C', badge: 'bg-[#D9952C]' };
      case 'low':
        return { fill: 'rgba(40, 121, 216, 0.20)', stroke: '#2879D8', badge: 'bg-[#2879D8]' };
      default:
        return { fill: 'rgba(148, 163, 184, 0.20)', stroke: '#94A3B8', badge: 'bg-[#94A3B8]' };
    }
  };

  return (
    <div
      className="relative w-full h-[540px] bg-[#EEF4F8] rounded-xl border border-[#DCE6EF] overflow-hidden select-none shadow-xs flex flex-col"
      aria-label="JalDrishti Interactive GIS Map"
    >
      {/* Top Map Bar: Pilot Header & Layer Control */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Map Context Tag */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#DCE6EF] shadow-2xs flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-[#526984] rotate-45" />
          <span className="text-[12px] font-semibold text-[#10243B]">
            Pilot Schematic
          </span>
          <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-semibold uppercase">
            Demo Fallback
          </span>
        </div>

        {/* Top Actions: Switch to MapLibre & Layer Toggle */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {onSwitchToMapLibre && (
            <button
              type="button"
              onClick={onSwitchToMapLibre}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-lg text-[11.5px] font-semibold shadow-2xs transition-colors"
              title="Switch to MapLibre CARTO vector GIS basemap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Use Vector GIS</span>
            </button>
          )}

          {/* Layer Toggle Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLayerMenu((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur-md border border-[#DCE6EF] rounded-lg text-[11.5px] font-medium text-[#10243B] hover:bg-white shadow-2xs transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-[#1769C2]" />
              <span>Layers</span>
            </button>

            {/* Layer Menu Popover */}
            {showLayerMenu && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-[#DCE6EF] rounded-xl shadow-lg p-2.5 z-20 space-y-1.5">
                <div className="text-[11px] font-bold text-[#526984] uppercase tracking-wider px-2 py-0.5">
                  Active GIS Layers
                </div>

              <label className="flex items-center justify-between px-2 py-1.5 hover:bg-[#F5F8FC] rounded-md cursor-pointer text-[12.5px] text-[#10243B]">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#D94C55]" />
                  Relative Zone Risk
                </span>
                <input
                  type="checkbox"
                  checked={layerState.relativeRisk}
                  onChange={() => onToggleLayer('relativeRisk')}
                  className="rounded text-[#1769C2] focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1.5 hover:bg-[#F5F8FC] rounded-md cursor-pointer text-[12.5px] text-[#10243B]">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1769C2]" />
                  Recent Incidents
                </span>
                <input
                  type="checkbox"
                  checked={layerState.recentIncidents}
                  onChange={() => onToggleLayer('recentIncidents')}
                  className="rounded text-[#1769C2] focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1.5 hover:bg-[#F5F8FC] rounded-md cursor-pointer text-[12.5px] text-[#10243B]">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-300" />
                  Simulated Rainfall Radar
                </span>
                <input
                  type="checkbox"
                  checked={layerState.rainfallRadar}
                  onChange={() => onToggleLayer('rainfallRadar')}
                  className="rounded text-[#1769C2] focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1.5 hover:bg-[#F5F8FC] rounded-md cursor-pointer text-[12.5px] text-[#10243B]">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Drainage Assets (Verified)
                </span>
                <input
                  type="checkbox"
                  checked={layerState.drainageAssets}
                  onChange={() => onToggleLayer('drainageAssets')}
                  className="rounded text-[#1769C2] focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1.5 hover:bg-[#F5F8FC] rounded-md cursor-pointer text-[12.5px] text-[#10243B]">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                  Critical Routes & Underpasses
                </span>
                <input
                  type="checkbox"
                  checked={layerState.criticalRoutes}
                  onChange={() => onToggleLayer('criticalRoutes')}
                  className="rounded text-[#1769C2] focus:ring-0"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Main Interactive Map Canvas (Vector SVG GIS renderer + Real Coordinates) */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 720 480"
          className="w-full h-full transition-transform duration-300 ease-out cursor-grab active:cursor-grabbing"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            {/* Radar Simulation Gradient */}
            <radialGradient id="radarScan" cx="35%" cy="30%" r="50%">
              <stop offset="0%" stopColor="#288EE8" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#288EE8" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#288EE8" stopOpacity="0" />
            </radialGradient>

            {/* High Risk Glow Filter */}
            <filter id="highRiskGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#D94C55" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* 1. Base Cartography: Waterbody (Thane Creek Channel to the West) */}
          <path
            d="M 0,0 L 70,0 Q 80,120 60,240 T 80,480 L 0,480 Z"
            fill="#D5E8F7"
            stroke="#BDD9EE"
            strokeWidth="1.5"
          />
          <text x="15" y="260" fill="#6A96BC" fontSize="10" fontWeight="bold" letterSpacing="0.2em" transform="rotate(-90 15 260)">
            THANE CREEK TIDAL BASIN
          </text>

          {/* 2. Municipal Arterial Roads & Railway Corridors */}
          {/* Sion-Panvel Highway */}
          <path
            d="M 60,70 Q 240,110 520,130 T 720,140"
            fill="none"
            stroke="#CBDCEB"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M 60,70 Q 240,110 520,130 T 720,140"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Palm Beach Road */}
          <path
            d="M 80,120 Q 140,240 180,360 T 260,480"
            fill="none"
            stroke="#CBDCEB"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 80,120 Q 140,240 180,360 T 260,480"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Harbor Railway Line */}
          <path
            d="M 120,40 L 440,460"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2"
            strokeDasharray="5 3"
          />

          {/* Road Labels */}
          <text x="280" y="105" fill="#526984" fontSize="9.5" fontWeight="600" letterSpacing="0.05em">
            Sion–Panvel Expressway
          </text>
          <text x="145" y="270" fill="#526984" fontSize="9" fontWeight="600" transform="rotate(65 145 270)">
            Palm Beach Road
          </text>
          <text x="320" y="325" fill="#718BA3" fontSize="8.5" fontWeight="500" transform="rotate(52 320 325)">
            Harbor Railway Line (Sanpada - Nerul)
          </text>

          {/* 3. Verified Drainage Features (When Layer Active) */}
          {layerState.drainageAssets && (
            <g id="drainage-network" stroke="#0D9488" strokeWidth="2" strokeDasharray="3 2" fill="none">
              {/* Sanpada Storm Nallah #2 */}
              <path d="M 230,120 Q 180,150 70,160" />
              {/* Nerul Creek Outfall */}
              <path d="M 400,240 Q 320,290 85,340" />
              {/* Culvert Intake Points */}
              <circle cx="230" cy="120" r="3.5" fill="#0D9488" />
              <circle cx="400" cy="240" r="3.5" fill="#0D9488" />
            </g>
          )}

          {/* 4. Simulated Rainfall Cloud Deck / Radar Layer */}
          {layerState.rainfallRadar && (
            <ellipse cx="250" cy="160" rx="220" ry="160" fill="url(#radarScan)" className="animate-pulse" />
          )}

          {/* 5. Pilot Zone Polygons */}
          {layerState.relativeRisk &&
            zones.map((zone) => {
              const isSelected = selectedZoneId === zone.zone_id;
              const { fill, stroke } = getRiskColor(zone.risk_band);

              return (
                <g key={zone.zone_id} className="cursor-pointer group" onClick={() => onSelectZone(zone.zone_id)}>
                  <path
                    d={zone.svgPolygon}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? '3' : '1.8'}
                    strokeDasharray={zone.risk_band === 'insufficient' ? '4 3' : 'none'}
                    className="transition-all duration-200 group-hover:brightness-95"
                    filter={zone.risk_band === 'high' ? 'url(#highRiskGlow)' : undefined}
                  />

                  {/* Recurrence Warning Border Highlight */}
                  {zone.has_recurrence_flag && (
                    <path
                      d={zone.svgPolygon}
                      fill="none"
                      stroke="#D94C55"
                      strokeWidth="3.5"
                      strokeDasharray="6 4"
                      className="animate-pulse"
                    />
                  )}
                </g>
              );
            })}

          {/* 6. Zone Center Labels */}
          {zones.map((zone) => {
            const isSelected = selectedZoneId === zone.zone_id;
            // Center coordinates for zone text
            let tx = 250;
            let ty = 140;
            if (zone.zone_id === 'NZ-SAN-01') {
              tx = 245;
              ty = 135;
            } else if (zone.zone_id === 'NZ-NER-02') {
              tx = 355;
              ty = 250;
            } else if (zone.zone_id === 'NZ-NER-03') {
              tx = 505;
              ty = 320;
            } else if (zone.zone_id === 'NZ-SAN-04') {
              tx = 165;
              ty = 235;
            } else if (zone.zone_id === 'NZ-NER-05') {
              tx = 290;
              ty = 375;
            }

            return (
              <g
                key={`label-${zone.zone_id}`}
                className="cursor-pointer pointer-events-auto"
                onClick={() => onSelectZone(zone.zone_id)}
              >
                <rect
                  x={tx - 70}
                  y={ty - 16}
                  width="140"
                  height="22"
                  rx="5"
                  fill={isSelected ? '#10243B' : 'white'}
                  stroke={isSelected ? '#1769C2' : '#CADDF0'}
                  strokeWidth="1.2"
                  className="shadow-xs"
                />
                <text
                  x={tx}
                  y={ty - 2}
                  textAnchor="middle"
                  fill={isSelected ? 'white' : '#10243B'}
                  fontSize="9"
                  fontWeight="bold"
                >
                  {zone.name.split(' (')[0]}
                </text>
              </g>
            );
          })}

          {/* 7. Incident Pins & Clusters */}
          {layerState.recentIncidents &&
            incidents.map((incident) => {
              const isSelected = selectedIncidentId === incident.incident_id;
              // Map approximate coordinate offsets
              let px = 240;
              let py = 145;
              if (incident.incident_id === 'INC-2026-089') {
                px = 245;
                py = 148;
              } else if (incident.incident_id === 'INC-2026-088') {
                px = 360;
                py = 260;
              } else if (incident.incident_id === 'INC-2026-084') {
                px = 510;
                py = 330;
              } else if (incident.incident_id === 'INC-2026-081') {
                px = 175;
                py = 245;
              } else if (incident.incident_id === 'INC-2026-075') {
                px = 300;
                py = 385;
              } else if (incident.incident_id === 'INC-2026-068') {
                px = 275;
                py = 120;
              } else if (incident.incident_id === 'INC-2026-065') {
                px = 380;
                py = 275;
              }

              const pinColor =
                incident.visual_severity === 'high'
                  ? '#D94C55'
                  : incident.visual_severity === 'moderate'
                  ? '#D9952C'
                  : incident.visual_severity === 'low'
                  ? '#2879D8'
                  : '#64748B';

              return (
                <g
                  key={incident.incident_id}
                  className="cursor-pointer group"
                  onClick={() => {
                    onSelectIncident(incident.incident_id);
                    onSelectZone(incident.zone_id);
                  }}
                >
                  {/* Outer pulse for high severity */}
                  {incident.visual_severity === 'high' && (
                    <circle cx={px} cy={py} r="14" fill={pinColor} opacity="0.2" className="animate-ping" />
                  )}

                  {/* Marker Pin */}
                  <circle
                    cx={px}
                    cy={py}
                    r={isSelected ? '10' : '7.5'}
                    fill={pinColor}
                    stroke="white"
                    strokeWidth="2"
                    className="transition-all group-hover:scale-125"
                  />

                  {/* Report Count inside marker */}
                  <text
                    x={px}
                    y={py + 3}
                    textAnchor="middle"
                    fill="white"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    {incident.report_count}
                  </text>

                  {/* Recurrence Badge above pin */}
                  {incident.has_recurrence_flag && (
                    <g transform={`translate(${px - 6}, ${py - 18})`}>
                      <rect width="12" height="12" rx="3" fill="#D94C55" />
                      <text x="6" y="9.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">
                        !
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
        </svg>
      </div>

      {/* Floating Map Controls (Zoom In, Zoom Out, Reset Center) */}
      <div className="absolute right-3 bottom-12 z-10 flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-[#DCE6EF] shadow-xs">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-[#F5F8FC] text-[#10243B] rounded transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-[#F5F8FC] text-[#10243B] rounded transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          className="p-1.5 hover:bg-[#F5F8FC] text-[#10243B] rounded transition-colors"
          title="Reset View to Pilot Boundaries"
          aria-label="Reset View"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Map Legend (Bottom-Left) */}
      <div className="absolute left-3 bottom-10 z-10 bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-[#DCE6EF] shadow-xs">
        <div className="text-[10px] font-bold text-[#526984] uppercase tracking-wider mb-1">
          Relative Zone Risk
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-[#10243B]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#D94C55]" />
            High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#D9952C]" />
            Moderate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#2879D8]" />
            Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#94A3B8]" />
            Insufficient
          </span>
        </div>
      </div>

      {/* Map Legal Attribution Footer */}
      <div className="bg-white/90 border-t border-[#DCE6EF] px-3 py-1 flex items-center justify-between text-[10px] text-[#526984] z-10">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3 text-[#526984]" />
          <span>Demonstration pilot geometry &middot; Navi Mumbai Municipal Corporation (NMMC)</span>
        </div>
        <div>
          <span>&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-[#1769C2]">OpenStreetMap</a> contributors</span>
        </div>
      </div>
    </div>
  );
};
