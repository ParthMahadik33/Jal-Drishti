import type { PilotZone, IncidentRecord } from '../data/dashboardData';

/**
 * Validates whether the given value is a valid geographic coordinate [latitude, longitude].
 * Valid latitude: -90 to 90
 * Valid longitude: -180 to 180
 * Rejects [0, 0] (Null Island) or non-finite numbers.
 */
export function isValidCoordinate(coords: unknown): coords is [number, number] {
  if (!Array.isArray(coords) || coords.length !== 2) {
    return false;
  }
  const [lat, lng] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }
  // Exclude Null Island (0, 0) unless genuinely intended
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return false;
  }
  return true;
}

/**
 * Converts internal [lat, lng] to MapLibre / GeoJSON [lng, lat] standard.
 */
export function toLngLat(coords: [number, number]): [number, number] {
  return [coords[1], coords[0]];
}

/**
 * Computes bounding box [[minLng, minLat], [maxLng, maxLat]] for a list of [lat, lng] coordinates.
 */
export function calculatePilotBounds(
  coordinates: [number, number][]
): [[number, number], [number, number]] | null {
  const validCoords = coordinates.filter(isValidCoordinate);
  if (validCoords.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lat, lng] of validCoords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  // Return [[minLng, minLat], [maxLng, maxLat]] for MapLibre fitBounds
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * Safely constructs the CARTO Positron style URL with provided API key.
 * Never exposes raw secrets in client logs.
 */
export function buildCartoStyleUrl(apiKey?: string): {
  url: string;
  hasKey: boolean;
  attribution: string;
} {
  const trimmed = apiKey ? apiKey.trim() : '';
  const attribution =
    '&copy; <a href="https://carto.com/about-carto/" target="_blank" rel="noopener noreferrer">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

  if (!trimmed) {
    return {
      url: '',
      hasKey: false,
      attribution,
    };
  }

  return {
    url: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json?key=${encodeURIComponent(trimmed)}`,
    hasKey: true,
    attribution,
  };
}

export interface PreparedIncidentMarker {
  incident: IncidentRecord;
  lngLat: [number, number];
  isApproximate: boolean;
}

export interface PreparedZoneMarker {
  zone: PilotZone;
  lngLat: [number, number];
}

/**
 * Prepares incident records for map visualization.
 * Separates verified GPS coordinates from unverified/approximate records.
 */
export function prepareIncidentMarkers(
  incidents: IncidentRecord[],
  activeFilters?: {
    status?: string;
    severity?: string;
  }
): {
  mappedMarkers: PreparedIncidentMarker[];
  unmappedCount: number;
  unmappedIncidents: IncidentRecord[];
} {
  const mappedMarkers: PreparedIncidentMarker[] = [];
  const unmappedIncidents: IncidentRecord[] = [];

  for (const inc of incidents) {
    // Apply filters if provided
    if (activeFilters?.status && activeFilters.status !== 'All' && inc.review_state !== activeFilters.status) {
      continue;
    }
    if (
      activeFilters?.severity &&
      activeFilters.severity !== 'All' &&
      inc.visual_severity !== activeFilters.severity.toLowerCase()
    ) {
      continue;
    }

    const hasValidGps = isValidCoordinate(inc.coordinates);
    const isApproximate =
      !hasValidGps ||
      inc.data_status === 'Inferred' ||
      inc.location_name.toLowerCase().includes('missing gps') ||
      inc.location_name.toLowerCase().includes('approximate');

    if (hasValidGps && !isApproximate) {
      mappedMarkers.push({
        incident: inc,
        lngLat: toLngLat(inc.coordinates),
        isApproximate: false,
      });
    } else if (hasValidGps && isApproximate) {
      // Has approximate coordinates: we can map it with an explicit approximate flag
      mappedMarkers.push({
        incident: inc,
        lngLat: toLngLat(inc.coordinates),
        isApproximate: true,
      });
    } else {
      unmappedIncidents.push(inc);
    }
  }

  return {
    mappedMarkers,
    unmappedCount: unmappedIncidents.length,
    unmappedIncidents,
  };
}

/**
 * Prepares zone records for map visualization.
 */
export function prepareZoneMarkers(zones: PilotZone[]): {
  mappedZones: PreparedZoneMarker[];
  unmappedCount: number;
} {
  const mappedZones: PreparedZoneMarker[] = [];
  let unmappedCount = 0;

  for (const zone of zones) {
    if (isValidCoordinate(zone.coordinates)) {
      mappedZones.push({
        zone,
        lngLat: toLngLat(zone.coordinates),
      });
    } else {
      unmappedCount += 1;
    }
  }

  return {
    mappedZones,
    unmappedCount,
  };
}
