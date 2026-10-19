import React, { useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import type { MaintenanceAction, PilotZone } from '../../../data/dashboardData';

interface MaintenanceViewProps {
  maintenance: MaintenanceAction[];
  zones?: PilotZone[];
  onOpenRecordAction: () => void;
  onSelectZone: (zoneId: string) => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenance,
  onOpenRecordAction,
  onSelectZone,
}) => {
  const [filterType, setFilterType] = useState<string>('All');

  const filtered = maintenance.filter(
    (m) => filterType === 'All' || m.action_type === filterType
  );

  return (
    <div className="space-y-6 select-none">
      {/* Header bar */}
      <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-[22px] font-normal text-[#10243B] leading-none">
            Municipal Maintenance Audit Trail
          </h2>
          <p className="text-[12px] text-[#526984] mt-1">
            Recorded desilting, culvert clearing, and verified municipal actions used to evaluate recurring hotspots.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 bg-[#F5F8FC] border border-[#CADDF0] rounded-lg text-[12px] font-semibold text-[#10243B] focus:outline-none"
          >
            <option value="All">All Action Categories</option>
            <option value="Clean / Desilt">Clean / Desilt</option>
            <option value="Culvert Clearing">Culvert Clearing</option>
            <option value="Inspect">Inspect</option>
            <option value="Pump Deployment">Pump Deployment</option>
            <option value="Engineering Assessment">Engineering Assessment</option>
          </select>

          <button
            type="button"
            onClick={onOpenRecordAction}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-lg text-[12px] font-bold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Action</span>
          </button>
        </div>
      </div>

      {/* Differentiator Explanation Banner */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#1769C2] shrink-0 mt-0.5" />
        <div className="text-[12.5px] text-[#10243B]">
          <strong>How JalDrishti uses maintenance records:</strong>
          <p className="text-[#526984] mt-0.5 leading-relaxed">
            Every recorded action updates the zone’s baseline. If a subsequent waterlogging report is logged within the configured 72-hour window post-maintenance, the recurrence rule flags the location for human review. Demonstration fixtures provide standard evaluation baselines, while operational records reflect field submissions logged by municipal officers (with independent physical sensor verification pending until ground-truth instrumentation is deployed).
          </p>
        </div>
      </div>

      {/* Timeline List */}
      <div className="bg-white rounded-xl border border-[#DCE6EF] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#DCE6EF] bg-[#F5F8FC]/50 text-[11px] font-bold text-[#526984] uppercase tracking-wider flex items-center justify-between">
          <span>Maintenance Actions Log ({filtered.length})</span>
          <span>Operational Logs & Demonstration Baseline</span>
        </div>

        <div className="divide-y divide-[#DCE6EF]">
          {filtered.map((m) => (
            <div key={m.action_id} className="p-5 hover:bg-[#F5F8FC]/60 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] font-bold text-[#1769C2] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    {m.action_id}
                  </span>
                  <h3 className="font-bold text-[15px] text-[#10243B]">
                    {m.action_type} &middot; {m.location_name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                    title="Sign-off logged on record; physical sensor verification pending."
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {m.status}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      m.data_status === 'Demo action'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {m.data_status === 'Demo action' ? 'Demo Fixture' : 'Operational Field Log'}
                  </span>
                </div>
              </div>

              {/* Details & Notes */}
              <div className="mt-2.5 text-[12.5px] text-[#526984] leading-relaxed">
                {m.notes}
              </div>

              {/* Metadata Footer */}
              <div className="mt-3 pt-2.5 border-t border-[#DCE6EF]/60 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#526984]">
                <div className="flex items-center gap-4">
                  <span>
                    Supervisor: <strong className="text-[#10243B]">{m.actor}</strong>
                  </span>
                  <span>
                    Logged: <strong className="text-[#10243B]">{new Date(m.created_at).toLocaleString()}</strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectZone(m.zone_id)}
                  className="text-[11.5px] font-bold text-[#1769C2] hover:underline flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  <span>Inspect Zone ({m.zone_id})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
