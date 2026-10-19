import React, { useState } from 'react';
import { Search, ShieldAlert, ArrowRight } from 'lucide-react';
import type { QueueItem, PilotZone, PriorityEvaluation } from '../../data/dashboardData';

interface OverviewPriorityQueueProps {
  queue: QueueItem[];
  zones: PilotZone[];
  evaluations?: PriorityEvaluation[];
  selectedZoneId: string;
  onSelectQueueItem: (hotspotId: string) => void;
  onSelectZone: (zoneId: string) => void;
}

export const OverviewPriorityQueue: React.FC<OverviewPriorityQueueProps> = ({
  queue,
  zones,
  evaluations = [],
  selectedZoneId,
  onSelectQueueItem,
  onSelectZone,
}) => {
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter queue by priority band and search text
  const filteredQueue = queue.filter((item) => {
    const matchesPriority =
      filterPriority === 'All' ||
      item.priority_band === filterPriority ||
      (filterPriority === 'High' && item.risk_band === 'high');

    const matchesSearch =
      searchQuery === '' ||
      item.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.zone_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.issue_type.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesPriority && matchesSearch;
  });

  const getPriorityPill = (band?: QueueItem['priority_band'], score?: number) => {
    switch (band) {
      case 'Urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-red-50 text-red-900 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D94C55]" />
            Urgent {score !== undefined ? `(${score})` : ''}
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9952C]" />
            High {score !== undefined ? `(${score})` : ''}
          </span>
        );
      case 'Moderate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2879D8]" />
            Moderate {score !== undefined ? `(${score})` : ''}
          </span>
        );
      case 'Monitor':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Monitor
          </span>
        );
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col h-[520px] overflow-hidden select-none"
      aria-label="Operational Priority Queue"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-[#DCE6EF] bg-[#F5F8FC]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-[#10243B] leading-none">
              Priority Action Queue
            </h3>
            <span className="text-[11px] font-semibold text-[#1769C2] bg-blue-50 border border-blue-200 px-2 py-0.2 rounded-full">
              {filteredQueue.length} Zones Ranked
            </span>
          </div>
          <p className="text-[11px] text-[#526984] mt-0.5">
            Operational ordering from Decision Engine v5.0 (Susceptibility + Weather + Recency)
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#526984] absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="pl-7 pr-2.5 py-1 text-[11.5px] bg-white border border-[#DCE6EF] rounded-md focus:outline-none focus:border-[#1769C2] text-[#10243B] w-28 sm:w-36 placeholder:text-[#526984]/60"
            />
          </div>

          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-[#DCE6EF]">
            {['All', 'Urgent', 'High', 'Moderate'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPriority(p)}
                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  filterPriority === p
                    ? 'bg-[#1769C2] text-white shadow-2xs'
                    : 'text-[#526984] hover:text-[#10243B]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Queue Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#DCE6EF]">
        {filteredQueue.length === 0 ? (
          <div className="p-8 text-center text-[#526984] text-[12px]">
            No zones match the current search or filter.
          </div>
        ) : (
          filteredQueue.map((item) => {
            const isSelected = selectedZoneId === item.zone_id;
            const zone = zones.find((z) => z.zone_id === item.zone_id);
            const evaluation = evaluations.find((e) => e.zone_id === item.zone_id);

            return (
              <div
                key={item.hotspot_id}
                onClick={() => {
                  onSelectQueueItem(item.hotspot_id);
                  onSelectZone(item.zone_id);
                }}
                className={`p-3.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/70 border-l-4 border-l-[#1769C2]'
                    : 'hover:bg-[#F5F8FC] border-l-4 border-l-transparent'
                }`}
              >
                {/* Left: Rank & Zone Identification */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Rank Badge */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                      item.rank === 1
                        ? 'bg-[#D94C55] text-white'
                        : item.rank === 2
                        ? 'bg-[#D9952C] text-white'
                        : 'bg-[#F5F8FC] text-[#526984] border border-[#DCE6EF]'
                    }`}
                  >
                    {item.rank}
                  </div>

                  {/* Zone Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[13px] text-[#10243B] truncate">
                        {item.location_name}
                      </span>
                      <span className="font-mono text-[10px] text-[#526984] bg-slate-100 px-1 py-0.2 rounded">
                        {item.zone_id}
                      </span>
                      {item.has_recurrence && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-red-100 text-red-900 border border-red-200">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          RECURRING
                        </span>
                      )}
                    </div>

                    {/* Primary Reason */}
                    <p className="text-[11px] text-[#526984] mt-0.5 truncate leading-tight" title={item.ranking_reasons?.[0] || item.action_rationale}>
                      {item.ranking_reasons?.[0] || item.action_rationale || 'Baseline monitoring'}
                    </p>

                    {/* Susceptibility & Reports Breakdown */}
                    <div className="flex items-center gap-2 text-[10.5px] text-[#526984] mt-1 flex-wrap">
                      <span>Susceptibility: <strong className="text-[#10243B] font-medium">{zone?.risk_score ?? 50}/100</strong></span>
                      <span>&middot;</span>
                      <span>Weather Urgency: <strong className="text-[#10243B] font-medium">{evaluation?.regional_weather?.urgency_score ?? 0}/100</strong></span>
                      <span>&middot;</span>
                      <span>{item.report_count} report(s)</span>
                      <span>&middot;</span>
                      <span>{item.latest_report_time}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Operational Priority Pill & Inspect Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    {getPriorityPill(item.priority_band, item.priority_score)}
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      isSelected ? 'text-[#1769C2] translate-x-0.5' : 'text-slate-400'
                    }`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
