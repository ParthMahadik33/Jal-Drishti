import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCoordinate,
  toLngLat,
  calculatePilotBounds,
  buildCartoStyleUrl,
  prepareIncidentMarkers,
  prepareZoneMarkers,
} from './geoUtils.ts';
import type { IncidentRecord, PilotZone } from '../data/dashboardData.ts';

describe('geoUtils - Coordinate Validation', () => {
  test('accepts valid coordinates in Navi Mumbai range', () => {
    assert.equal(isValidCoordinate([19.0664, 73.0092]), true);
    assert.equal(isValidCoordinate([19.0418, 73.0185]), true);
  });

  test('rejects Null Island (0, 0)', () => {
    assert.equal(isValidCoordinate([0, 0]), false);
    assert.equal(isValidCoordinate([0.00001, 0.00001]), false);
  });

  test('rejects out-of-range coordinates', () => {
    assert.equal(isValidCoordinate([95.0, 73.0]), false);
    assert.equal(isValidCoordinate([-91.0, 73.0]), false);
    assert.equal(isValidCoordinate([19.0, 185.0]), false);
    assert.equal(isValidCoordinate([19.0, -185.0]), false);
  });

  test('rejects non-numeric and malformed inputs', () => {
    assert.equal(isValidCoordinate(null), false);
    assert.equal(isValidCoordinate(undefined), false);
    assert.equal(isValidCoordinate([]), false);
    assert.equal(isValidCoordinate([19.0]), false);
    assert.equal(isValidCoordinate([19.0, 73.0, 50.0]), false);
    assert.equal(isValidCoordinate(['19.0', '73.0']), false);
    assert.equal(isValidCoordinate([NaN, 73.0]), false);
    assert.equal(isValidCoordinate([19.0, Infinity]), false);
  });
});

describe('geoUtils - toLngLat Conversion', () => {
  test('converts [lat, lng] to [lng, lat] for MapLibre/GeoJSON', () => {
    const coords: [number, number] = [19.0664, 73.0092];
    const lngLat = toLngLat(coords);
    assert.deepEqual(lngLat, [73.0092, 19.0664]);
  });
});

describe('geoUtils - calculatePilotBounds', () => {
  test('computes correct [[minLng, minLat], [maxLng, maxLat]] bounds for multiple points', () => {
    const coords: [number, number][] = [
      [19.0664, 73.0092],
      [19.0418, 73.0185],
      [19.0225, 73.0112],
    ];
    const bounds = calculatePilotBounds(coords);
    assert.ok(bounds);
    assert.equal(bounds[0][0], 73.0092); // minLng
    assert.equal(bounds[0][1], 19.0225); // minLat
    assert.equal(bounds[1][0], 73.0185); // maxLng
    assert.equal(bounds[1][1], 19.0664); // maxLat
  });

  test('returns null for empty or all-invalid coordinates', () => {
    assert.equal(calculatePilotBounds([]), null);
    assert.equal(calculatePilotBounds([[0, 0], [95, 200]] as any), null);
  });
});

describe('geoUtils - buildCartoStyleUrl', () => {
  test('returns empty url and hasKey false when key is omitted or empty', () => {
    const resEmpty = buildCartoStyleUrl('');
    assert.equal(resEmpty.hasKey, false);
    assert.equal(resEmpty.url, '');

    const resUndefined = buildCartoStyleUrl(undefined);
    assert.equal(resUndefined.hasKey, false);
    assert.equal(resUndefined.url, '');
  });

  test('properly encodes key in CARTO Positron URL when provided', () => {
    const res = buildCartoStyleUrl('test_carto_key_123');
    assert.equal(res.hasKey, true);
    assert.equal(
      res.url,
      'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json?key=test_carto_key_123'
    );
    assert.ok(res.attribution.includes('CARTO'));
  });
});

