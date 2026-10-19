import React from 'react';
import { Search, ArrowRight, ShieldAlert } from 'lucide-react';
import type { QueueItem } from '../../data/dashboardData';

interface ActionQueueTableProps {
  queue: QueueItem[];
  selectedZoneId: string;
  onSelectQueueItem: (hotspotId: string) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const STATUS_FILTERS = ['All', 'New', 'Needs Review', 'In Progress', 'Escalated', 'Closed'];

export const ActionQueueTable: React.FC<ActionQueueTableProps> = ({
  queue,
  selectedZoneId,
  onSelectQueueItem,
  filterStatus,
  onFilterChange,
  searchQuery,
  onSearchChange,
}) => {
  // Filter and search logic
  const filteredQueue = queue.filter((item) => {
    const matchesFilter = filterStatus === 'All' || item.status === filterStatus;
    const matchesSearch =
      item.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.issue_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.suggested_action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getRiskPill = (band: QueueItem['risk_band']) => {
    switch (band) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-red-50 text-[#D94C55] border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D94C55]" />
            High Risk
          </span>
        );
      case 'moderate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-[#D9952C] border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9952C]" />
            Moderate
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-[#2879D8] border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2879D8]" />
            Low Risk
          </span>
        );
    }
  };

  const getPriorityPill = (band?: QueueItem['priority_band'], score?: number) => {
    if (score === undefined && !band) {
      return <span className="text-[11px] text-[#526984]">—</span>;
    }
    const displayScore = score !== undefined ? `${score}/100` : '';
    switch (band) {
      case 'Urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-red-100 text-red-900 border border-red-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D94C55]" />
            Urgent {displayScore && `(${displayScore})`}
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9952C]" />
            High {displayScore && `(${displayScore})`}
          </span>
        );
      case 'Moderate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2879D8]" />
            Moderate {displayScore && `(${displayScore})`}
          </span>
        );
      case 'Monitor':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Monitor {displayScore && `(${displayScore})`}
          </span>
        );
    }
  };

  const getStatusBadge = (status: QueueItem['status']) => {
    switch (status) {
      case 'New':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Needs Review':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'In Progress':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'Escalated':
        return 'bg-red-100 text-red-900 border-red-300';
      case 'Closed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col overflow-hidden select-none"
      aria-label="Priority Action Queue Table"
    >
      {/* Table Header: Title, Search, & Status Filters */}
      <div className="p-4 border-b border-[#DCE6EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F5F8FC]/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-[19px] font-normal text-[#10243B] leading-none">
              Priority Action Queue
            </h3>
            <span className="text-[11px] font-semibold text-[#526984] bg-white border border-[#DCE6EF] px-2 py-0.5 rounded-full">
              {filteredQueue.length} Hotspots Ranked
            </span>
          </div>
          <p className="text-[11.5px] text-[#526984] mt-0.5">
            Operational triage ordering derived from hazard severity, recurrence, and recency under regional weather context.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#526984] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search hotspots..."
              className="pl-8 pr-3 py-1 text-[12px] bg-white border border-[#DCE6EF] rounded-lg focus:outline-none focus:border-[#1769C2] text-[#10243B] w-40 sm:w-48 placeholder:text-[#526984]/60"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F5F8FC] p-0.5 border border-[#DCE6EF] rounded-lg">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onFilterChange(s)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                  filterStatus === s
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

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F5F8FC] border-b border-[#DCE6EF] text-[11px] font-bold text-[#526984] uppercase tracking-wider">
              <th className="py-2.5 px-3 w-12 text-center">Rank</th>
              <th className="py-2.5 px-3">Location / Pilot Zone</th>
              <th className="py-2.5 px-3">Operational Priority (v5)</th>
              <th className="py-2.5 px-3">Environmental Risk</th>
              <th className="py-2.5 px-3">Corroboration</th>
              <th className="py-2.5 px-3">Latest Report</th>
              <th className="py-2.5 px-3">Suggested Next Action</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE6EF] text-[12.5px]">
            {filteredQueue.map((item) => {
              const isSelected = selectedZoneId === item.zone_id;

              return (
                <tr
                  key={item.hotspot_id}
                  onClick={() => onSelectQueueItem(item.hotspot_id)}
                  className={`group cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/60 hover:bg-blue-50'
                      : 'hover:bg-[#F5F8FC]/80'
                  }`}
                >
                  {/* Rank */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[11.5px] ${
                        item.rank === 1
                          ? 'bg-[#D94C55] text-white shadow-xs'
                          : item.rank === 2
                          ? 'bg-[#D9952C] text-white'
                          : 'bg-[#F5F8FC] text-[#526984] border border-[#DCE6EF]'
                      }`}
                    >
                      {item.rank}
                    </span>
                  </td>

                  {/* Location & Zone */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-[#10243B] flex items-center gap-1.5">
                      <span>{item.location_name}</span>
                      {item.has_recurrence && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-red-100 text-red-900 border border-red-300"
                          title="Recurring after recorded maintenance"
                        >
                          <ShieldAlert className="w-2.5 h-2.5" />
                          RECURRING
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#526984] flex items-center gap-1.5">
                      <span>{item.zone_id}</span>
                      {item.ranking_reasons && item.ranking_reasons[0] && (
                        <>
                          <span>&middot;</span>
                          <span className="truncate max-w-[200px]" title={item.ranking_reasons[0]}>
                            {item.ranking_reasons[0]}
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Operational Priority */}
                  <td className="py-3 px-3">
                    {getPriorityPill(item.priority_band, item.priority_score)}
                  </td>

                  {/* Environmental Risk Band */}
                  <td className="py-3 px-3">{getRiskPill(item.risk_band)}</td>

                  {/* Corroboration */}
                  <td className="py-3 px-3">
                    <div className="text-[12px] font-semibold text-[#10243B]">
                      {item.report_count} reports
                    </div>
                    <div className="text-[10.5px] text-[#526984] truncate max-w-[140px]">
                      {item.corroboration_summary}
                    </div>
                  </td>

                  {/* Latest Report */}
                  <td className="py-3 px-3 text-[#526984] text-[12px] whitespace-nowrap">
                    {item.latest_report_time}
                  </td>

                  {/* Suggested Next Action */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-[#1769C2]">
                      {item.suggested_action}
                    </div>
                    {item.action_rationale && (
                      <div className="text-[10.5px] text-[#526984] truncate max-w-[180px]" title={item.action_rationale}>
                        {item.action_rationale}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold border ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>

                  {/* Action Link */}
                  <td className="py-3 px-3 text-right">
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#1769C2] group-hover:translate-x-0.5 transition-transform">
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
