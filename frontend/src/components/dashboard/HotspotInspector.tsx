import React, { useState } from 'react';
import {
  CheckCircle2,
  Camera,
  ShieldAlert,
  Check,
  X,
  CloudRain,
  Sliders,
  PlusCircle,
} from 'lucide-react';
import type {
  PilotZone,
  IncidentRecord,
  MaintenanceAction,
  PriorityEvaluation,
} from '../../data/dashboardData';

interface HotspotInspectorProps {
  zone: PilotZone;
  incident: IncidentRecord;
  zoneIncidents: IncidentRecord[];
  zoneMaintenance: MaintenanceAction[];
  evaluation?: PriorityEvaluation;
  allZones?: PilotZone[];
  allEvaluations?: PriorityEvaluation[];
  onUpdateIncidentState: (incidentId: string, newState: IncidentRecord['review_state']) => void;
  onOpenRecordAction: () => void;
  onRecurrenceDecision: (incidentId: string, decision: 'confirmed' | 'dismissed', rationale: string) => void;
  onSelectIncident: (incidentId: string) => void;
  onSelectZone?: (zoneId: string) => void;
}

export const HotspotInspector: React.FC<HotspotInspectorProps> = ({
  zone,
  incident,
  zoneIncidents,
  zoneMaintenance,
  evaluation,
  onUpdateIncidentState,
  onOpenRecordAction,
  onRecurrenceDecision,
  onSelectIncident,
}) => {
  const [showDismissInput, setShowDismissInput] = useState(false);
  const [dismissRationale, setDismissRationale] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const getPriorityBadge = (band?: string, score?: number) => {
    switch (band) {
      case 'Urgent':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-900',
          dot: 'bg-[#D94C55]',
          label: `Urgent Priority (${score ?? 78}/100)`,
        };
      case 'High':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-900',
          dot: 'bg-[#D9952C]',
          label: `High Priority (${score ?? 47}/100)`,
        };
      case 'Moderate':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-900',
          dot: 'bg-[#2879D8]',
          label: `Moderate Priority (${score ?? 34}/100)`,
        };
      case 'Monitor':
      default:
        return {
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          text: 'text-slate-700',
          dot: 'bg-slate-400',
          label: `Monitor (${score ?? 0}/100)`,
        };
    }
  };

  const priorityBadge = getPriorityBadge(evaluation?.priority_band, evaluation?.priority_score);

  return (
    <div
      className="w-full bg-white rounded-xl border border-[#DCE6EF] shadow-xs overflow-hidden select-none"
      aria-label="Selected Zone Detail & Field Evidence"
    >
      {/* 1. Header: Zone Identification and Priority Badge */}
      <div className="p-4 border-b border-[#DCE6EF] bg-[#F5F8FC]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-[11px] font-bold text-[#1769C2] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              {zone.zone_id}
            </span>
            <span className="text-[12px] text-[#526984] font-medium">
              {zone.ward} &middot; Pilot Catchment
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${priorityBadge.bg} ${priorityBadge.border} ${priorityBadge.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${priorityBadge.dot}`} />
              {priorityBadge.label}
            </span>
          </div>

          <h3 className="text-[18px] font-bold text-[#10243B] truncate leading-tight">
            {zone.name}
          </h3>

          <div className="flex items-center gap-2 text-[11.5px] text-[#526984] mt-0.5 flex-wrap">
            <span>Drainage: <strong className="text-[#10243B] font-medium">{zone.drainage_nallah}</strong></span>
            <span>&middot;</span>
            <span>{zone.active_reports_count} open citizen report(s)</span>
            <span>&middot;</span>
            <span>Latest evidence: {incident.relative_time}</span>
          </div>
        </div>
      </div>

      {/* 2. Recurrence Alert Banner (Restrained municipal styling) */}
      {zone.has_recurrence_flag && incident.recurrence_details && (
        <div className="p-3.5 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-[#D94C55] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[12.5px] font-bold text-red-950">
                  Waterlogging Recurrence Detected Post-Maintenance
                </span>
                <span className="text-[11px] font-medium text-red-800">
                  {incident.recurrence_details.time_elapsed}
                </span>
              </div>
              <p className="text-[11.5px] text-red-900/90 mt-1 leading-normal">
                {incident.recurrence_details.rule_explanation}
              </p>

              {/* Working Recurrence Actions */}
              {incident.recurrence_details.status === 'flagged' && (
                <div className="mt-2.5 pt-2 border-t border-red-200/80 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      onRecurrenceDecision(
                        incident.incident_id,
                        'confirmed',
                        'Confirmed culvert constraint post-desilting. Escalated to Engineering Assessment.'
                      )
                    }
                    className="px-3 py-1 bg-[#D94C55] hover:bg-red-700 text-white rounded text-[11.5px] font-semibold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Escalate</span>
                  </button>

                  {!showDismissInput ? (
                    <button
                      type="button"
                      onClick={() => setShowDismissInput(true)}
                      className="px-3 py-1 bg-white hover:bg-red-100 text-red-900 border border-red-300 rounded text-[11.5px] font-medium transition-colors cursor-pointer"
                    >
                      Dismiss Flag...
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={dismissRationale}
                        onChange={(e) => setDismissRationale(e.target.value)}
                        placeholder="State reason for dismissal..."
                        className="flex-1 px-2.5 py-1 text-[11.5px] border border-red-300 rounded bg-white text-[#10243B] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (dismissRationale.trim()) {
                            onRecurrenceDecision(
                              incident.incident_id,
                              'dismissed',
                              dismissRationale.trim()
                            );
                            setShowDismissInput(false);
                          }
                        }}
                        className="px-2.5 py-1 bg-red-900 text-white text-[11px] font-semibold rounded cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDismissInput(false)}
                        className="p-1 text-red-700 hover:text-red-950 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {incident.recurrence_details.status === 'confirmed' && (
                <div className="mt-2 text-[11.5px] font-semibold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Recurrence Confirmed &middot; Escalated for Engineering Assessment</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Three-Column Balanced Detail Layout */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* PANEL 1: Risk & Priority Factors */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 border-b border-[#DCE6EF] pb-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#1769C2]" />
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#10243B]">
              1. Risk & Priority Factors
            </h4>
          </div>

          {/* Physical Risk */}
          <div className="p-3 bg-[#F5F8FC] rounded-lg border border-[#DCE6EF]">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-[#526984] uppercase tracking-wider">
                Physical Susceptibility
              </span>
              <span className="font-mono text-[12px] font-bold text-[#10243B]">
                {zone.risk_score} / 100 ({zone.risk_band.toUpperCase()})
              </span>
            </div>
            <p className="text-[11px] text-[#526984] mt-1 leading-tight">
              {zone.terrain_factor}
            </p>
          </div>

          {/* Weather Signal */}
          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-[#1769C2] uppercase tracking-wider flex items-center gap-1">
                <CloudRain className="w-3 h-3 text-[#1769C2]" />
                Regional Weather Signal
              </span>
              <span className="font-mono text-[12px] font-bold text-[#1769C2]">
                {evaluation?.regional_weather?.current_intensity_mm_hr ?? 0} mm/hr
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#526984] mt-1">
              <span>Urgency: {evaluation?.regional_weather?.urgency_band ?? 'Moderate'} ({evaluation?.regional_weather?.urgency_score ?? 0}/100)</span>
              <span className="text-[10px] font-medium text-[#10243B]">Open-Meteo NWP (~0.1&deg;)</span>
            </div>
          </div>

          {/* Recommended Action */}
          <div className="p-3 bg-[#F5F8FC] rounded-lg border border-[#DCE6EF]">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-[#526984] uppercase tracking-wider">
                Decision Support Action
              </span>
              <span className="font-mono text-[10px] text-[#526984]">
                Engine {evaluation?.engine_version ?? 'v5.0'}
              </span>
            </div>
            <div className="text-[13px] font-bold text-[#10243B] mt-1">
              {evaluation?.suggested_action ?? zone.drainage_nallah}
            </div>
            <p className="text-[11px] text-[#526984] mt-0.5 leading-snug">
              {evaluation?.action_rationale ?? 'Maintain baseline watch and verify inlet grates.'}
            </p>
          </div>

          {/* Factor Breakdown */}
          <div className="p-3 bg-[#F5F8FC] rounded-lg border border-[#DCE6EF] space-y-1.5 text-[11px]">
            <span className="font-bold text-[#10243B] block text-[10.5px] uppercase tracking-wider">
              Scoring Weights Breakdown
            </span>
            <div className="flex justify-between text-[#526984]">
              <span>Active Severity (35%):</span>
              <span className="font-mono font-bold text-[#10243B]">
                {evaluation?.factors.severity.score.toFixed(0) ?? 25} / 35
              </span>
            </div>
            <div className="flex justify-between text-[#526984]">
              <span>Recurrence Penalty (30%):</span>
              <span className="font-mono font-bold text-[#10243B]">
                {evaluation?.factors.recurrence.score.toFixed(0) ?? (zone.has_recurrence_flag ? 30 : 0)} / 30
              </span>
            </div>
            <div className="flex justify-between text-[#526984]">
              <span>Corroboration Velocity (20%):</span>
              <span className="font-mono font-bold text-[#10243B]">
                {evaluation?.factors.velocity_and_corroboration.score.toFixed(0) ?? 13} / 20
              </span>
            </div>
            <div className="flex justify-between text-[#526984]">
              <span>Signal Recency (15%):</span>
              <span className="font-mono font-bold text-[#10243B]">
                {evaluation?.factors.recency.score.toFixed(0) ?? 10} / 15
              </span>
            </div>
          </div>
        </div>

        {/* PANEL 2: Citizen Reports & Evidence */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE6EF] pb-1.5">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#10243B]">
              2. Open Reports & Evidence ({zoneIncidents.length})
            </h4>
            <span className="text-[10.5px] text-[#526984]">
              Click report to inspect
            </span>
          </div>

          {/* Incident List */}
          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {zoneIncidents.length === 0 ? (
              <div className="p-4 text-center text-[#526984] text-[12px] bg-[#F5F8FC] rounded-lg border border-[#DCE6EF]">
                No active incident reports for this zone.
              </div>
            ) : (
              zoneIncidents.map((inc) => {
                const isSelected = inc.incident_id === incident.incident_id;

                return (
                  <div
                    key={inc.incident_id}
                    onClick={() => onSelectIncident(inc.incident_id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#1769C2] bg-blue-50/40 shadow-xs'
                        : 'border-[#DCE6EF] bg-white hover:bg-[#F5F8FC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-[#1769C2]">
                          {inc.incident_id}
                        </span>
                        {/* Explicit Severity Tag */}
                        {inc.visual_severity === 'unassessed' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            Unassessed Severity (Citizen Text)
                          </span>
                        ) : inc.visual_severity === 'high' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-red-100 text-red-900 border border-red-200">
                            High Severity
                          </span>
                        ) : inc.visual_severity === 'moderate' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            Moderate Severity
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                            Low Severity
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#526984]">{inc.relative_time}</span>
                    </div>

                    <div className="text-[12px] font-bold text-[#10243B] leading-snug">
                      {inc.category}
                    </div>
                    <p className="text-[11px] text-[#526984] mt-0.5 line-clamp-2">
                      {inc.notes}
                    </p>

                    {/* Review State Selector */}
                    <div className="mt-2 pt-2 border-t border-[#DCE6EF] flex items-center justify-between text-[11px]">
                      <span className="text-[#526984]">Review State:</span>
                      <select
                        value={inc.review_state}
                        onChange={(e) =>
                          onUpdateIncidentState(
                            inc.incident_id,
                            e.target.value as IncidentRecord['review_state']
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-0.5 text-[11px] font-semibold text-[#10243B] bg-white border border-[#CADDF0] rounded focus:outline-none focus:border-[#1769C2]"
                      >
                        <option value="New">New</option>
                        <option value="Needs Review">Needs Review</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Duplicate">Duplicate</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Photo Evidence (if available) */}
          {incident.image_url && (
            <div className="pt-2 border-t border-[#DCE6EF]">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-bold text-[#10243B]">Citizen Photo Evidence</span>
                <span className="text-[10px] text-[#526984]">
                  AI Confidence: {(incident.ai_confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div
                className="relative rounded-lg overflow-hidden border border-[#DCE6EF] group cursor-pointer"
                onClick={() => setLightboxImage(incident.image_url)}
              >
                <img
                  src={incident.image_url}
                  alt={incident.image_caption}
                  className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                  <span className="text-white text-[10.5px] leading-tight font-medium">
                    {incident.image_caption}
                  </span>
                </div>
                <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded">
                  <Camera className="w-3 h-3" />
                </div>
              </div>
              <p className="text-[10.5px] text-[#526984] mt-1 italic">
                {incident.ai_uncertainty_notes || 'Depth inferred from visual landmarks. Field inspection required.'}
              </p>
            </div>
          )}
        </div>

        {/* PANEL 3: Maintenance Audit Trail & Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE6EF] pb-1.5">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#10243B]">
              3. Maintenance History ({zoneMaintenance.length})
            </h4>
            <span className="text-[10.5px] text-[#526984]">
              Officer Sign-Off Log
            </span>
          </div>

          {/* Maintenance Records */}
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {zoneMaintenance.length === 0 ? (
              <div className="p-4 text-center text-[#526984] text-[12px] bg-[#F5F8FC] rounded-lg border border-[#DCE6EF]">
                No maintenance records logged for this zone.
              </div>
            ) : (
              zoneMaintenance.map((m) => (
                <div
                  key={m.action_id}
                  className="p-3 bg-[#F5F8FC] rounded-lg border border-[#DCE6EF] space-y-1 text-[11.5px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#10243B]">
                      {m.action_type}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200"
                        title="Officer sign-off recorded; physical sensor verification pending."
                      >
                        {m.status}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          m.data_status === 'Demo action'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {m.data_status === 'Demo action' ? 'Demo Fixture' : 'Field Log'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#526984]">
                    Supervisor: <strong className="text-[#10243B]">{m.actor}</strong>
                  </div>
                  <p className="text-[11px] text-[#526984] leading-relaxed">
                    {m.notes}
                  </p>
                  <div className="text-[10px] text-[#526984] pt-1 border-t border-[#DCE6EF]/60 flex items-center justify-between">
                    <span>{m.action_id}</span>
                    <span>{new Date(m.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Record Maintenance Action Button */}
          <div className="pt-2 border-t border-[#DCE6EF] space-y-2">
            <button
              type="button"
              onClick={onOpenRecordAction}
              className="w-full py-2 px-3 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Maintenance Action</span>
            </button>
            <div className="text-[10.5px] text-[#526984] text-center">
              Standard guideline: &asymp; ₹30,000 &middot; 40 staff-hours
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Photo Evidence */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-2xl w-full bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-[#10243B] text-white flex items-center justify-between">
              <span className="text-[12px] font-bold">Field Evidence Geotag</span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={lightboxImage} alt="Citizen Evidence" className="w-full max-h-[70vh] object-contain bg-black" />
            <div className="p-3 bg-white text-[12px] text-[#10243B]">
              <div className="font-semibold">{incident.location_name}</div>
              <div className="text-[#526984] text-[11px] mt-0.5">{incident.image_caption}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
