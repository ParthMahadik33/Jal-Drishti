import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { simulateDemoScenario } from './scenarioUtils.ts';
import { SEED_EVALUATIONS } from '../data/dashboardData.ts';

describe('scenarioUtils - Deterministic Greedy Allocation', () => {
  test('allocates interventions under generous budget and hours', () => {
    const res = simulateDemoScenario(SEED_EVALUATIONS, {
      available_budget: 200000,
      available_crews: 5,
      max_staff_hours: 200,
    });

    assert.equal(res.scenario_results.total_selected_count, 5);
    assert.equal(res.scenario_results.total_unselected_count, 0);
    assert.ok(res.scenario_results.total_estimated_cost > 0);
    assert.ok(res.scenario_results.total_estimated_cost <= 200000);
    assert.equal(res.scenario_results.selected_interventions[0].zone_id, 'NZ-SAN-01');
  });

  test('caps allocation when budget is restricted to top intervention', () => {
    // Top intervention is Engineering Assessment (₹30,000)
    // Next is Clean/Desilt (₹15,000). Total for 2 = ₹45,000.
    const res = simulateDemoScenario(SEED_EVALUATIONS, {
      available_budget: 35000,
      available_crews: 2,
      max_staff_hours: 80,
    });

    assert.equal(res.scenario_results.total_selected_count, 2);
    assert.equal(res.scenario_results.total_unselected_count, 3);
    assert.equal(res.scenario_results.total_estimated_cost, 34000);
    assert.equal(res.scenario_results.remaining_budget, 1000);
    assert.equal(res.scenario_results.selected_interventions[0].zone_id, 'NZ-SAN-01');
    assert.equal(res.scenario_results.unselected_interventions[0].zone_id, 'NZ-NER-02');
    assert.ok(res.scenario_results.unselected_interventions[0].shortfall_reason.includes('budget remains'));
  });

  test('caps allocation when staff-hours limit is exceeded', () => {
    // Top intervention takes 40 staff-hours.
    // If only 35 staff-hours are available, even the first intervention exceeds hours!
    const res = simulateDemoScenario(SEED_EVALUATIONS, {
      available_budget: 100000,
      available_crews: 1,
      max_staff_hours: 35,
    });

    assert.ok(res.scenario_results.unselected_interventions[0].shortfall_reason.includes('staff-hours remain'));
  });

  test('filters candidates to specified subset of zones', () => {
    const candidates = ['NZ-NER-02', 'NZ-NER-03'];
    const res = simulateDemoScenario(SEED_EVALUATIONS, {
      available_budget: 100000,
      available_crews: 2,
      max_staff_hours: 80,
      candidate_zone_ids: candidates,
    });

    assert.equal(res.scenario_inputs.candidate_zones_count, 2);
    assert.equal(res.scenario_results.total_selected_count, 2);
    const allocatedZoneIds = res.scenario_results.selected_interventions.map((i) => i.zone_id);
    assert.deepEqual(allocatedZoneIds, ['NZ-NER-02', 'NZ-NER-03']);
  });

  test('supports user action overrides', () => {
    const res = simulateDemoScenario(SEED_EVALUATIONS, {
      available_budget: 50000,
      available_crews: 2,
      max_staff_hours: 80,
      candidate_zone_ids: ['NZ-SAN-01'],
      action_overrides: {
        'NZ-SAN-01': {
          action_type: 'Pump Deployment',
          estimated_cost: 22000,
          staff_hours: 30,
        },
      },
    });

    assert.equal(res.scenario_results.selected_interventions[0].action_type, 'Pump Deployment');
    assert.equal(res.scenario_results.selected_interventions[0].estimated_cost, 22000);
    assert.equal(res.scenario_results.selected_interventions[0].staff_hours, 30);
  });

  test('rejects negative budget or constraint inputs', () => {
    assert.throws(() => {
      simulateDemoScenario(SEED_EVALUATIONS, {
        available_budget: -1000,
        available_crews: 1,
        max_staff_hours: 40,
      });
    }, /cannot be negative/);
  });

  test('includes transparent engine assumptions and disclaimer caveats', () => {
    const res = simulateDemoScenario(SEED_EVALUATIONS, {
      available_budget: 50000,
      available_crews: 2,
      max_staff_hours: 80,
    });

    assert.ok(res.engine_assumptions.length >= 3);
    assert.ok(res.caveats.length >= 3);
    assert.equal(res.engine_version, 'v3.0.0-rule-deterministic');
  });
});
