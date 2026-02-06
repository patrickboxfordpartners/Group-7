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
  crm_inbox: 'Created inbox item in CRM',
  crm_task: 'Created task in CRM',
  intercom_alert: 'Sent Intercom notification',
  redpanda_event: 'Published to event stream',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function Dashboard() {
  const [events, setEvents] = useState<CredibilityEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [score, setScore] = useState({
    current: 87,
    history: [] as Array<{ score: number; timestamp: string }>,
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
    } catch {
      // Silently retry on next poll
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, [fetchData]);

  const triggerScan = async () => {
    setScanning(true);
    try {
      await fetch('/api/agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } finally {
      // Keep scanning state for a moment so user sees feedback
      setTimeout(() => setScanning(false), 1000);
    }
  };

  const resetAgent = async () => {
    await fetch('/api/agent/reset', { method: 'POST' });
    await fetchData();
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Credibility Intelligence Agent
          </h1>
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <span className="text-sm text-gray-500 font-medium">
          Boxford Partners
        </span>
      </header>

      <main className="flex h-[calc(100vh-65px)]">
        {/* Left Panel — Score + Controls */}
        <aside className="w-80 border-r border-gray-800 p-6 flex flex-col gap-6 shrink-0">
          {/* Credibility Score */}
          <div className="text-center py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Credibility Score
            </p>
            <p
              className={`text-7xl font-bold tabular-nums ${
                score.current >= 80
                  ? 'text-emerald-400'
                  : score.current >= 60
                    ? 'text-yellow-400'
                    : 'text-red-400'
              }`}
            >
              {score.current}
            </p>
            {delta !== 0 && (
              <p
                className={`text-sm font-medium mt-2 ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {delta > 0 ? '\u2191' : '\u2193'} {Math.abs(delta)} pts
              </p>
            )}
          </div>

          {/* Scan Button */}
          <button
            onClick={triggerScan}
            disabled={scanning}
            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              scanning
                ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-950 hover:bg-gray-200 active:scale-[0.98]'
            }`}
          >
            {scanning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500">Events</p>
              <p className="text-2xl font-bold tabular-nums">
                {events.length}
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500">Actions</p>
              <p className="text-2xl font-bold tabular-nums">
                {events.reduce((sum, e) => sum + e.actionsTaken.length, 0)}
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500">Feedback</p>
              <p className="text-2xl font-bold tabular-nums">
                {events.filter((e) => e.humanFeedback).length}
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500">Learning</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-400">
                {events.filter((e) => e.humanFeedback).length > 0
                  ? 'Active'
                  : 'Idle'}
              </p>
            </div>
          </div>

          {/* Agent Log */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Agent Log
            </p>
            <div className="flex-1 overflow-y-auto space-y-1.5 text-xs font-mono">
              {logs.slice(0, 30).map((entry, i) => (
                <div key={i} className="flex gap-2 leading-relaxed">
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
                <p className="text-gray-600 italic font-sans">
                  No activity yet. Click &quot;Scan Now&quot; to start.
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Main Area — Event Feed */}
        <section className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
            Event Feed
          </h2>

          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <svg
                className="w-12 h-12 mb-3 opacity-30"
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
              <p className="text-lg">No events detected yet</p>
              <p className="text-sm mt-1">
                Click &quot;Scan Now&quot; to begin monitoring
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const styles = severityStyles[event.severity] || severityStyles.low;
                const isExpanded = expandedEvent === event.id;

                return (
                  <div
                    key={event.id}
                    className={`border rounded-lg p-4 transition-all cursor-pointer hover:border-gray-600 ${styles.border}`}
                    onClick={() =>
                      setExpandedEvent(isExpanded ? null : event.id)
                    }
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${styles.dot}`}
                        />
                        <div>
                          <p className="font-medium text-sm">
                            {event.rawData.rating &&
                              `${event.rawData.rating}-star review`}{' '}
                            from {event.rawData.author || 'Unknown'}
                          </p>
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
      </main>
    </div>
  );
}