describe('geoUtils - prepareIncidentMarkers', () => {
  const sampleIncidents: IncidentRecord[] = [
    {
      incident_id: 'INC-01',
      zone_id: 'NZ-SAN-01',
      location_name: 'Sanpada Underpass',
      coordinates: [19.0664, 73.0092],
      timestamp: '2026-10-15T14:12:00Z',
      relative_time: '18m ago',
      category: 'Inundation',
      visual_severity: 'high',
      ai_confidence: 0.9,
      ai_uncertainty_notes: '',
      review_state: 'Needs Review',
      source: 'WhatsApp',
      data_status: 'AI estimate',
      report_count: 3,
      image_url: '',
      image_caption: '',
      reporter_summary: '',
      notes: '',
      has_recurrence_flag: false,
    },
    {
      incident_id: 'INC-02',
      zone_id: 'NZ-SAN-01',
      location_name: 'Sanpada Sector 3 (Approximate - Missing GPS)',
      coordinates: [19.068, 73.012],
      timestamp: '2026-10-15T09:40:00Z',
      relative_time: '4h ago',
      category: 'Waterlogging',
      visual_severity: 'moderate',
      ai_confidence: 0.5,
      ai_uncertainty_notes: 'Missing GPS',
      review_state: 'Needs Review',
      source: 'WhatsApp',
      data_status: 'Inferred',
      report_count: 1,
      image_url: '',
      image_caption: '',
      reporter_summary: '',
      notes: '',
      has_recurrence_flag: false,
    },
    {
      incident_id: 'INC-03',
      zone_id: 'NZ-NER-02',
      location_name: 'Nerul Market',
      coordinates: [0, 0], // Invalid
      timestamp: '2026-10-15T08:00:00Z',
      relative_time: '6h ago',
      category: 'Drain overflow',
      visual_severity: 'low',
      ai_confidence: 0.8,
      ai_uncertainty_notes: '',
      review_state: 'Closed',
      source: 'Field report',
      data_status: 'Observed',
      report_count: 1,
      image_url: '',
      image_caption: '',
      reporter_summary: '',
      notes: '',
      has_recurrence_flag: false,
    },
  ];

  test('identifies verified GPS vs approximate vs unmapped records', () => {
    const result = prepareIncidentMarkers(sampleIncidents);
    assert.equal(result.mappedMarkers.length, 2);
    assert.equal(result.unmappedCount, 1);
    assert.equal(result.mappedMarkers[0].incident.incident_id, 'INC-01');
    assert.equal(result.mappedMarkers[0].isApproximate, false);
    assert.equal(result.mappedMarkers[1].incident.incident_id, 'INC-02');
    assert.equal(result.mappedMarkers[1].isApproximate, true);
    assert.equal(result.unmappedIncidents[0].incident_id, 'INC-03');
  });

  test('filters incidents by status', () => {
    const result = prepareIncidentMarkers(sampleIncidents, { status: 'Closed' });
    // INC-03 is Closed, but coordinates are [0, 0] so it is unmapped
    assert.equal(result.mappedMarkers.length, 0);
    assert.equal(result.unmappedCount, 1);
  });
});

describe('geoUtils - prepareZoneMarkers', () => {
  const sampleZones: PilotZone[] = [
    {
      zone_id: 'NZ-SAN-01',
      name: 'Sanpada Underpass',
      ward: 'Ward C',
      risk_band: 'high',
      risk_score: 88,
      confidence: 'high',
      coordinates: [19.0664, 73.0092],
      svgPolygon: '',
      active_reports_count: 4,
      has_recurrence_flag: true,
      description: 'Underpass basin',
      terrain_factor: 'Depression',
      drainage_nallah: 'Nallah 2',
      risk_factors: {
        rainfall_weight: 28,
        recurrence_weight: 25,
        terrain_weight: 20,
        incident_evidence: 15,
        infrastructure_context: 10,
      },
      missing_signals: [],
    },
    {
      zone_id: 'NZ-INVALID',
      name: 'Missing Coords Zone',
      ward: 'Ward X',
      risk_band: 'low',
      risk_score: 10,
      confidence: 'low',
      coordinates: [0, 0],
      svgPolygon: '',
      active_reports_count: 0,
      has_recurrence_flag: false,
      description: '',
      terrain_factor: '',
      drainage_nallah: '',
      risk_factors: {
        rainfall_weight: 0,
        recurrence_weight: 0,
        terrain_weight: 0,
        incident_evidence: 0,
        infrastructure_context: 0,
      },
      missing_signals: [],
    },
  ];

  test('prepares mapped zones with [lng, lat] and excludes invalid coordinates', () => {
    const result = prepareZoneMarkers(sampleZones);
    assert.equal(result.mappedZones.length, 1);
    assert.equal(result.unmappedCount, 1);
    assert.equal(result.mappedZones[0].zone.zone_id, 'NZ-SAN-01');
    assert.deepEqual(result.mappedZones[0].lngLat, [73.0092, 19.0664]);
  });
});

