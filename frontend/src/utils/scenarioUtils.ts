import type {
  PriorityEvaluation,
  ResourceScenarioRequest,
  ResourceScenarioResponse,
} from '../data/dashboardData';

export const DEFAULT_ACTION_SPECS: Record<string, { estimated_cost: number; staff_hours: number; description: string }> = {
  'Clean / Desilt': {
    estimated_cost: 15000,
    staff_hours: 24,
    description: 'Desilt intake sumps and grates using jetting & mechanical scoop.',
  },
  'Culvert Clearing': {
    estimated_cost: 12000,
    staff_hours: 20,
    description: 'Clear sediment and structural obstruction from box/pipe culverts.',
  },
  'Inspect': {
    estimated_cost: 4000,
    staff_hours: 8,
    description: 'On-site visual and photographic inspection by junior engineer.',
  },
  'Pump Deployment': {
    estimated_cost: 25000,
    staff_hours: 36,
    description: 'Mobilize high-capacity dewatering diesel pump with suction hose.',
  },
  'Engineering Assessment': {
    estimated_cost: 30000,
    staff_hours: 40,
    description: 'Comprehensive topographical & invert level survey for recurring bottlenecks.',
  },
  'Escalate for Engineering Assessment': {
    estimated_cost: 30000,
    staff_hours: 40,
    description: 'Comprehensive topographical & invert level survey for recurring bottlenecks.',
  },
  'Monitor': {
    estimated_cost: 2000,
    staff_hours: 4,
    description: 'Routine surveillance during high-tide or convective rain spell.',
  },
};

export function simulateDemoScenario(
  evaluations: PriorityEvaluation[],
  req: ResourceScenarioRequest
): ResourceScenarioResponse {
  if (req.available_budget < 0) {
    throw new Error('available_budget cannot be negative');
  }
  if (req.available_crews < 0) {
    throw new Error('available_crews cannot be negative');
  }
  if (req.max_staff_hours < 0) {
    throw new Error('max_staff_hours cannot be negative');
  }

  const candidates =
    req.candidate_zone_ids && req.candidate_zone_ids.length > 0
      ? evaluations.filter((e) => req.candidate_zone_ids!.includes(e.zone_id))
      : evaluations;

  let effectiveHours = req.max_staff_hours;
  if (effectiveHours === 0 && req.available_crews > 0) {
    effectiveHours = req.available_crews * 40;
  }

  const selected: ResourceScenarioResponse['scenario_results']['selected_interventions'] = [];
  const unselected: ResourceScenarioResponse['scenario_results']['unselected_interventions'] = [];
  let totalCost = 0;
  let totalHours = 0;

  candidates.forEach((zoneEval, idx) => {
    const rank = idx + 1;
    const actionType = req.action_overrides?.[zoneEval.zone_id]?.action_type || zoneEval.suggested_action;
    const spec = DEFAULT_ACTION_SPECS[actionType] || { estimated_cost: 10000, staff_hours: 16, description: 'Standard intervention' };
    const cost = req.action_overrides?.[zoneEval.zone_id]?.estimated_cost ?? spec.estimated_cost;
    const hours = req.action_overrides?.[zoneEval.zone_id]?.staff_hours ?? spec.staff_hours;

    const budgetFits = totalCost + cost <= req.available_budget;
    const hoursFit = totalHours + hours <= effectiveHours;

    if (budgetFits && hoursFit) {
      totalCost += cost;
      totalHours += hours;
      selected.push({
        rank,
        zone_id: zoneEval.zone_id,
        zone_name: zoneEval.zone_name,
        ward: zoneEval.ward,
        priority_score: zoneEval.priority_score,
        priority_band: zoneEval.priority_band,
        action_type: actionType,
        estimated_cost: cost,
        staff_hours: hours,
        rationale: zoneEval.action_rationale,
        selection_reason: `Allocated based on rank #${rank} (${zoneEval.priority_band} Priority).`,
      });
    } else {
      const reasons: string[] = [];
      if (!budgetFits) {
        reasons.push(
          `Requires ₹${cost.toLocaleString('en-IN')}, but only ₹${Math.max(
            0,
            req.available_budget - totalCost
          ).toLocaleString('en-IN')} budget remains.`
        );
      }
      if (!hoursFit) {
        reasons.push(
          `Requires ${hours}h, but only ${Math.max(0, effectiveHours - totalHours)} staff-hours remain.`
        );
      }
      unselected.push({
        rank,
        zone_id: zoneEval.zone_id,
        zone_name: zoneEval.zone_name,
        priority_score: zoneEval.priority_score,
        priority_band: zoneEval.priority_band,
        action_type: actionType,
        estimated_cost: cost,
        staff_hours: hours,
        shortfall_reason: reasons.join(' '),
      });
    }
  });

  return {
    scenario_inputs: {
      available_budget: req.available_budget,
      available_crews: req.available_crews,
      max_staff_hours: effectiveHours,
      candidate_zones_count: candidates.length,
    },
    scenario_results: {
      selected_interventions: selected,
      unselected_interventions: unselected,
      total_selected_count: selected.length,
      total_unselected_count: unselected.length,
      total_estimated_cost: totalCost,
      remaining_budget: Math.max(0, req.available_budget - totalCost),
      total_staff_hours_used: totalHours,
      remaining_staff_hours: Math.max(0, effectiveHours - totalHours),
      estimated_crews_utilized: effectiveHours > 0 ? Number((totalHours / 40).toFixed(1)) : 0,
    },
    engine_assumptions: [
      'Deterministic greedy allocation prioritizing by calculated priority score and tie-breaking order.',
      'Estimated standard costs: Engineering Assessment (₹30,000), Clean/Desilt (₹15,000), Culvert Clearing (₹12,000), Inspect (₹4,000), Monitor (₹2,000).',
      'One inspection/maintenance crew estimated at 40 effective staff-hours per operational shift.',
    ],
    caveats: [
      'Prototype decision aid only — does not substitute engineering hydraulic survey or on-site gate check.',
      'Assumes uniform travel velocity and simultaneous crew mobilization across wards.',
      'Does not predict flood volume abatement or citizen casualty reductions.',
    ],
    simulated_at: new Date().toISOString(),
    engine_version: 'v3.0.0-rule-deterministic',
  };
}
