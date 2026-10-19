import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  ShieldCheck,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Radio,
  Info,
} from 'lucide-react';
import {
  api,
  type SourceRegistryItem,
  type IngestionRunItem,
  type SourceEvidenceItem,
  type CollectorStatus,
} from '../../../services/api';

export const DataLayersView: React.FC = () => {
  const [sources, setSources] = useState<SourceRegistryItem[]>([]);
  const [collectorStatus, setCollectorStatus] = useState<CollectorStatus | null>(null);
  const [evidenceList, setEvidenceList] = useState<SourceEvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null);
  const [selectedSourceRuns, setSelectedSourceRuns] = useState<{ sourceId: string; runs: IngestionRunItem[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'sources' | 'evidence'>('sources');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [srcs, status, evids] = await Promise.all([
        api.getSources(),
        api.getCollectorStatus().catch(() => null),
        api.getSourceEvidence().catch(() => []),
      ]);
      setSources(srcs);
      setCollectorStatus(status);
      setEvidenceList(evids);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load source registry.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll collector status & sources every 15 seconds
    const interval = setInterval(() => {
      api.getCollectorStatus().then(setCollectorStatus).catch(() => {});
      api.getSources().then(setSources).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleManualRefresh = async (sourceId: string) => {
    if (refreshingSourceId) return;
    setRefreshingSourceId(sourceId);
    setFeedback(null);

    try {
      const res = await api.refreshSource(sourceId);
      setFeedback({
        type: 'success',
        message: `Successfully collected data for ${sourceId}: ${res.records_retrieved} retrieved, ${res.records_inserted} inserted, ${res.records_updated} updated.`,
      });
      // Refresh list
      const updated = await api.getSources();
      setSources(updated);
      if (selectedSourceRuns && selectedSourceRuns.sourceId === sourceId) {
        const runs = await api.getSourceRuns(sourceId, 10);
        setSelectedSourceRuns({ sourceId, runs });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || `Failed to refresh source ${sourceId}.`,
      });
    } finally {
      setRefreshingSourceId(null);
    }
  };

  const handleToggleRuns = async (sourceId: string) => {
    if (selectedSourceRuns && selectedSourceRuns.sourceId === sourceId) {
      setSelectedSourceRuns(null);
      return;
    }
    try {
      const runs = await api.getSourceRuns(sourceId, 10);
      setSelectedSourceRuns({ sourceId, runs });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Could not load runs for ${sourceId}: ${err?.message}` });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Active
          </span>
        );
      case 'Reachable':
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            <Radio className="w-3 h-3 text-blue-600" />
            Reachable
          </span>
        );
      case 'Collecting':
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
            Collecting...
          </span>
        );
      case 'Stale':
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Stale / Retained
          </span>
        );
      case 'Error':
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Error
          </span>
        );
      case 'Verified':
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ShieldCheck className="w-3 h-3 text-indigo-600" />
            Verified Curated
          </span>
        );
      case 'Disabled':
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
            Disabled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const getCadenceLabel = (source: SourceRegistryItem) => {
    if (!source.collection_interval_seconds) {
      return source.category === 'Basemap' ? 'On Map Pan / Zoom (CDN)' : 'Manual Curation / Administrative';
    }
    const mins = Math.round(source.collection_interval_seconds / 60);
    if (mins >= 1440) return `Daily (every ${Math.round(mins / 1440)}d)`;
    if (mins >= 60) return `Hourly (every ${Math.round(mins / 60)}h)`;
    return `Every ${mins} minutes`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1769C2]" />
            <h2 className="font-serif text-[22px] font-normal text-[#10243B] leading-none">
              Source Registry, Ingestion & Provenance
            </h2>
          </div>
          <p className="text-[12px] text-[#526984] mt-1">
            Autonomous ingestion tracking, deduplication health, and real-time coverage limits for JalDrishti v1.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-[#F1F5F9] p-0.5 rounded-lg border border-[#DCE6EF] text-[12px] font-medium">
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'sources'
                  ? 'bg-white text-[#10243B] shadow-xs font-semibold'
                  : 'text-[#526984] hover:text-[#10243B]'
              }`}
            >
              Data Sources ({sources.length})
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'evidence'
                  ? 'bg-white text-[#10243B] shadow-xs font-semibold'
                  : 'text-[#526984] hover:text-[#10243B]'
              }`}
            >
              Curated Evidence ({evidenceList.length})
            </button>
          </div>

          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1769C2] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
            title="Reload source registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Collector Heartbeat & Process Status Banner */}
      <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-[12.5px]">
        <div className="flex items-start md:items-center gap-3">
          <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] shrink-0">
            <Activity className="w-5 h-5 text-[#1769C2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#10243B]">Scheduled Worker Process:</span>
              {collectorStatus?.heartbeat_status === 'Healthy' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active & Scheduled
                </span>
              ) : collectorStatus?.heartbeat_status === 'Stale' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Heartbeat Stale ({collectorStatus?.heartbeat_age_seconds}s ago)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  Worker Idle / Manual Mode
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[#526984] mt-0.5">
              {collectorStatus?.is_running
                ? `Worker PID ${collectorStatus.pid || 'Active'} • Autonomous collection runs continuously in background.`
                : 'Autonomous scheduled polling operates while `python -m backend.collector` is running. Manual API refresh remains active.'}
            </p>
          </div>
        </div>

        {collectorStatus?.next_scheduled_runs && Object.keys(collectorStatus.next_scheduled_runs).length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-[#526984] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-[#1769C2]" />
            <span>Next Scheduled Runs:</span>
            {Object.entries(collectorStatus.next_scheduled_runs).map(([sid, due]) => (
              <span key={sid} className="font-mono font-medium text-[#10243B]">
                {sid}: {new Date(due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-[12.5px] flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] font-semibold underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Provenance Rules Banner */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#1769C2] shrink-0 mt-0.5" />
        <div className="text-[12px] text-[#10243B] leading-relaxed">
          <strong className="text-[#10243B]">Autonomous Data Collection & Provenance Standards:</strong>
          <p className="text-[#526984] mt-0.5">
            JalDrishti distinguishes <strong>Source Registered</strong> from <strong>Source Reachable</strong>, <strong>Collection Succeeded</strong>, <strong>Data Fresh</strong>, and <strong>Independently Verified</strong>. No fake success indicators or unverified depths are displayed.
          </p>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'sources' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sources.map((source) => {
            const isSupported = source.id === 'open-meteo' || source.id === 'osm-overpass';
            const isRefreshing = refreshingSourceId === source.id;
            const isRunsOpen = selectedSourceRuns?.sourceId === source.id;

            return (
              <div
                key={source.id}
                className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs flex flex-col justify-between space-y-4"
              >
                {/* Header & Badges */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {source.category}
                        </span>
                        {getStatusBadge(source.status)}
                      </div>
                      <h3 className="font-bold text-[15px] text-[#10243B] mt-1.5 leading-snug">
                        {source.name}
                      </h3>
                      <p className="text-[11.5px] text-[#526984] mt-0.5">{source.provider}</p>
                    </div>

                    {isSupported && (
                      <button
                        onClick={() => handleManualRefresh(source.id)}
                        disabled={isRefreshing || !source.is_enabled}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#1769C2] bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors disabled:opacity-50 shrink-0"
                        title={`Trigger immediate manual collection for ${source.id}`}
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Collecting...' : 'Collect Now'}
                      </button>
                    )}
                  </div>

                  {/* Coverage & Attribution */}
                  <div className="mt-3 text-[11.5px] text-[#526984] space-y-1">
                    <div className="flex items-start gap-1">
                      <span className="font-medium text-[#10243B] shrink-0">Coverage:</span>
                      <span>{source.geographic_coverage}</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="font-medium text-[#10243B] shrink-0">Attribution:</span>
                      <span>{source.attribution}</span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-3.5 p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-center text-[11px]">
                    <div>
                      <span className="text-[#526984] block text-[10px]">Retrieved</span>
                      <strong className="text-[#10243B] font-mono text-[12px]">
                        {source.records_retrieved.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#526984] block text-[10px]">Upserted</span>
                      <strong className="text-emerald-700 font-mono text-[12px]">
                        +{source.records_inserted} / ~{source.records_updated}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#526984] block text-[10px]">Unchanged</span>
                      <strong className="text-[#526984] font-mono text-[12px]">
                        {source.records_unchanged.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Error Summary if present */}
                  {source.error_summary && (
                    <div className="mt-2.5 p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="overflow-hidden text-ellipsis">
                        <strong className="font-semibold">Recent Ingestion Notice:</strong> {source.error_summary}
                      </div>
                    </div>
                  )}

                  {/* Truthful Geographic Feature Provenance Banner for osm-overpass */}
                  {source.id === 'osm-overpass' && (
                    <div className="mt-2.5 p-2 rounded bg-slate-50 border border-slate-200 text-[#10243B] text-[11px] leading-relaxed">
                      <strong className="font-semibold text-[#1769C2]">Data Provenance:</strong> All 8 geographic features in database are curated baseline fixtures. Live OpenStreetMap collection is currently unavailable.
                    </div>
                  )}

                  {/* Known Limitations */}
                  {source.limitations && source.limitations.length > 0 && (
                    <div className="mt-2.5 space-y-1">
                      <div className="text-[10.5px] font-semibold text-[#526984] uppercase tracking-wider flex items-center gap-1">
                        <Info className="w-3 h-3 text-[#1769C2]" />
                        Known Coverage & Sensor Limitations
                      </div>
                      <ul className="text-[11px] text-[#526984] list-disc list-inside space-y-0.5 pl-1">
                        {source.limitations.map((lim, idx) => (
                          <li key={idx} className="leading-tight">{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Footer Metadata */}
                <div className="pt-3 border-t border-[#DCE6EF] space-y-1 text-[11px] text-[#526984]">
                  <div className="flex justify-between">
                    <span>Cadence:</span>
                    <strong className="text-[#10243B]">{getCadenceLabel(source)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Freshness / Last Success:</span>
                    <strong className="text-[#10243B]">
                      {source.data_age_label || (source.last_success_at ? new Date(source.last_success_at).toLocaleTimeString() : 'Awaiting First Run')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Licence:</span>
                    <span className="text-[#10243B] truncate max-w-[200px]" title={source.license}>
                      {source.license}
                    </span>
                  </div>

                  {/* Toggle Run History Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleToggleRuns(source.id)}
                      className="text-[11px] font-semibold text-[#1769C2] hover:text-[#10243B] flex items-center gap-1 transition-colors"
                    >
                      {isRunsOpen ? (
                        <>
                          Hide Ingestion Logs <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          View Run History <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Inline Run History Drawer */}
                  {isRunsOpen && selectedSourceRuns && (
                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#10243B] block">
                        Recent Ingestion Runs ({selectedSourceRuns.runs.length})
                      </span>
                      {selectedSourceRuns.runs.length === 0 ? (
                        <p className="text-[11px] text-[#526984] italic">No collection runs recorded yet.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {selectedSourceRuns.runs.map((r) => (
                            <div
                              key={r.id}
                              className="p-2 rounded bg-slate-50 border border-slate-200 text-[10.5px] flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-[#10243B]">
                                  {new Date(r.started_at).toLocaleTimeString()}
                                </span>
                                <span className="text-[#526984] ml-2">
                                  {r.duration_seconds !== null ? `${r.duration_seconds}s` : 'in-flight'}
                                </span>
                                <div className="text-[#526984]">
                                  +{r.records_inserted} in / ~{r.records_updated} up / {r.records_unchanged} unch
                                </div>
                              </div>
                              <div className="text-right">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                    r.status === 'Success'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : r.status === 'Partial'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Curated Source Evidence Tab */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#DCE6EF] shadow-xs">
            <h3 className="font-bold text-[14.5px] text-[#10243B]">
              Curated Historical News & Municipal Documentation
            </h3>
            <p className="text-[12px] text-[#526984] mt-0.5">
              Archival press reports and municipal engineering surveys preserved with canonical citations. Area-level evidence is strictly separated from automated GPS incident reports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidenceList.map((evid) => (
              <div
                key={evid.id}
                className="bg-white p-5 rounded-xl border border-[#DCE6EF] shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                      {evid.id}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 ml-1.5">
                      {evid.verification_status}
                    </span>
                  </div>
                  {evid.canonical_url && (
                    <a
                      href={evid.canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1769C2] hover:text-[#10243B] flex items-center gap-1 text-[11px] font-medium"
                    >
                      Source Link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-[13.5px] text-[#10243B]">
                    {evid.location_phrase}
                  </h4>
                  <div className="text-[11px] text-[#526984] mt-0.5">
                    Published by <strong>{evid.publisher}</strong>
                    {evid.publication_date && ` • ${evid.publication_date}`}
                    {evid.event_date && ` (Event Date: ${evid.event_date})`}
                  </div>
                </div>

                <p className="text-[12px] text-[#526984] bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed italic">
                  "{evid.evidence_text}"
                </p>

                <div className="flex items-center justify-between text-[11px] text-[#526984] pt-2 border-t border-[#DCE6EF]">
                  <span>Geographic Precision:</span>
                  <strong className="text-[#10243B]">{evid.geographic_precision}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
