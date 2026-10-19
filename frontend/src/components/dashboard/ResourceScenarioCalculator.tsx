import React, { useState } from 'react';
import {
  Calculator,
  Users,
  IndianRupee,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Info,
  Sliders,
} from 'lucide-react';
import type {
  PilotZone,
  PriorityEvaluation,
  ResourceScenarioRequest,
  ResourceScenarioResponse,
} from '../../data/dashboardData';

interface ResourceScenarioCalculatorProps {
  zones: PilotZone[];
  evaluations: PriorityEvaluation[];
  scenarioResults: ResourceScenarioResponse | null;
  isLoading: boolean;
  onRunScenario: (request: ResourceScenarioRequest) => Promise<ResourceScenarioResponse>;
  onSelectZone?: (zoneId: string) => void;
}

export const ResourceScenarioCalculator: React.FC<ResourceScenarioCalculatorProps> = ({
  zones,
  evaluations,
  scenarioResults,
  isLoading,
  onRunScenario,
  onSelectZone,
}) => {
  const [budget, setBudget] = useState<number>(50000);
  const [crews, setCrews] = useState<number>(2);
  const [staffHours, setStaffHours] = useState<number>(80);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(() =>
    zones.map((z) => z.zone_id)
  );
  const [activeResultTab, setActiveResultTab] = useState<'selected' | 'unselected'>('selected');
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const toggleCandidate = (zoneId: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const selectAllCandidates = () => {
    setSelectedCandidateIds(zones.map((z) => z.zone_id));
  };

  const clearAllCandidates = () => {
    setSelectedCandidateIds([]);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setScenarioError(null);

    if (budget < 0) {
      setScenarioError('Budget cannot be negative.');
      return;
    }
    if (crews < 0) {
      setScenarioError('Crews cannot be negative.');
      return;
    }
    if (staffHours < 0) {
      setScenarioError('Staff-hours cannot be negative.');
      return;
    }

    try {
      await onRunScenario({
        available_budget: Number(budget),
        available_crews: Number(crews),
        max_staff_hours: Number(staffHours),
        candidate_zone_ids: selectedCandidateIds.length > 0 ? selectedCandidateIds : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      setScenarioError(msg);
    }
  };

  const handleResetDefaults = () => {
    setBudget(50000);
    setCrews(2);
    setStaffHours(80);
    setSelectedCandidateIds(zones.map((z) => z.zone_id));
    setScenarioError(null);
  };

  const results = scenarioResults?.scenario_results;
  const budgetPct =
    results && scenarioResults.scenario_inputs.available_budget > 0
      ? Math.min(100, Math.round((results.total_estimated_cost / scenarioResults.scenario_inputs.available_budget) * 100))
      : 0;

  const hoursPct =
    results && scenarioResults.scenario_inputs.max_staff_hours > 0
      ? Math.min(100, Math.round((results.total_staff_hours_used / scenarioResults.scenario_inputs.max_staff_hours) * 100))
      : 0;

  return (
    <div className="bg-white rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#DCE6EF] bg-[#F5F8FC]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#1769C2]" />
            <h3 className="font-serif text-[19px] font-normal text-[#10243B] leading-none">
              What-If Resource Allocation Simulator
            </h3>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1769C2] border border-blue-200">
              v3 Greedy Decision Aid
            </span>
          </div>
          <p className="text-[11.5px] text-[#526984] mt-1">
            Simulate municipal field deployment under real-world crew and expenditure limits. Order derived from priority engine.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#526984] hover:text-[#10243B] border border-[#DCE6EF] hover:bg-white rounded-md transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Calculator Body: Form Controls */}
      <form onSubmit={handleSimulate} className="p-5 border-b border-[#DCE6EF] bg-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Maintenance Budget */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[12px] font-bold text-[#10243B]">
              <span className="flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-[#1769C2]" />
                Available Budget (INR)
              </span>
              <span className="text-[11px] font-mono text-[#1769C2]">
                ₹{Number(budget).toLocaleString('en-IN')}
              </span>
            </label>
            <input
              type="number"
              min="0"
              step="5000"
              value={budget}
              onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-1.5 text-[12.5px] font-mono bg-[#F5F8FC] border border-[#CADDF0] rounded-lg text-[#10243B] focus:outline-none focus:border-[#1769C2]"
              placeholder="e.g. 50000"
            />
            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {[30000, 50000, 75000, 100000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBudget(preset)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                    budget === preset
                      ? 'bg-[#1769C2] text-white border-[#1769C2]'
                      : 'bg-[#F5F8FC] text-[#526984] border-[#DCE6EF] hover:bg-slate-200'
                  }`}
                >
                  ₹{(preset / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>

          {/* 2. Available Crews */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[12px] font-bold text-[#10243B]">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#1769C2]" />
                Inspection & Work Crews
              </span>
              <span className="text-[11px] font-mono text-[#1769C2]">
                {crews} {crews === 1 ? 'Crew' : 'Crews'}
              </span>
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={crews}
              onChange={(e) => {
                const c = Math.max(0, Number(e.target.value));
                setCrews(c);
                if (staffHours === 0 || staffHours === crews * 40) {
                  setStaffHours(c * 40);
                }
              }}
              className="w-full px-3 py-1.5 text-[12.5px] font-mono bg-[#F5F8FC] border border-[#CADDF0] rounded-lg text-[#10243B] focus:outline-none focus:border-[#1769C2]"
              placeholder="e.g. 2"
            />
            <span className="text-[10.5px] text-[#526984] block">
              Standard shift: 40 staff-hours allocated per crew.
            </span>
          </div>

          {/* 3. Max Staff-Hours */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[12px] font-bold text-[#10243B]">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#1769C2]" />
                Max Staff-Hours
              </span>
              <span className="text-[11px] font-mono text-[#1769C2]">{staffHours} hrs</span>
            </label>
            <input
              type="number"
              min="0"
              step="8"
              value={staffHours}
              onChange={(e) => setStaffHours(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-1.5 text-[12.5px] font-mono bg-[#F5F8FC] border border-[#CADDF0] rounded-lg text-[#10243B] focus:outline-none focus:border-[#1769C2]"
              placeholder="e.g. 80"
            />
            <span className="text-[10.5px] text-[#526984] block">
              Cumulative time cap for simultaneous field teams.
            </span>
          </div>
        </div>

        {/* Candidate Zones Multi-Select Filter */}
        <div className="mt-4 pt-3 border-t border-[#DCE6EF]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11.5px] font-bold text-[#10243B]">
              Candidate Pilot Zones for Allocation ({selectedCandidateIds.length}/{zones.length} active)
            </span>
            <div className="flex items-center gap-2 text-[10.5px]">
              <button
                type="button"
                onClick={selectAllCandidates}
                className="text-[#1769C2] hover:underline font-semibold"
              >
                Select All
              </button>
              <span className="text-[#CADDF0]">|</span>
              <button
                type="button"
                onClick={clearAllCandidates}
                className="text-[#526984] hover:underline font-semibold"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => {
              const isChecked = selectedCandidateIds.includes(zone.zone_id);
              const matchingEval = evaluations.find((e) => e.zone_id === zone.zone_id);
              return (
                <button
                  key={zone.zone_id}
                  type="button"
                  onClick={() => toggleCandidate(zone.zone_id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    isChecked
                      ? 'bg-blue-50 text-[#1769C2] border-[#1769C2] shadow-2xs'
                      : 'bg-[#F5F8FC] text-[#526984] border-[#DCE6EF] opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by parent button click
                    className="w-3 h-3 text-[#1769C2] rounded pointer-events-none"
                  />
                  <span>{zone.zone_id}</span>
                  <span className="text-[10px] text-[#526984]">({zone.ward.split(' ')[0]})</span>
                  {matchingEval && (
                    <span
                      className={`text-[9.5px] px-1 py-0.2 rounded font-bold ${
                        matchingEval.priority_band === 'Urgent'
                          ? 'bg-red-100 text-red-900'
                          : matchingEval.priority_band === 'High'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {matchingEval.priority_score}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {scenarioError && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11.5px] text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{scenarioError}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-4 flex items-center justify-end">
          <button
            type="submit"
            disabled={isLoading || selectedCandidateIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#1769C2] hover:bg-[#12559E] disabled:opacity-50 text-white text-[12px] font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>{isLoading ? 'Computing Allocation...' : 'Simulate Resource Allocation'}</span>
          </button>
        </div>
      </form>

      {/* Scenario Output Section */}
      {scenarioResults ? (
        <div className="p-5 space-y-5 bg-[#F5F8FC]/30 animate-fadeIn">
          {/* Key Resource Usage Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Cost Metric */}
            <div className="bg-white p-3 rounded-lg border border-[#DCE6EF] shadow-2xs">
              <span className="text-[10.5px] font-bold text-[#526984] uppercase tracking-wider block">
                Estimated Budget Used
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-mono text-[17px] font-bold text-[#10243B]">
                  ₹{results?.total_estimated_cost.toLocaleString('en-IN')}
                </span>
                <span className="text-[10.5px] text-[#526984]">
                  / ₹{scenarioResults.scenario_inputs.available_budget.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="w-full bg-[#E5EDF5] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetPct > 90 ? 'bg-[#D94C55]' : budgetPct > 70 ? 'bg-[#D9952C]' : 'bg-[#1769C2]'
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <span className="text-[10px] text-[#526984] mt-1 block">
                ₹{results?.remaining_budget.toLocaleString('en-IN')} unspent remaining
              </span>
            </div>

            {/* Staff Hours Metric */}
            <div className="bg-white p-3 rounded-lg border border-[#DCE6EF] shadow-2xs">
              <span className="text-[10.5px] font-bold text-[#526984] uppercase tracking-wider block">
                Staff-Hours Allocated
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-mono text-[17px] font-bold text-[#10243B]">
                  {results?.total_staff_hours_used}h
                </span>
                <span className="text-[10.5px] text-[#526984]">
                  / {scenarioResults.scenario_inputs.max_staff_hours}h
                </span>
              </div>
              <div className="w-full bg-[#E5EDF5] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#1769C2] h-full rounded-full transition-all duration-500"
                  style={{ width: `${hoursPct}%` }}
                />
              </div>
              <span className="text-[10px] text-[#526984] mt-1 block">
                {results?.remaining_staff_hours}h buffer remaining
              </span>
            </div>

            {/* Crews Utilized */}
            <div className="bg-white p-3 rounded-lg border border-[#DCE6EF] shadow-2xs">
              <span className="text-[10.5px] font-bold text-[#526984] uppercase tracking-wider block">
                Crews Required
              </span>
              <div className="font-mono text-[17px] font-bold text-[#10243B] mt-1">
                ~{results?.estimated_crews_utilized} Crews
              </div>
              <span className="text-[10.5px] text-[#526984] mt-2 block">
                Based on 40h standard shift capacity.
              </span>
            </div>

            {/* Coverage Ratio */}
            <div className="bg-white p-3 rounded-lg border border-[#DCE6EF] shadow-2xs">
              <span className="text-[10.5px] font-bold text-[#526984] uppercase tracking-wider block">
                Locations Funded
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-mono text-[17px] font-bold text-[#1769C2]">
                  {results?.total_selected_count}
                </span>
                <span className="text-[11px] text-[#526984]">
                  of {scenarioResults.scenario_inputs.candidate_zones_count} candidate zones
                </span>
              </div>
              <span className="text-[10.5px] text-[#D94C55] font-semibold mt-2 block">
                {results?.total_unselected_count} deferred due to caps
              </span>
            </div>
          </div>

          {/* Result Tabs: Allocated vs. Unallocated */}
          <div className="bg-white rounded-lg border border-[#DCE6EF] overflow-hidden">
            <div className="flex border-b border-[#DCE6EF] bg-[#F5F8FC]/50 px-4 pt-3">
              <button
                type="button"
                onClick={() => setActiveResultTab('selected')}
                className={`pb-2.5 px-3 text-[12px] font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeResultTab === 'selected'
                    ? 'border-[#1769C2] text-[#1769C2]'
                    : 'border-transparent text-[#526984] hover:text-[#10243B]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Allocated Interventions ({results?.total_selected_count})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveResultTab('unselected')}
                className={`pb-2.5 px-3 text-[12px] font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeResultTab === 'unselected'
                    ? 'border-[#1769C2] text-[#1769C2]'
                    : 'border-transparent text-[#526984] hover:text-[#10243B]'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Unallocated / Shortfall ({results?.total_unselected_count})</span>
              </button>
            </div>

            {/* Tab 1: Allocated Interventions */}
            {activeResultTab === 'selected' && (
              <div className="p-4">
                {results?.selected_interventions.length === 0 ? (
                  <div className="text-center py-6 text-[12px] text-[#526984]">
                    No locations could be funded under the specified budget or staff-hour limits.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {results?.selected_interventions.map((item) => (
                      <div
                        key={item.zone_id}
                        onClick={() => onSelectZone?.(item.zone_id)}
                        className="p-3 bg-[#F5F8FC]/50 hover:bg-blue-50/50 border border-[#DCE6EF] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#1769C2] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                            #{item.rank}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[13px] text-[#10243B]">
                                {item.zone_name}
                              </span>
                              <span className="text-[10.5px] font-mono text-[#1769C2] font-semibold">
                                {item.zone_id}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  item.priority_band === 'Urgent'
                                    ? 'bg-red-100 text-red-900 border border-red-200'
                                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                                }`}
                              >
                                {item.priority_band} ({item.priority_score})
                              </span>
                            </div>
                            <p className="text-[11.5px] text-[#526984] mt-0.5">
                              {item.rationale}
                            </p>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-end shrink-0 gap-1 text-right">
                          <span className="text-[11.5px] font-bold text-[#10243B] bg-white border border-[#DCE6EF] px-2 py-0.5 rounded">
                            {item.action_type}
                          </span>
                          <span className="font-mono text-[11px] text-[#526984]">
                            ₹{item.estimated_cost.toLocaleString('en-IN')} &middot; {item.staff_hours}h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Unallocated Interventions (Shortfall Rationale) */}
            {activeResultTab === 'unselected' && (
              <div className="p-4">
                {results?.unselected_interventions.length === 0 ? (
                  <div className="text-center py-6 text-[12px] text-emerald-700 font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All candidate locations successfully funded within specified resource limits!</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {results?.unselected_interventions.map((item) => (
                      <div
                        key={item.zone_id}
                        className="p-3 bg-amber-50/40 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-[#526984] text-[11px] font-bold flex items-center justify-center shrink-0">
                            #{item.rank}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[13px] text-[#10243B]">
                                {item.zone_name}
                              </span>
                              <span className="text-[10.5px] font-mono text-[#526984]">
                                {item.zone_id}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-800">
                                Priority Score: {item.priority_score}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-900 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{item.shortfall_reason}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-end shrink-0 gap-1 text-right">
                          <span className="text-[11px] text-[#526984]">Proposed Action:</span>
                          <span className="font-semibold text-[11.5px] text-[#10243B]">
                            {item.action_type}
                          </span>
                          <span className="font-mono text-[10.5px] text-[#526984]">
                            Requires ₹{item.estimated_cost.toLocaleString('en-IN')} &middot; {item.staff_hours}h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Assumptions & Caveats Footer */}
          <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2 text-[11px] text-[#10243B]">
            <div className="flex items-center gap-1.5 font-bold text-[#1769C2]">
              <Info className="w-3.5 h-3.5" />
              <span>Decision Support Caveats & Standard Assumptions</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[#526984]">
              {scenarioResults.engine_assumptions.map((assump, i) => (
                <li key={`a-${i}`}>{assump}</li>
              ))}
              {scenarioResults.caveats.map((cav, i) => (
                <li key={`c-${i}`} className="text-amber-800 font-medium">
                  {cav}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-[#526984] bg-[#F5F8FC]/30">
          <p className="text-[12.5px] font-medium text-[#10243B]">
            Configure hypothetical municipal constraints above and click &quot;Simulate Resource Allocation&quot;.
          </p>
          <p className="text-[11px] text-[#526984] mt-1">
            The decision engine evaluates candidates strictly in prioritisation order using standard rate schedules.
          </p>
        </div>
      )}
    </div>
  );
};
