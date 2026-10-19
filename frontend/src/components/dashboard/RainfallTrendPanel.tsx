import React, { useState } from 'react';
import { CloudRain, History, ArrowUpRight, RefreshCw, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { RainfallObservation, WeatherSnapshot } from '../../data/dashboardData';
import { buildDisplayRainfallBars, formatCacheAge } from '../../utils/weatherUtils';

interface RainfallTrendPanelProps {
  rainfall: RainfallObservation[];
  weatherSnapshot?: WeatherSnapshot | null;
  isWeatherLoading?: boolean;
  isWeatherRefreshing?: boolean;
  weatherError?: string | null;
  isDemoMode?: boolean;
  onRefreshWeather?: () => void;
  onOpenHistoricalReplay: () => void;
}

export const RainfallTrendPanel: React.FC<RainfallTrendPanelProps> = ({
  rainfall,
  weatherSnapshot,
  isWeatherLoading = false,
  isWeatherRefreshing = false,
  weatherError = null,
  isDemoMode = false,
  onRefreshWeather,
  onOpenHistoricalReplay,
}) => {
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);

  const {
    bars,
    currentIntensity,
    totalPastVolume,
    weatherDescription,
    peakValue,
    isModelFeed,
  } = buildDisplayRainfallBars(weatherSnapshot, rainfall, isDemoMode);

  const isStale = !!weatherSnapshot?.is_stale;
  const cacheAgeText = weatherSnapshot ? formatCacheAge(weatherSnapshot.cache_age_seconds) : '';

  return (
    <div
      className="bg-white rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col h-full select-none overflow-hidden"
      aria-label="Rainfall and Weather Model Analytics Panel"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-[#DCE6EF] bg-[#F5F8FC]/50 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-[#288EE8]" />
            <h3 className="font-serif text-[18px] font-normal text-[#10243B] leading-none">
              Rainfall & Weather Model
            </h3>
          </div>
          <p className="text-[11.5px] text-[#526984] mt-0.5">
            {isModelFeed
              ? `${weatherSnapshot?.provider_model || 'Open-Meteo Best Match'} · Navi Mumbai (0.1° Grid)`
              : `Station AWS-401 · Nerul Sector 15 Basin`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Provenance Badge */}
          {isDemoMode ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider">
              SIMULATED FEED
            </span>
          ) : isStale ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-200 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-orange-700" />
              STALE ({cacheAgeText})
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-blue-700" />
              WEATHER MODEL
            </span>
          )}

          {/* Manual Refresh Button with Duplicate-Click Prevention */}
          {onRefreshWeather && (
            <button
              type="button"
              onClick={onRefreshWeather}
              disabled={isWeatherRefreshing || isWeatherLoading}
              title="Query Open-Meteo for latest model forecast"
              className="p-1.5 rounded-lg border border-[#DCE6EF] bg-white text-[#526984] hover:text-[#10243B] hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 text-[11px] font-medium"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#288EE8] ${
                  isWeatherRefreshing || isWeatherLoading ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Error / Provider Notice Banner */}
      {weatherError && !isDemoMode && (
        <div className="bg-amber-50 px-3.5 py-2 border-b border-amber-200 flex items-center gap-2 text-[11px] text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="flex-1 font-medium">{weatherError}</span>
        </div>
      )}

      {/* Summary KPI Metrics */}
      <div className="grid grid-cols-2 divide-x divide-[#DCE6EF] border-b border-[#DCE6EF] bg-[#F5F8FC]/30">
        <div className="p-3">
          <div className="text-[10.5px] font-bold text-[#526984] uppercase tracking-wider">
            Current Intensity
          </div>
          <div className="text-[20px] font-bold text-[#10243B] mt-0.5">
            {Number(currentIntensity || 0).toFixed(1)}{' '}
            <span className="text-[12px] font-normal text-[#526984]">mm/hr</span>
          </div>
          <div className="text-[10.5px] text-[#1769C2] font-semibold mt-0.5 truncate" title={weatherDescription}>
            {weatherDescription}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[10.5px] font-bold text-[#526984] uppercase tracking-wider">
            {isModelFeed ? 'Recent Cumulative' : '6h Cumulative Volume'}
          </div>
          <div className="text-[20px] font-bold text-[#10243B] mt-0.5">
            {Number(totalPastVolume || 0).toFixed(1)}{' '}
            <span className="text-[12px] font-normal text-[#526984]">mm</span>
          </div>
          <div className="text-[10.5px] text-[#526984] mt-0.5 truncate">
            {isModelFeed && weatherSnapshot?.provider_timestamp
              ? `Model step: ${weatherSnapshot.provider_timestamp.replace('T', ' ')}`
              : 'Recorded since 09:00 IST'}
          </div>
        </div>
      </div>

      {/* Trend Bar Chart */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] text-[#526984] mb-2">
          <span>{isModelFeed ? 'Past Context & 6h Forecast' : 'Precipitation over past 6 hours'}</span>
          <span className="flex items-center gap-2 font-medium text-[#10243B]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#288EE8]" />
              Model Past
            </span>
            {isModelFeed && (
              <span className="flex items-center gap-1 ml-1.5 text-violet-800">
                <span className="w-2.5 h-2.5 rounded-xs bg-violet-100 border border-dashed border-violet-400" />
                Forecast Window
              </span>
            )}
          </span>
        </div>

        {/* Visual Bar Column Representation */}
        <div className="h-28 flex items-end justify-between gap-2 pt-3 border-b border-[#DCE6EF] pb-1">
          {bars.map((bar, idx) => {
            const heightPercent = Math.max(8, (bar.rainfall_mm / peakValue) * 100);
            return (
              <div
                key={`${bar.time}-${idx}`}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end group"
              >
                {/* Tooltip on Hover */}
                <div className="text-[9.5px] font-bold text-[#10243B] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {bar.rainfall_mm}mm
                  {bar.is_forecast && ' (fcst)'}
                </div>

                {/* Bar */}
                <div
                  className={`w-full max-w-[24px] rounded-t transition-all relative flex items-end overflow-hidden ${
                    bar.is_forecast
                      ? 'bg-violet-100/90 border border-dashed border-violet-400 hover:bg-violet-200'
                      : 'bg-blue-100 hover:bg-blue-200'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      bar.is_forecast ? 'bg-violet-400/80' : 'bg-[#288EE8]'
                    }`}
                    style={{ height: '100%' }}
                  />
                </div>

                {/* Time & Forecast Label */}
                <div className="flex flex-col items-center mt-1">
                  <span className="text-[10px] font-medium text-[#526984] leading-tight">
                    {bar.time}
                  </span>
                  {bar.is_forecast && (
                    <span className="text-[8.5px] font-bold text-violet-600 uppercase tracking-tighter">
                      FCST
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spatial Limitation / Coverage Accordion */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCoverageDetails(!showCoverageDetails)}
            className="w-full flex items-center justify-between text-[11px] text-[#526984] hover:text-[#10243B] py-1 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Info className="w-3.5 h-3.5 text-[#288EE8]" />
              <span>Model Grid Coverage & Telemetry Provenance</span>
            </span>
            <span className="text-[10px] text-[#288EE8] font-bold">
              {showCoverageDetails ? 'Hide' : 'Details'}
            </span>
          </button>

          {showCoverageDetails && (
            <div className="mt-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-[#526984] space-y-1">
              <div className="font-semibold text-[#10243B]">
                {weatherSnapshot?.provenance_text || 'Open-Meteo ECMWF/GFS Numerical Model'}
              </div>
              <p className="leading-relaxed">
                {weatherSnapshot?.spatial_coverage_notes ||
                  'Open-Meteo numerical weather prediction operates on a regional ~0.1° (~11 km) grid covering the Nerul & Sanpada pilot zones. Numerical predictions provide convective rainband context; physical street ponding is verified via ground reports.'}
              </p>
              {weatherSnapshot?.retrieved_at && (
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                  Last retrieved: {new Date(weatherSnapshot.retrieved_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </div>
              )}
            </div>
          )}
        </div>

        {/* Historical Replay Callout */}
        <div className="mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#1769C2] shrink-0" />
            <div>
              <div className="text-[12px] font-bold text-[#10243B]">
                Early-July 2026 Navi Mumbai Case Study
              </div>
              <div className="text-[10.5px] text-[#526984]">
                Evaluate model hotspot predictions against 28 published news accounts.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenHistoricalReplay}
            className="px-2.5 py-1 bg-[#1769C2] hover:bg-[#1257A2] text-white rounded text-[11px] font-bold transition-colors flex items-center gap-1 shrink-0 shadow-xs cursor-pointer"
          >
            <span>Open Replay</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
