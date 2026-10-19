import React, { useState } from 'react';
import { ActionQueueTable } from '../ActionQueueTable';
import { ResourceScenarioCalculator } from '../ResourceScenarioCalculator';
import type {
  QueueItem,
  PilotZone,
  PriorityEvaluation,
  ResourceScenarioRequest,
  ResourceScenarioResponse,
} from '../../../data/dashboardData';
import { Download, ListOrdered, Sliders, Layers } from 'lucide-react';

interface ActionQueueViewProps {
  queue: QueueItem[];
  zones: PilotZone[];
  evaluations: PriorityEvaluation[];
  scenarioResults: ResourceScenarioResponse | null;
  isScenarioLoading: boolean;
  onRunScenario: (request: ResourceScenarioRequest) => Promise<ResourceScenarioResponse>;
  selectedZoneId: string;
  onSelectQueueItem: (hotspotId: string) => void;
  onSelectZone?: (zoneId: string) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ActionQueueView: React.FC<ActionQueueViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'both' | 'queue' | 'calculator'>('both');

  const handleExportCSV = () => {
    const headers = [
      'Rank',
      'Location',
      'Zone ID',
      'Priority Score',
      'Priority Band',
      'Risk Band',
      'Action',
      'Action Rationale',
      'Status',
    ];
    const rows = props.queue.map((q) => [
      q.rank,
      `"${q.location_name}"`,
      q.zone_id,
      q.priority_score ?? '',
      q.priority_band ?? '',
      q.risk_band,
      `"${q.suggested_action}"`,
      `"${q.action_rationale ?? ''}"`,
      q.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `JalDrishti_Action_Queue_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 select-none">
      {/* Top Controls with CSV Export & Subtabs */}
      <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-[#1769C2]" />
            <h2 className="font-serif text-[22px] font-normal text-[#10243B] leading-none">
              Operational Priority & Resource Allocation
            </h2>
          </div>
          <p className="text-[12px] text-[#526984] mt-1">
            Explainable ranking engine and hypothetical what-if municipal budgeting for flood hotspots.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Subtab Toggle Buttons */}
          <div className="flex items-center p-0.5 bg-[#F5F8FC] border border-[#CADDF0] rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('both')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-bold transition-colors ${
                activeTab === 'both'
                  ? 'bg-white text-[#10243B] shadow-2xs border border-[#DCE6EF]'
                  : 'text-[#526984] hover:text-[#10243B]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full View</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-bold transition-colors ${
                activeTab === 'queue'
                  ? 'bg-white text-[#10243B] shadow-2xs border border-[#DCE6EF]'
                  : 'text-[#526984] hover:text-[#10243B]'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Queue ({props.queue.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-bold transition-colors ${
                activeTab === 'calculator'
                  ? 'bg-white text-[#10243B] shadow-2xs border border-[#DCE6EF]'
                  : 'text-[#526984] hover:text-[#10243B]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>What-If Simulator</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F5F8FC] hover:bg-slate-200 text-[#10243B] rounded-lg text-[12px] font-semibold border border-[#CADDF0] transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Content Area based on Subtab */}
      {(activeTab === 'both' || activeTab === 'queue') && (
        <section aria-label="Priority Queue Table Section">
          <ActionQueueTable
            queue={props.queue}
            selectedZoneId={props.selectedZoneId}
            onSelectQueueItem={props.onSelectQueueItem}
            filterStatus={props.filterStatus}
            onFilterChange={props.onFilterChange}
            searchQuery={props.searchQuery}
            onSearchChange={props.onSearchChange}
          />
        </section>
      )}

      {(activeTab === 'both' || activeTab === 'calculator') && (
        <section aria-label="What-If Resource Allocation Section">
          <ResourceScenarioCalculator
            zones={props.zones}
            evaluations={props.evaluations}
            scenarioResults={props.scenarioResults}
            isLoading={props.isScenarioLoading}
            onRunScenario={props.onRunScenario}
            onSelectZone={props.onSelectZone}
          />
        </section>
      )}
    </div>
  );
};
