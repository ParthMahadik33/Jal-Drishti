import React, { useState } from 'react';
import { GisMap } from '../GisMap';
import { MapLibreRiskMap } from '../MapLibreRiskMap';
import type { PilotZone, IncidentRecord } from '../../../data/dashboardData';
import {
  MapPin,
  AlertTriangle,
  Info,
  Layers,
  ShieldAlert,
  X,
} from 'lucide-react';
import { buildCartoStyleUrl, prepareIncidentMarkers } from '../../../utils/geoUtils';

interface RiskMapViewProps {
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
}

export const RiskMapView: React.FC<RiskMapViewProps> = (props) => {
  const cartoApiKey = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();
  const cartoConfig = buildCartoStyleUrl(cartoApiKey);

  const [mapEngine, setMapEngine] = useState<'maplibre' | 'schematic'>(
    cartoConfig.hasKey ? 'maplibre' : 'maplibre'
  );

  const selectedZone = props.zones.find((z) => z.zone_id === props.selectedZoneId) || props.zones[0];
  const selectedIncident = props.incidents.find((i) => i.incident_id === props.selectedIncidentId);

  const { mappedMarkers, unmappedCount } = prepareIncidentMarkers(props.incidents);

  return (
    <div className="space-y-4 select-none">
      {/* Top Map Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#DCE6EF]/70">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#10243B]">
            Interactive Spatial Viewer &middot; Nerul &amp; Sanpada Pilot
          </span>
          <span className="text-[11px] text-[#526984] font-mono">
            ({props.zones.length} Zones &middot; {mappedMarkers.length} Mapped Pins)
          </span>
        </div>

        {/* Engine Switcher */}
        <div className="flex items-center gap-2">
          <div className="bg-white p-0.5 rounded-lg border border-[#DCE6EF] flex items-center text-[11.5px] font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setMapEngine('maplibre')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                mapEngine === 'maplibre'
                  ? 'bg-[#1769C2] text-white font-semibold'
                  : 'text-[#526984] hover:text-[#10243B]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>MapLibre Vector GIS</span>
            </button>
            <button
              type="button"
              onClick={() => setMapEngine('schematic')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                mapEngine === 'schematic'
                  ? 'bg-[#1769C2] text-white font-semibold'
                  : 'text-[#526984] hover:text-[#10243B]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Illustrated Schematic</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Map Viewer (Dominant: 8 columns) */}
        <div className="lg:col-span-8 space-y-3">
          {mapEngine === 'maplibre' ? (
            <MapLibreRiskMap
              zones={props.zones}
              incidents={props.incidents}
              selectedZoneId={props.selectedZoneId}
              selectedIncidentId={props.selectedIncidentId}
              onSelectZone={props.onSelectZone}
              onSelectIncident={props.onSelectIncident}
              layerState={props.layerState}
              variant="full"
              onSwitchToSvgFallback={() => setMapEngine('schematic')}
            />
          ) : (
            <GisMap
              {...props}
              onSwitchToMapLibre={cartoConfig.hasKey ? () => setMapEngine('maplibre') : undefined}
            />
          )}

          {/* Spatial Coverage Footer */}
          <div className="bg-white px-3.5 py-2 rounded-lg border border-[#DCE6EF] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-[#526984]">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-[#10243B]">GPS Audit:</span>
              <span>
                <strong>{mappedMarkers.length}</strong> Geotagged Pins
              </span>
              {unmappedCount > 0 && (
                <>
                  <span>&middot;</span>
                  <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>{unmappedCount} Approximate (Landmark-inferred)</span>
                  </span>
                </>
              )}
            </div>

            <div className="text-[11px] text-[#526984] flex items-center gap-1">
              <Info className="w-3 h-3 text-[#1769C2]" />
              <span>NMMC administrative ward boundary vectors pending municipal GIS feed import.</span>
            </div>
          </div>
        </div>

        {/* Side Inspector (4 columns) */}
        <div className="lg:col-span-4 space-y-3.5">
          {/* Selected Incident Inspector */}
          {selectedIncident ? (
            <div className="bg-white p-4 rounded-xl border border-[#1769C2] shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[11px] font-bold text-[#1769C2]">
                  {selectedIncident.incident_id}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      selectedIncident.visual_severity === 'high'
                        ? 'bg-red-50 text-red-900 border border-red-200'
                        : selectedIncident.visual_severity === 'moderate'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-blue-50 text-blue-900 border border-blue-200'
                    }`}
                  >
                    {selectedIncident.visual_severity}
                  </span>
                  <button
                    type="button"
                    onClick={() => props.onSelectIncident('')}
                    className="text-[#526984] hover:text-[#10243B] p-0.5 rounded"
                    title="Deselect incident"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h4 className="text-[14px] font-bold text-[#10243B] leading-snug">
                {selectedIncident.location_name}
              </h4>

              <div className="flex items-center gap-2 text-[11px] text-[#526984] mt-1 mb-2.5">
                <span>{selectedIncident.category}</span>
                <span>&middot;</span>
                <span>{selectedIncident.relative_time}</span>
              </div>

              {selectedIncident.image_url && (
                <div className="mb-2.5 rounded-lg overflow-hidden border border-[#DCE6EF]">
                  <img
                    src={selectedIncident.image_url}
                    alt={selectedIncident.image_caption || selectedIncident.location_name}
                    className="w-full h-28 object-cover"
                  />
                  {selectedIncident.image_caption && (
                    <div className="bg-[#F5F8FC] p-1.5 text-[10.5px] text-[#526984] italic">
                      {selectedIncident.image_caption}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11.5px] text-[#526984] leading-relaxed mb-3">
                {selectedIncident.notes || selectedIncident.reporter_summary}
              </p>

              <div className="pt-2 border-t border-[#DCE6EF] flex items-center justify-between text-[11px]">
                <span className="text-[#526984]">
                  Zone: <strong>{selectedIncident.zone_id}</strong>
                </span>
                <span className="font-semibold text-slate-800">
                  Status: {selectedIncident.review_state}
                </span>
              </div>
            </div>
          ) : selectedZone ? (
            /* Selected Zone Detail Card */
            <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[11px] font-bold text-[#1769C2]">
                  {selectedZone.zone_id}
                </span>
                <span
                  className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    selectedZone.risk_band === 'high'
                      ? 'bg-red-50 text-red-900 border border-red-200'
                      : selectedZone.risk_band === 'moderate'
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : 'bg-blue-50 text-blue-900 border border-blue-200'
                  }`}
                >
                  {selectedZone.risk_band} Risk
                </span>
              </div>
              <h4 className="text-[14px] font-bold text-[#10243B] leading-snug">
                {selectedZone.name}
              </h4>
              <p className="text-[11.5px] text-[#526984] mt-1 leading-relaxed">
                {selectedZone.description}
              </p>
              <div className="mt-2.5 pt-2 border-t border-[#DCE6EF] flex items-center justify-between text-[11px] text-[#526984]">
                <span>Active Reports: <strong>{selectedZone.active_reports_count}</strong></span>
                <span>Ward: <strong>{selectedZone.ward}</strong></span>
              </div>
            </div>
          ) : null}

          {/* Pilot Zones Directory */}
          <div className="bg-white p-3.5 rounded-xl border border-[#DCE6EF] shadow-xs">
            <div className="text-[11.5px] font-bold text-[#10243B] uppercase tracking-wider mb-2.5">
              Pilot Catchments ({props.zones.length})
            </div>

            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-0.5">
              {props.zones.map((zone) => {
                const isSelected = props.selectedZoneId === zone.zone_id;
                return (
                  <div
                    key={zone.zone_id}
                    onClick={() => {
                      props.onSelectZone(zone.zone_id);
                    }}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#1769C2] bg-blue-50/40 shadow-2xs'
                        : 'border-[#DCE6EF] hover:bg-[#F5F8FC]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-mono text-[10.5px] font-bold text-[#1769C2]">
                        {zone.zone_id}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          zone.risk_band === 'high'
                            ? 'bg-red-50 text-red-900 border border-red-200'
                            : zone.risk_band === 'moderate'
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-blue-50 text-blue-900 border border-blue-200'
                        }`}
                      >
                        {zone.risk_band}
                      </span>
                    </div>

                    <div className="text-[12.5px] font-bold text-[#10243B] leading-snug">
                      {zone.name}
                    </div>

                    <div className="text-[10.5px] text-[#526984] mt-0.5 truncate">
                      {zone.terrain_factor}
                    </div>

                    {zone.has_recurrence_flag && (
                      <div className="mt-1 text-[10px] font-bold text-red-700 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-[#D94C55]" />
                        <span>Recurring Post-Maintenance</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
