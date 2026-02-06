// In-memory store for hackathon demo
// Swap for Supabase/Neon in production

export interface CredibilityEvent {
  id: string;
  businessId: string;
  businessName: string;
  eventType: string;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rawData: Record<string, unknown>;
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

interface FeedbackEntry {
  eventId: string;
  feedback: string;
  original: string;
  modified?: string;
}

// --- State ---
let events: CredibilityEvent[] = [];
let currentScore = 87;
let scoreHistory: Array<{ score: number; timestamp: string }> = [
  { score: 92, timestamp: new Date(Date.now() - 7200000).toISOString() },
  { score: 90, timestamp: new Date(Date.now() - 3600000).toISOString() },
  { score: 87, timestamp: new Date().toISOString() },
];
let agentLog: LogEntry[] = [];
let feedbackLog: FeedbackEntry[] = [];
let scanCount = 0;

// --- Events ---
export function addEvent(
  data: Omit<CredibilityEvent, 'id' | 'detectedAt' | 'actionsTaken' | 'status'>
): CredibilityEvent {
  const event: CredibilityEvent = {
    ...data,
    id: crypto.randomUUID(),
    detectedAt: new Date().toISOString(),
    actionsTaken: [],
    status: 'detected',
  };
  events.unshift(event);
  return event;
}

export function updateEvent(id: string, updates: Partial<CredibilityEvent>) {
  const idx = events.findIndex((e) => e.id === id);
  if (idx !== -1) {
    events[idx] = { ...events[idx], ...updates };
  }
  return events[idx];
}

export function getEvents() {
  return events;
}

export function getEvent(id: string) {
  return events.find((e) => e.id === id);
}

// --- Score ---
export function getScore() {
  return { current: currentScore, history: scoreHistory };
}

export function updateScore(delta: number) {
  currentScore = Math.max(0, Math.min(100, currentScore + delta));
  scoreHistory.push({
    score: currentScore,
    timestamp: new Date().toISOString(),
  });
}

// --- Logs ---
export function log(message: string, type: string = 'info') {
  agentLog.unshift({
    message,
    timestamp: new Date().toISOString(),
    type,
  });
}

export function getLogs() {
  return agentLog;
}

// --- Feedback / Learning ---
export function addFeedback(
  eventId: string,
  feedback: string,
  original: string,
  modified?: string
) {
  feedbackLog.push({ eventId, feedback, original, modified });
}

export function getFeedbackHistory() {
  return feedbackLog;
}

// --- Scan Counter (for seed data rotation) ---
export function nextScanIndex() {
  return scanCount++;
}
