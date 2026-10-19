import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDisplayRainfallBars, formatCacheAge } from './weatherUtils.ts';
import type { WeatherSnapshot, RainfallObservation } from '../data/dashboardData.ts';

const MOCK_SNAPSHOT: WeatherSnapshot = {
  zone_id: 'NZ-SAN-01',
  provider: 'Open-Meteo',
  provider_model: 'ECMWF/GFS NWP Blend',
  latitude: 19.045,
  longitude: 73.015,
  retrieved_at: '2026-10-18T18:05:00Z',
  provider_timestamp: '2026-10-18T18:00',
  current_precipitation_mm: 4.2,
  current_rain_mm: 4.2,
  current_weather_code: 61,
  weather_description: 'Slight rain',
  units: { precipitation: 'mm', time: 'iso8601' },
  data_status: 'Weather Model',
  provenance_text: 'Open-Meteo NWP',
  is_simulated: false,
  is_cached: false,
  cache_age_seconds: 0,
  is_stale: false,
  spatial_coverage_notes: 'Regional 0.1 deg grid',
  past_records: [
    { time: '16:00', timestamp_iso: '2026-10-18T16:00', precipitation_mm: 2.0, rain_mm: 2.0, is_forecast: false },
    { time: '17:00', timestamp_iso: '2026-10-18T17:00', precipitation_mm: 5.5, rain_mm: 5.5, is_forecast: false },
    { time: '18:00', timestamp_iso: '2026-10-18T18:00', precipitation_mm: 4.2, rain_mm: 4.2, is_forecast: false },
  ],
  forecast_records: [
    { time: '19:00', timestamp_iso: '2026-10-18T19:00', precipitation_mm: 3.0, rain_mm: 3.0, is_forecast: true },
    { time: '20:00', timestamp_iso: '2026-10-18T20:00', precipitation_mm: 1.0, rain_mm: 1.0, is_forecast: true },
  ],
  total_past_rainfall_mm: 11.7,
  peak_precipitation_mm: 5.5,
  current_intensity_mm_hr: 4.2,
};

const MOCK_DEMO_RAINFALL: RainfallObservation[] = [
  { time: '09:00', rainfall_mm: 3.2, risk_index: 22, source: 'AWS-Nerul', data_status: 'Simulated' },
  { time: '10:00', rainfall_mm: 6.8, risk_index: 34, source: 'AWS-Nerul', data_status: 'Simulated' },
];

test('weatherUtils - buildDisplayRainfallBars', async (t) => {
  await t.test('formats live weather model snapshot into past and forecast bars', () => {
    const res = buildDisplayRainfallBars(MOCK_SNAPSHOT, MOCK_DEMO_RAINFALL, false);
    assert.equal(res.isModelFeed, true);
    assert.equal(res.currentIntensity, 4.2);
    assert.equal(res.totalPastVolume, 11.7);
    assert.equal(res.weatherDescription, 'Slight rain');
    assert.equal(res.bars.length, 5);

    // Verify first 3 are past, next 2 are forecast
    assert.equal(res.bars[0].is_forecast, false);
    assert.equal(res.bars[1].is_forecast, false);
    assert.equal(res.bars[2].is_forecast, false);
    assert.equal(res.bars[3].is_forecast, true);
    assert.equal(res.bars[4].is_forecast, true);
  });

  await t.test('falls back to demo simulated feed when isDemoMode is true', () => {
    const res = buildDisplayRainfallBars(MOCK_SNAPSHOT, MOCK_DEMO_RAINFALL, true);
    assert.equal(res.isModelFeed, false);
    assert.equal(res.bars.length, 2);
    assert.equal(res.bars[0].is_forecast, false);
  });

  await t.test('handles empty or null weather snapshot cleanly', () => {
    const res = buildDisplayRainfallBars(null, MOCK_DEMO_RAINFALL, false);
    assert.equal(res.isModelFeed, false);
    assert.equal(res.bars.length, 2);
  });
});

test('weatherUtils - formatCacheAge', async (t) => {
  await t.test('formats recent seconds', () => {
    assert.equal(formatCacheAge(25), 'Just now');
  });

  await t.test('formats minutes', () => {
    assert.equal(formatCacheAge(180), '3m ago');
    assert.equal(formatCacheAge(3500), '58m ago');
  });

  await t.test('formats hours', () => {
    assert.equal(formatCacheAge(7200), '2h ago');
  });
});
