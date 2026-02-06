'use client';

import { useState, useEffect, useCallback } from 'react';

interface CredibilityEvent {
  id: string;
  businessName: string;
  eventType: string;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rawData: { author: string; rating: number; text: string };
  detectedAt: string;
  classification?: {
    sentiment: string;
    themes: string[];
    credibilityImpact: number;
    urgency: string;
  };
  actionsTaken: Array<{
    type: string;
    details: Record<string, unknown>;
    timestamp: string;
  }>;
  responseDrafted?: string;
  humanFeedback?: string;
  status: string;
}

interface LogEntry {
  message: string;
  timestamp: string;
  type: string;
}

interface Integrations {
  apify: boolean;
  groq: boolean;
  crm: boolean;
  intercom: boolean;
  redpanda: boolean;
  sentry: boolean;
}

const severityStyles: Record<string, { border: string; dot: string }> = {
  low: { border: 'border-blue-500/30 bg-blue-500/5', dot: 'bg-blue-400' },
  medium: {
    border: 'border-yellow-500/30 bg-yellow-500/5',
    dot: 'bg-yellow-400',
  },
  high: {
    border: 'border-orange-500/30 bg-orange-500/5',
    dot: 'bg-orange-400',
  },
  critical: { border: 'border-red-500/30 bg-red-500/5', dot: 'bg-red-400' },
};

const statusLabels: Record<string, string> = {
  detected: 'Detected',
  analyzing: 'Analyzing...',
  acting: 'Taking action...',
  complete: 'Complete',
  error: 'Error',
};

const actionLabels: Record<string, string> = {
  crm_inbox: 'CRM Inbox',
  crm_task: 'CRM Task',
  intercom_alert: 'Intercom',
  redpanda_event: 'Redpanda',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* ---------- Score Gauge Ring ---------- */
function ScoreGauge({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? 'text-emerald-400'
      : score >= 60
        ? 'text-yellow-400'
        : 'text-red-400';
  const glowColor =
    score >= 80
      ? 'rgba(16,185,129,0.12)'
      : score >= 60
        ? 'rgba(234,179,8,0.12)'
        : 'rgba(239,68,68,0.12)';

  return (
    <div className="relative w-36 h-36 mx-auto">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }}
      />
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-gray-800"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${color} score-ring`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold tabular-nums ${color}`}>
          {score}
        </span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
          Score
        </span>
      </div>
    </div>
  );
}

