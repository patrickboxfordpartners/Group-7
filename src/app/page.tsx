'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScoreGauge, Sparkline } from '@/components/score-gauge';
import { PipelineDiagram } from '@/components/pipeline-diagram';
import { EventCard } from '@/components/event-card';
import { AgentLog } from '@/components/agent-log';
import { IntegrationPill } from '@/components/integration-pill';

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
  const [toast, setToast] = useState<{
    message: string;
    type: string;
  } | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showMobileLog, setShowMobileLog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/events');
      const data = await res.json();
      setEvents((prev) => {
        const polled = data.events || [];
        return polled.length >= prev.length ? polled : prev;
      });
      setLogs((prev) => {
        const polled = data.logs || [];
        return polled.length >= prev.length ? polled : prev;
      });
      if (data.score) {
        setScore((prev) => {
          return (data.score.history?.length || 0) >= (prev.history?.length || 0)
            ? data.score
            : prev;
        });
      }
      if (data.integrations) setIntegrations(data.integrations);
    } catch {
      // Silently retry on next poll
    } finally {
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, [fetchData]);

  const applyState = (data: {
    events?: CredibilityEvent[];
    logs?: LogEntry[];
    score?: typeof score;
  }) => {
    if (data.events) {
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEvents = data.events!.filter((e) => !existingIds.has(e.id));
        return [...newEvents, ...prev];
      });
    }
    if (data.logs) {
      setLogs((prev) => {
        const existingMsgs = new Set(
          prev.map((l) => l.timestamp + l.message)
        );
        const newLogs = data.logs!.filter(
          (l) => !existingMsgs.has(l.timestamp + l.message)
        );
        return [...newLogs, ...prev];
      });
    }
    if (data.score) setScore(data.score);
  };

  const showToast = (message: string, type: string = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const triggerScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch('/api/agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Scan failed (${res.status})`);
      }
      const data = await res.json();
      applyState(data);

      if (data.events?.[0]?.actionsTaken) {
        const intercomAction = data.events[0].actionsTaken.find(
          (a: { type: string; details: Record<string, unknown> }) =>
            a.type === 'intercom_alert'
        );
        if (intercomAction?.details?.status === 'sent') {
          showToast('Intercom: Alert sent to operator', 'intercom');
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Scan failed unexpectedly';
      setScanError(message);
      showToast(message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const resetAgent = async () => {
    const res = await fetch('/api/agent/reset', { method: 'POST' });
    const data = await res.json();
    setEvents([]);
    setLogs(data.logs || []);
    setScore(data.score || { current: 87, history: [] });
    setScanError(null);
  };

  const submitFeedback = async (
    eventId: string,
    feedback: 'accepted' | 'rejected',
    modifiedResponse?: string
  ) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              humanFeedback: feedback,
              ...(modifiedResponse
                ? { responseDrafted: modifiedResponse }
                : {}),
            }
          : e
      )
    );
    fetch('/api/agent/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, feedback, modifiedResponse }),
    }).catch(() => {});
  };

  const previousScore =
    score.history.length >= 2
      ? score.history[score.history.length - 2].score
      : score.current;
  const delta = score.current - previousScore;

  const activeStage =
    events.length === 0
      ? null
      : events.some((e) => e.status === 'detected')
        ? 'scout'
        : events.some((e) => e.status === 'analyzing')
          ? 'analyst'
          : events.some((e) => e.status === 'acting')
            ? 'action'
            : 'complete';

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold tracking-tight text-foreground lg:text-lg">
              Credibility Intelligence Agent
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="hidden sm:inline">Live</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Integration pills — hidden on mobile, visible on lg */}
            <div className="hidden items-center gap-1.5 lg:flex">
              <IntegrationPill
                name="Apify"
                connected={integrations.apify}
                lastStatus={getLastActionStatus('crm_inbox')}
              />
              <IntegrationPill name="Groq" connected={integrations.groq} />
              <IntegrationPill
                name="CRM"
                connected={integrations.crm}
                lastStatus={getLastActionStatus('crm_inbox')}
              />
              <IntegrationPill
                name="Intercom"
                connected={integrations.intercom}
                lastStatus={getLastActionStatus('intercom_alert')}
              />
              <IntegrationPill
                name="Redpanda"
                connected={integrations.redpanda}
                lastStatus={getLastActionStatus('redpanda_event')}
              />
              <IntegrationPill name="Sentry" connected={integrations.sentry} />
            </div>
            <span className="hidden text-sm font-medium text-muted-foreground lg:ml-2 lg:inline">
              Boxford Partners
            </span>
            {/* Mobile log toggle */}
            <button
              onClick={() => setShowMobileLog(!showMobileLog)}
              className="focus-ring rounded-md p-2 text-muted-foreground hover:text-foreground lg:hidden"
              aria-label="Toggle agent log"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Toast notification */}
      {toast && (
        <div className="fixed right-4 top-16 z-50 animate-slide-in">
          <div
            role="alert"
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-xl ${
              toast.type === 'intercom'
                ? 'border-blue-500/30 bg-blue-950 text-blue-100'
                : toast.type === 'error'
                  ? 'border-red-500/30 bg-red-950 text-red-100'
                  : 'border-border bg-card text-foreground'
            }`}
          >
            {toast.type === 'intercom' && (
              <svg
                className="h-5 w-5 shrink-0 text-blue-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 20.2A1.5 1.5 0 003.8 21.454l3.032-.892A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-3 8a1 1 0 110-2 1 1 0 010 2zm3 0a1 1 0 110-2 1 1 0 010 2zm3 0a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg
                className="h-5 w-5 shrink-0 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            )}
            <div>
              <p className="text-sm font-medium">{toast.message}</p>
              {toast.type === 'intercom' && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Check Intercom inbox for details
                </p>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <main className="flex flex-col lg:flex-row lg:h-[calc(100vh-57px)]">
        {/* Left Panel — Score + Controls */}
        <aside className="shrink-0 border-b border-border p-5 lg:w-72 lg:border-b-0 lg:border-r lg:overflow-y-auto">
          <div className="flex items-start gap-6 lg:flex-col lg:gap-5">
            {/* Score gauge */}
            <div className="text-center lg:w-full">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Credibility Score
              </p>
              <ScoreGauge score={score.current} />
              {delta !== 0 && (
                <p
                  className={`mt-1 text-sm font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {delta > 0 ? '\u2191' : '\u2193'} {Math.abs(delta)} pts
                </p>
              )}
              <Sparkline history={score.history} />
            </div>

            {/* Controls + Stats */}
            <div className="flex flex-1 flex-col gap-3 lg:w-full">
              {/* Scan Button */}
              <button
                onClick={triggerScan}
                disabled={scanning}
                className={`focus-ring w-full rounded-lg py-3 px-4 text-sm font-medium transition-all ${
                  scanning
                    ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                    : 'bg-primary text-primary-foreground shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-[0.98]'
                }`}
              >
                {scanning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground" />
                    Scanning...
                  </span>
                ) : (
                  'Scan Now'
                )}
              </button>

              {/* Scan error */}
              {scanError && (
                <p className="text-xs text-red-400 animate-fade-in">
                  {scanError}
                </p>
              )}

              {/* Reset */}
              <button
                onClick={resetAgent}
                className="focus-ring w-full rounded-lg border border-border py-2 px-4 text-xs font-medium text-muted-foreground transition-all hover:border-muted-foreground/30 hover:text-foreground"
              >
                Reset Demo
              </button>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-card p-2.5">
                  <p className="text-[10px] text-muted-foreground">Events</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {events.length}
                  </p>
                </div>
                <div className="rounded-md bg-card p-2.5">
                  <p className="text-[10px] text-muted-foreground">Actions</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {events.reduce(
                      (sum, e) => sum + e.actionsTaken.length,
                      0
                    )}
                  </p>
                </div>
                <div className="rounded-md bg-card p-2.5">
                  <p className="text-[10px] text-muted-foreground">Feedback</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {events.filter((e) => e.humanFeedback).length}
                  </p>
                </div>
                <div className="rounded-md bg-card p-2.5">
                  <p className="text-[10px] text-muted-foreground">Learning</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-400">
                    {events.filter((e) => e.humanFeedback).length > 0
                      ? 'Active'
                      : 'Idle'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Powered by — hidden on mobile */}
          <div className="mt-5 hidden border-t border-border/50 pt-4 lg:block">
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground/40">
              Powered by Apify &middot; Groq &middot; Intercom &middot; Sentry
              &middot; Redpanda
            </p>
          </div>
        </aside>

        {/* Center — Pipeline + Event Feed */}
        <section className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-5">
          {/* Pipeline Diagram — hidden on small screens */}
          <div className="hidden md:block">
            <PipelineDiagram
              activeStage={activeStage}
              integrations={integrations}
            />
          </div>

          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Event Feed
          </h2>

          {initialLoad ? (
            /* Loading skeleton */
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton-shimmer h-28 rounded-lg"
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <svg
                  className="h-8 w-8 text-muted-foreground/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground/60">
                No events detected yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/50">
                Click &quot;Scan Now&quot; to begin monitoring
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isExpanded={expandedEvent === event.id}
                  onToggle={() =>
                    setExpandedEvent(
                      expandedEvent === event.id ? null : event.id
                    )
                  }
                  onFeedback={submitFeedback}
                />
              ))}
            </div>
          )}
        </section>

        {/* Right Panel — Agent Log (desktop) */}
        <aside className="hidden shrink-0 border-l border-border p-5 lg:flex lg:w-80 lg:flex-col">
          <AgentLog logs={logs} />
        </aside>

        {/* Mobile Agent Log Drawer */}
        {showMobileLog && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowMobileLog(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 max-h-[60vh] rounded-t-2xl border-t border-border bg-card p-5 animate-slide-in">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Agent Log
                </p>
                <button
                  onClick={() => setShowMobileLog(false)}
                  className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Close agent log"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 80px)' }}>
                <AgentLog logs={logs} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
