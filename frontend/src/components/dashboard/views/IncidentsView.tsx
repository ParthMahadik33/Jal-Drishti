import React, { useState } from 'react';
import {
  Search,
  Clock,
  MapPin,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import type { IncidentRecord } from '../../../data/dashboardData';

interface IncidentsViewProps {
  incidents: IncidentRecord[];
  onUpdateIncidentState: (incidentId: string, newState: IncidentRecord['review_state']) => void;
  onSelectZone: (zoneId: string) => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onUpdateIncidentState,
  onSelectZone,
}) => {
  const [filterState, setFilterState] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const filtered = incidents.filter((inc) => {
    const matchesFilter = filterState === 'All' || inc.review_state === filterState;
    const matchesSearch =
      inc.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.incident_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.notes.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getSeverityBadge = (severity: IncidentRecord['visual_severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'moderate':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'low':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'unassessed':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Top Controls: Search, Filters, & Counts */}
      <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-[22px] font-normal text-[#10243B] leading-none">
            Citizen Submissions & Triage
          </h2>
          <p className="text-[12px] text-[#526984] mt-1">
            Pilot incident triage &amp; verification. Demonstrating unassessed vs. verified review workflow using baseline fixtures.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-[#526984] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports or IDs..."
              className="pl-9 pr-3 py-1.5 text-[12.5px] bg-[#F5F8FC] border border-[#CADDF0] rounded-lg text-[#10243B] focus:outline-none focus:border-[#1769C2] w-52"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#F5F8FC] p-1 border border-[#DCE6EF] rounded-lg">
            {['All', 'New', 'Needs Review', 'Confirmed', 'Duplicate', 'Closed'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterState(s)}
                className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-md transition-colors ${
                  filterState === s
                    ? 'bg-[#1769C2] text-white shadow-xs'
                    : 'text-[#526984] hover:text-[#10243B]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((inc) => (
          <div
            key={inc.incident_id}
            className="bg-white rounded-xl border border-[#DCE6EF] overflow-hidden shadow-xs hover:border-[#CADDF0] transition-all flex flex-col justify-between"
          >
            <div>
              {/* Photo Header */}
              <div
                className="relative h-44 bg-slate-100 overflow-hidden cursor-pointer group"
                onClick={() => setSelectedPhoto(inc.image_url)}
              >
                <img
                  src={inc.image_url}
                  alt={inc.image_caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold bg-white/95 text-[#10243B] px-2 py-0.5 rounded shadow-xs">
                    {inc.incident_id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityBadge(
                      inc.visual_severity
                    )} bg-white/95`}
                  >
                    {inc.visual_severity.toUpperCase()} SEVERITY
                  </span>
                </div>

                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                    {(inc.ai_confidence * 100).toFixed(0)}% AI CONFIDENCE
                  </span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-3">
                  <span className="text-white text-[11.5px] font-medium leading-tight">
                    {inc.image_caption}
                  </span>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-[14.5px] text-[#10243B] leading-tight">
                      {inc.location_name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-[#526984] mt-0.5">
                      <MapPin className="w-3 h-3 text-[#1769C2]" />
                      <span>{inc.zone_id}</span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {inc.relative_time}
                      </span>
                    </div>
                  </div>

                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    {inc.data_status}
                  </span>
                </div>

                <p className="text-[12px] text-[#526984] leading-relaxed line-clamp-2">
                  {inc.notes}
                </p>

                {/* Recurrence Flag Indicator */}
                {inc.has_recurrence_flag && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-[11px] text-red-900 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#D94C55] shrink-0" />
                    <span>Possible recurrence post-maintenance</span>
                  </div>
                )}

                {/* Duplicate cluster tag if applicable */}
                {inc.duplicate_group_id && (
                  <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex items-center justify-between">
                    <span>Grouped into Duplicate Cluster:</span>
                    <strong className="font-mono">#{inc.duplicate_group_id}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 bg-[#F5F8FC] border-t border-[#DCE6EF] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#526984] font-medium">State:</span>
                <select
                  value={inc.review_state}
                  onChange={(e) =>
                    onUpdateIncidentState(
                      inc.incident_id,
                      e.target.value as IncidentRecord['review_state']
                    )
                  }
                  className="text-[11.5px] font-semibold text-[#10243B] bg-white border border-[#CADDF0] rounded px-2 py-0.5 focus:outline-none"
                >
                  <option value="New">New</option>
                  <option value="Needs Review">Needs Review</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Duplicate">Duplicate</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => onSelectZone(inc.zone_id)}
                className="text-[11.5px] font-bold text-[#1769C2] hover:underline flex items-center gap-1"
              >
                <span>View on Map</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-2xl w-full bg-white rounded-xl overflow-hidden shadow-2xl p-2">
            <img src={selectedPhoto} alt="Full evidence view" className="w-full h-auto rounded-lg" />
            <div className="p-3 flex items-center justify-between">
              <span className="text-[12px] text-[#526984]">
                Citizen photo submission with uncalibrated visual severity classification
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="px-3 py-1 bg-[#10243B] text-white text-[12px] rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
