'use client';

import { useState } from 'react';

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

const severityStyles: Record<string, { border: string; dot: string }> = {
  low: { border: 'border-blue-500/20 bg-blue-500/[0.03]', dot: 'bg-blue-400' },
  medium: {
    border: 'border-amber-500/20 bg-amber-500/[0.03]',
    dot: 'bg-amber-400',
  },
  high: {
    border: 'border-orange-500/20 bg-orange-500/[0.03]',
    dot: 'bg-orange-400',
  },
  critical: {
    border: 'border-red-500/20 bg-red-500/[0.03]',
    dot: 'bg-red-400',
  },
};

const statusLabels: Record<string, string> = {
  detected: 'Detected',
  analyzing: 'Analyzing',
  acting: 'Acting',
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

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? 'text-amber-400' : 'text-secondary'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export function EventCard({
  event,
  isExpanded,
  onToggle,
  onFeedback,
}: {
  event: CredibilityEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onFeedback: (
    eventId: string,
    feedback: 'accepted' | 'rejected',
    modifiedResponse?: string
  ) => void;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectText, setRejectText] = useState('');
  const styles = severityStyles[event.severity] || severityStyles.low;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      className={`focus-ring cursor-pointer rounded-lg border p-4 transition-all duration-200 hover:border-muted-foreground/30 animate-slide-in ${styles.border}`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative shrink-0">
            <span className={`block h-2.5 w-2.5 rounded-full ${styles.dot}`} />
            {event.severity === 'critical' && (
              <span
                className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${styles.dot} animate-ping`}
              />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Stars rating={event.rawData.rating} />
              <p className="truncate text-sm font-medium text-foreground">
                {event.rawData.author || 'Unknown'}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {event.source} &middot; {formatTime(event.detectedAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {event.classification && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                event.classification.sentiment === 'negative'
                  ? 'bg-red-500/15 text-red-300'
                  : event.classification.sentiment === 'positive'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              {event.classification.credibilityImpact > 0 ? '+' : ''}
              {event.classification.credibilityImpact} pts
            </span>
          )}
          <span
            className={`text-xs font-medium ${
              event.status === 'complete'
                ? 'text-emerald-400'
                : event.status === 'error'
                  ? 'text-red-400'
                  : 'text-amber-400 animate-pulse'
            }`}
          >
            {statusLabels[event.status] || event.status}
          </span>
          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Review preview */}
      <p className="ml-[1.375rem] mt-2 text-sm leading-relaxed text-muted-foreground">
        &ldquo;{event.rawData.text?.substring(0, 150)}
        {(event.rawData.text?.length || 0) > 150 ? '...' : ''}
        &rdquo;
      </p>

      {/* Expanded details */}
      {isExpanded && event.status === 'complete' && (
        <div className="event-details-enter ml-[1.375rem] mt-4 space-y-3">
          {/* Themes */}
          {event.classification && event.classification.themes.length > 0 && (
            <div className="rounded-md bg-secondary/60 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Detected Themes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {event.classification.themes.map((theme, i) => (
                  <span
                    key={i}
                    className="rounded-sm bg-background px-2 py-0.5 text-xs text-foreground/70"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Drafted Response */}
          {event.responseDrafted && (
            <div className="rounded-md bg-secondary/60 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Drafted Response
              </p>
              <p className="text-sm leading-relaxed text-foreground/80">
                {event.responseDrafted}
              </p>

              {!event.humanFeedback ? (
                rejectMode ? (
                  <div
                    className="mt-3 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs text-muted-foreground">
                      Write your preferred response:
                    </p>
                    <textarea
                      value={rejectText}
                      onChange={(e) => setRejectText(e.target.value)}
                      placeholder="Type your response here..."
                      className="focus-ring w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onFeedback(
                            event.id,
                            'rejected',
                            rejectText || undefined
                          );
                          setRejectMode(false);
                          setRejectText('');
                        }}
                        className="focus-ring rounded-md bg-red-500/15 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/25"
                      >
                        {rejectText.trim()
                          ? 'Submit Correction'
                          : 'Reject Without Response'}
                      </button>
                      <button
                        onClick={() => {
                          setRejectMode(false);
                          setRejectText('');
                        }}
                        className="focus-ring px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFeedback(event.id, 'accepted');
                      }}
                      className="focus-ring rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
                    >
                      Accept
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRejectMode(true);
                        setRejectText(event.responseDrafted || '');
                      }}
                      className="focus-ring rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25"
                    >
                      {'Reject & Revise'}
                    </button>
                  </div>
                )
              ) : (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">
                    Feedback:{' '}
                    <span
                      className={
                        event.humanFeedback === 'accepted'
                          ? 'font-medium text-emerald-400'
                          : 'font-medium text-red-400'
                      }
                    >
                      {event.humanFeedback}
                    </span>{' '}
                    &mdash; Agent learning updated
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions Taken */}
          {event.actionsTaken.length > 0 && (
            <div className="rounded-md bg-secondary/60 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Actions Taken
              </p>
              <div className="space-y-1.5">
                {event.actionsTaken.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={
                        action.details.status === 'failed'
                          ? 'text-red-400'
                          : action.details.status === 'skipped'
                            ? 'text-muted-foreground'
                            : 'text-emerald-400'
                      }
                    >
                      {action.details.status === 'failed'
                        ? '\u2717'
                        : action.details.status === 'skipped'
                          ? '\u2013'
                          : '\u2713'}
                    </span>
                    <span className="text-foreground/80">
                      {actionLabels[action.type] || action.type}
                    </span>
                    <span className="text-muted-foreground/60">
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
}
