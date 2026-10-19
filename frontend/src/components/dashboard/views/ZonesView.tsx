import React from 'react';
import { MapPin, ShieldAlert, ArrowRight } from 'lucide-react';
import type { PilotZone } from '../../../data/dashboardData';

interface ZonesViewProps {
  zones: PilotZone[];
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
  onNavigateToOverview: () => void;
}

export const ZonesView: React.FC<ZonesViewProps> = ({
  zones,
  selectedZoneId,
  onSelectZone,
  onNavigateToOverview,
}) => {
  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1769C2]" />
            <h2 className="font-serif text-[22px] font-normal text-[#10243B] leading-none">
              Pilot Zones Directory
            </h2>
          </div>
          <p className="text-[12px] text-[#526984] mt-1">
            Catchment profiles and infrastructure characteristics across Nerul and Sanpada wards.
          </p>
        </div>
        <div className="text-[11px] font-semibold text-[#526984] bg-[#F5F8FC] border border-[#CADDF0] px-3 py-1.5 rounded-lg self-start sm:self-auto">
          5 Curated Pilot Zones &middot; NMMC Ward 4 Catchment Model
        </div>
      </div>

      {/* Zones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {zones.map((zone) => {
          const isSelected = selectedZoneId === zone.zone_id;

          return (
            <div
              key={zone.zone_id}
              className={`bg-white rounded-xl border p-5 shadow-xs transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-[#1769C2] ring-1 ring-[#1769C2]/20'
                  : 'border-[#DCE6EF] hover:border-[#CADDF0]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[11px] font-bold text-[#1769C2] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    {zone.zone_id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      zone.risk_band === 'high'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : zone.risk_band === 'moderate'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {zone.risk_band} RISK
                  </span>
                </div>

                <h3 className="font-bold text-[16px] text-[#10243B] leading-snug">
                  {zone.name}
                </h3>
                <div className="text-[11.5px] text-[#526984] font-medium">
                  {zone.ward}
                </div>

                <p className="text-[12px] text-[#526984] leading-relaxed">
                  {zone.description}
                </p>

                <div className="p-3 bg-[#F5F8FC] rounded-lg border border-[#DCE6EF] space-y-1.5 text-[11.5px] text-[#526984]">
                  <div>
                    <strong className="text-[#10243B]">Terrain Profile:</strong> {zone.terrain_factor}
                  </div>
                  <div>
                    <strong className="text-[#10243B]">Primary Outfall:</strong> {zone.drainage_nallah}
                  </div>
                </div>

                {zone.has_recurrence_flag && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-[11px] text-red-950 font-bold">
                    <ShieldAlert className="w-4 h-4 text-[#D94C55] shrink-0" />
                    <span>Recurrence Flag Active</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#DCE6EF] mt-4 flex items-center justify-between">
                <span className="text-[11.5px] text-[#526984]">
                  Active Reports: <strong className="text-[#10243B]">{zone.active_reports_count}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    onSelectZone(zone.zone_id);
                    onNavigateToOverview();
                  }}
                  className="text-[11.5px] font-bold text-[#1769C2] hover:underline flex items-center gap-1"
                >
                  <span>Inspect on Overview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