/* ---------- Score Sparkline ---------- */
function Sparkline({ history }: { history: Array<{ score: number }> }) {
  if (history.length < 2) return null;
  const min = Math.min(...history.map((h) => h.score)) - 5;
  const max = Math.max(...history.map((h) => h.score)) + 5;
  const range = max - min || 1;
  const w = 200;
  const h = 32;
  const points = history
    .map((pt, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((pt.score - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8 mt-2 opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-emerald-400"
      />
    </svg>
  );
}

/* ---------- Star Rating ---------- */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? 'text-yellow-400' : 'text-gray-700'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

/* ---------- Pipeline Diagram ---------- */
function PipelineDiagram({
  activeStage,
  integrations,
}: {
  activeStage: string | null;
  integrations: Integrations;
}) {
  const stages = [
    { id: 'scout', label: 'Scout', sub: 'Apify', connected: integrations.apify },
    { id: 'analyst', label: 'Analyst', sub: 'Groq LLM', connected: integrations.groq },
    { id: 'action', label: 'Actions', sub: 'CRM + Intercom + Redpanda', connected: true },
  ];

  return (
    <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 mb-4">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">
        Agent Pipeline
      </p>
      <div className="flex items-center gap-1">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center flex-1">
            <div
              className={`flex-1 py-2 px-3 rounded-lg border text-center transition-all ${
                activeStage === stage.id
                  ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
                  : activeStage === 'complete' && stage.connected
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-gray-700/50 bg-gray-800/30'
              }`}
            >
              <p
                className={`text-xs font-medium ${
                  activeStage === stage.id ? 'text-emerald-300' : 'text-gray-300'
                }`}
              >
                {stage.label}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">{stage.sub}</p>
            </div>
            {i < stages.length - 1 && (
              <div className="w-6 flex items-center justify-center relative">
                <div className="w-full h-px bg-gray-700" />
                {activeStage && (
                  <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-flow-right" />
                )}
                <svg
                  className="absolute right-0 w-2 h-2 text-gray-600"
                  fill="currentColor"
                  viewBox="0 0 8 8"
                >
                  <path d="M0 0l4 4-4 4z" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Feedback loop indicator */}
      <div className="flex items-center justify-center mt-2 gap-2">
        <div className="h-px w-12 bg-gray-800" />
        <span className="text-[10px] text-gray-600">
          Human Feedback Loop
        </span>
        <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
        <div className="h-px w-12 bg-gray-800" />
      </div>
    </div>
  );
}

/* ---------- Integration Status Pill ---------- */
function IntegrationPill({
  name,
  connected,
  lastStatus,
}: {
  name: string;
  connected: boolean;
  lastStatus?: 'ok' | 'failed' | 'skipped';
}) {
  const dotColor =
    !connected
      ? 'bg-gray-600'
      : lastStatus === 'failed'
        ? 'bg-amber-400'
        : 'bg-emerald-400';

  return (
    <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-gray-800/50 border border-gray-700/50">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span className={connected ? 'text-gray-300' : 'text-gray-600'}>
        {name}
      </span>
    </span>
  );
}

/* ========== Main Dashboard ========== */
export default function Dashboard() {
  const [events, setEvents] = useState<CredibilityEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [score, setScore] = useState({
    current: 87,
    history: [] as Array<{ score: number; timestamp: string }>,
  });
  const [integrations, setIntegrations] = useState<Integrations>({
    apify: false,
    groq: false,
    crm: false,
    intercom: false,
    redpanda: false,
    sentry: false,
  });
  const [scanning, setScanning] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/events');
      const data = await res.json();
      setEvents(data.events || []);
      setLogs(data.logs || []);
      setScore(data.score || { current: 87, history: [] });
      if (data.integrations) setIntegrations(data.integrations);
    } catch {
      // Silently retry on next poll
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, [fetchData]);

  const applyState = (data: { events?: CredibilityEvent[]; logs?: LogEntry[]; score?: typeof score }) => {
    if (data.events) setEvents(data.events);
    if (data.logs) setLogs(data.logs);
    if (data.score) setScore(data.score);
  };

  const triggerScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      applyState(data);
    } finally {
      setScanning(false);
    }
  };

  const resetAgent = async () => {
    const res = await fetch('/api/agent/reset', { method: 'POST' });
    const data = await res.json();
    applyState(data);
  };

  const submitFeedback = async (
    eventId: string,
    feedback: 'accepted' | 'rejected'
  ) => {
    await fetch('/api/agent/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, feedback }),
    });
    await fetchData();
  };

  const previousScore =
    score.history.length >= 2
      ? score.history[score.history.length - 2].score
      : score.current;
  const delta = score.current - previousScore;

  // Determine which pipeline stage is active
  const activeStage = events.length === 0
    ? null
    : events.some((e) => e.status === 'detected')
      ? 'scout'
      : events.some((e) => e.status === 'analyzing')
        ? 'analyst'
        : events.some((e) => e.status === 'acting')
          ? 'action'
          : 'complete';

  // Derive integration action statuses from events
  const getLastActionStatus = (actionType: string) => {
    for (const e of events) {
      const action = e.actionsTaken.find((a) => a.type === actionType);
      if (action) {
        if (action.details.status === 'failed') return 'failed' as const;
        if (action.details.status === 'skipped') return 'skipped' as const;
        return 'ok' as const;
      }
    }
    return undefined;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              Credibility Intelligence Agent
            </h1>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <IntegrationPill name="Apify" connected={integrations.apify} lastStatus={getLastActionStatus('crm_inbox') /* scout doesn't have action */} />
              <IntegrationPill name="Groq" connected={integrations.groq} />
              <IntegrationPill name="CRM" connected={integrations.crm} lastStatus={getLastActionStatus('crm_inbox')} />
              <IntegrationPill name="Intercom" connected={integrations.intercom} lastStatus={getLastActionStatus('intercom_alert')} />
              <IntegrationPill name="Redpanda" connected={integrations.redpanda} lastStatus={getLastActionStatus('redpanda_event')} />
              <IntegrationPill name="Sentry" connected={integrations.sentry} />
            </div>
            <span className="text-sm text-gray-500 font-medium ml-2">
              Boxford Partners
            </span>
          </div>
        </div>
      </header>

      <main className="flex h-[calc(100vh-57px)]">
        {/* Left Panel — Score + Controls */}
        <aside className="w-72 border-r border-gray-800 p-5 flex flex-col gap-5 shrink-0">
          {/* Credibility Score Gauge */}
          <div className="text-center">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">
              Credibility Score
            </p>
            <ScoreGauge score={score.current} />
            {delta !== 0 && (
              <p
                className={`text-sm font-medium mt-1 ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {delta > 0 ? '\u2191' : '\u2193'} {Math.abs(delta)} pts
              </p>
            )}
            <Sparkline history={score.history} />
          </div>

          {/* Scan Button */}
          <button
            onClick={triggerScan}
            disabled={scanning}
            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              scanning
                ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                : events.length === 0
                  ? 'bg-emerald-500 text-white hover:bg-emerald-400 active:scale-[0.98] shadow-lg shadow-emerald-500/20'
                  : 'bg-emerald-500 text-white hover:bg-emerald-400 active:scale-[0.98]'
            }`}
          >
            {scanning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-emerald-300/40 border-t-white rounded-full animate-spin" />
                Scanning...
              </span>
            ) : (
              'Scan Now'
            )}
          </button>

          {/* Reset Button */}
          <button
            onClick={resetAgent}
            className="w-full py-2 px-4 rounded-lg font-medium text-xs text-gray-500 border border-gray-800 hover:border-gray-600 hover:text-gray-300 transition-all"
          >
            Reset Demo
          </button>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-900 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-500">Events</p>
              <p className="text-xl font-bold tabular-nums">{events.length}</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-500">Actions</p>
              <p className="text-xl font-bold tabular-nums">
                {events.reduce((sum, e) => sum + e.actionsTaken.length, 0)}
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-500">Feedback</p>
              <p className="text-xl font-bold tabular-nums">
                {events.filter((e) => e.humanFeedback).length}
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-500">Learning</p>
              <p className="text-lg font-bold tabular-nums text-emerald-400">
                {events.filter((e) => e.humanFeedback).length > 0
                  ? 'Active'
                  : 'Idle'}
              </p>
            </div>
          </div>

          {/* Powered by */}
          <div className="mt-auto pt-4 border-t border-gray-800/50">
            <p className="text-[10px] text-gray-700 text-center leading-relaxed">
              Powered by Apify &middot; Groq &middot; Intercom &middot; Sentry &middot; Redpanda
            </p>
          </div>
        </aside>

        {/* Center — Pipeline + Event Feed */}
        <section className="flex-1 p-5 overflow-y-auto flex flex-col min-w-0">
          {/* Pipeline Diagram */}
          <PipelineDiagram activeStage={activeStage} integrations={integrations} />

          <h2 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">
            Event Feed
          </h2>

          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600">
              <svg
                className="w-10 h-10 mb-2 opacity-20"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="text-sm">No events detected yet</p>
              <p className="text-xs mt-1 text-gray-700">
                Click &quot;Scan Now&quot; to begin monitoring
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const styles =
                  severityStyles[event.severity] || severityStyles.low;
                const isExpanded = expandedEvent === event.id;

                return (
                  <div
                    key={event.id}
                    className={`border rounded-lg p-4 transition-all cursor-pointer hover:border-gray-600 animate-slide-in ${styles.border}`}
                    onClick={() =>
                      setExpandedEvent(isExpanded ? null : event.id)
                    }
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="relative shrink-0">
                          <span
                            className={`block w-2.5 h-2.5 rounded-full ${styles.dot}`}
                          />
                          {event.severity === 'critical' && (
                            <span
                              className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${styles.dot} animate-ping`}
                            />
                          )}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <Stars rating={event.rawData.rating} />
                            <p className="font-medium text-sm">
                              from {event.rawData.author || 'Unknown'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {event.source} &middot;{' '}
                            {formatTime(event.detectedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.classification && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              event.classification.sentiment === 'negative'
                                ? 'bg-red-500/20 text-red-300'
                                : event.classification.sentiment === 'positive'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-gray-500/20 text-gray-300'
                            }`}
                          >
                            {event.classification.credibilityImpact > 0
                              ? '+'
                              : ''}
                            {event.classification.credibilityImpact} pts
                          </span>
                        )}
                        <span
                          className={`text-xs font-medium ${
                            event.status === 'complete'
                              ? 'text-emerald-400'
                              : event.status === 'error'
                                ? 'text-red-400'
                                : 'text-yellow-400 animate-pulse'
                          }`}
                        >
                          {statusLabels[event.status] || event.status}
                        </span>
                      </div>
                    </div>

                    {/* Review text preview */}
                    <p className="text-sm text-gray-400 mt-2 ml-[1.375rem]">
                      &ldquo;
                      {event.rawData.text?.substring(0, 150)}
                      {(event.rawData.text?.length || 0) > 150 ? '...' : ''}
                      &rdquo;
                    </p>

                    {/* Expanded details */}
                    {isExpanded && event.status === 'complete' && (
                      <div className="mt-4 ml-[1.375rem] space-y-3">
                        {/* Themes */}
                        {event.classification &&
                          event.classification.themes.length > 0 && (
                            <div className="bg-gray-900/50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">
                                Detected Themes
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {event.classification.themes.map((theme, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded"
                                  >
                                    {theme}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Drafted Response */}
                        {event.responseDrafted && (
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                              Drafted Response
                            </p>
                            <p className="text-sm text-gray-300 leading-relaxed">
                              {event.responseDrafted}
                            </p>

                            {!event.humanFeedback ? (
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    submitFeedback(event.id, 'accepted');
                                  }}
                                  className="text-xs px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-md hover:bg-emerald-500/30 transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    submitFeedback(event.id, 'rejected');
                                  }}
                                  className="text-xs px-3 py-1.5 bg-red-500/20 text-red-300 rounded-md hover:bg-red-500/30 transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 mt-3">
                                Feedback:{' '}
                                <span
                                  className={
                                    event.humanFeedback === 'accepted'
                                      ? 'text-emerald-400'
                                      : 'text-red-400'
                                  }
                                >
                                  {event.humanFeedback}
                                </span>{' '}
                                &mdash; Agent learning updated
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions Taken */}
                        {event.actionsTaken.length > 0 && (
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                              Actions Taken
                            </p>
                            <div className="space-y-1.5">
                              {event.actionsTaken.map((action, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <span
                                    className={
                                      action.details.status === 'failed'
                                        ? 'text-red-400'
                                        : action.details.status === 'skipped'
                                          ? 'text-gray-500'
                                          : 'text-emerald-400'
                                    }
                                  >
                                    {action.details.status === 'failed'
                                      ? '\u2717'
                                      : action.details.status === 'skipped'
                                        ? '\u2013'
                                        : '\u2713'}
                                  </span>
                                  <span className="text-gray-300">
                                    {actionLabels[action.type] || action.type}
                                  </span>
                                  <span className="text-gray-600">
                                    {formatTime(action.timestamp)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Panel — Agent Log */}
        <aside className="w-80 border-l border-gray-800 p-5 flex flex-col shrink-0">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">
            Agent Log
          </p>
          <div className="flex-1 overflow-y-auto space-y-1.5 text-xs font-mono min-h-0">
            {logs.slice(0, 50).map((entry, i) => (
              <div
                key={i}
                className={`flex gap-2 leading-relaxed ${
                  i === 0
                    ? 'border-l-2 border-emerald-500 pl-2'
                    : 'border-l-2 border-transparent pl-2'
                }`}
              >
                <span className="text-gray-600 shrink-0">
                  {formatTime(entry.timestamp)}
                </span>
                <span
                  className={
                    entry.type === 'error'
                      ? 'text-red-400'
                      : entry.type === 'success'
                        ? 'text-emerald-400'
                        : 'text-gray-400'
                  }
                >
                  {entry.message}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-gray-600 italic font-sans text-xs">
                No activity yet.
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
