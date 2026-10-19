import type { WeatherSnapshot, RainfallObservation } from '../data/dashboardData';

export interface DisplayRainfallBar {
  time: string;
  timestamp_iso: string;
  rainfall_mm: number;
  is_forecast: boolean;
  probability?: number | null;
  label?: string;
}

/**
 * Builds a unified list of display bars from either a live WeatherSnapshot or demo RainfallObservation[]
 */
export function buildDisplayRainfallBars(
  weatherSnapshot: WeatherSnapshot | null | undefined,
  fallbackRainfall: RainfallObservation[],
  isDemoMode: boolean
): {
  bars: DisplayRainfallBar[];
  currentIntensity: number;
  totalPastVolume: number;
  weatherDescription: string;
  peakValue: number;
  isModelFeed: boolean;
} {
  if (!isDemoMode && weatherSnapshot && ((weatherSnapshot.past_records && weatherSnapshot.past_records.length > 0) || (weatherSnapshot.forecast_records && weatherSnapshot.forecast_records.length > 0))) {
    const pastBars: DisplayRainfallBar[] = (weatherSnapshot.past_records || []).map((r) => ({
      time: r.time,
      timestamp_iso: r.timestamp_iso,
      rainfall_mm: r.precipitation_mm ?? 0,
      is_forecast: false,
      probability: r.precipitation_probability,
      label: r.relative_time_label,
    }));

    const forecastBars: DisplayRainfallBar[] = (weatherSnapshot.forecast_records || []).map((r) => ({
      time: r.time,
      timestamp_iso: r.timestamp_iso,
      rainfall_mm: r.precipitation_mm ?? 0,
      is_forecast: true,
      probability: r.precipitation_probability,
      label: r.relative_time_label,
    }));

    // Combine past (last 6) + forecast (next 6) for a clean 12-hour operational view
    const combined = [...pastBars.slice(-6), ...forecastBars.slice(0, 6)];
    const peak = Math.max(...combined.map((b) => b.rainfall_mm), weatherSnapshot.current_precipitation_mm ?? 0, 15);

    return {
      bars: combined,
      currentIntensity: weatherSnapshot.current_precipitation_mm ?? weatherSnapshot.current_intensity_mm_hr ?? 0,
      totalPastVolume: weatherSnapshot.total_past_rainfall_mm ?? 0,
      weatherDescription: weatherSnapshot.weather_description || 'Numerical model projection',
      peakValue: peak,
      isModelFeed: true,
    };
  }

  // Demo / Fallback Mode (Simulated feed)
  const demoBars: DisplayRainfallBar[] = (fallbackRainfall || []).map((r) => ({
    time: r.time,
    timestamp_iso: r.timestamp_iso || '',
    rainfall_mm: r.rainfall_mm ?? 0,
    is_forecast: !!r.is_forecast,
    probability: r.precipitation_probability,
    label: r.is_forecast ? 'Forecast' : 'Simulated',
  }));

  const total = demoBars.filter((b) => !b.is_forecast).reduce((sum, b) => sum + b.rainfall_mm, 0);
  const peak = Math.max(...demoBars.map((b) => b.rainfall_mm), 35);
  const lastIntensity = demoBars.length > 0 ? (demoBars[demoBars.length - 1].rainfall_mm ?? 0) : 0;

  return {
    bars: demoBars,
    currentIntensity: lastIntensity,
    totalPastVolume: Math.round(total * 10) / 10,
    weatherDescription: 'Moderate convective rainband (Simulated)',
    peakValue: peak,
    isModelFeed: false,
  };
}

/**
 * Formats seconds into human-readable relative minutes or hours
 */
export function formatCacheAge(seconds: number): string {
  if (seconds < 60) return 'Just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
