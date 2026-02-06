// In-memory store for hackathon demo
// Uses globalThis to persist across Next.js dev mode hot reloads

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

interface Store {
  events: CredibilityEvent[];
  currentScore: number;
  scoreHistory: Array<{ score: number; timestamp: string }>;
  agentLog: LogEntry[];
  feedbackLog: FeedbackEntry[];
  scanCount: number;
}

// Persist store on globalThis so it survives Next.js hot reloads
const g = globalThis as unknown as { __store?: Store };

if (!g.__store) {
  g.__store = {
    events: [],
    currentScore: 87,
    scoreHistory: [
      { score: 92, timestamp: new Date(Date.now() - 7200000).toISOString() },
      { score: 90, timestamp: new Date(Date.now() - 3600000).toISOString() },
      { score: 87, timestamp: new Date().toISOString() },
    ],
    agentLog: [],
    feedbackLog: [],
    scanCount: 0,
  };
}

const store = g.__store;

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
  store.events.unshift(event);
  return event;
}

export function updateEvent(id: string, updates: Partial<CredibilityEvent>) {
  const idx = store.events.findIndex((e) => e.id === id);
  if (idx !== -1) {
    store.events[idx] = { ...store.events[idx], ...updates };
  }
  return store.events[idx];
}

export function getEvents() {
  return store.events;
}

export function getEvent(id: string) {
  return store.events.find((e) => e.id === id);
}

// --- Score ---
export function getScore() {
  return { current: store.currentScore, history: store.scoreHistory };
}

export function updateScore(delta: number) {
  store.currentScore = Math.max(0, Math.min(100, store.currentScore + delta));
  store.scoreHistory.push({
    score: store.currentScore,
    timestamp: new Date().toISOString(),
  });
}

// --- Logs ---
export function log(message: string, type: string = 'info') {
  store.agentLog.unshift({
    message,
    timestamp: new Date().toISOString(),
    type,
  });
}

export function getLogs() {
  return store.agentLog;
}

// --- Feedback / Learning ---
export function addFeedback(
  eventId: string,
  feedback: string,
  original: string,
  modified?: string
) {
  store.feedbackLog.push({ eventId, feedback, original, modified });
}

export function getFeedbackHistory() {
  return store.feedbackLog;
}

// --- Scan Counter (for seed data rotation) ---
export function nextScanIndex() {
  return store.scanCount++;
}

// --- Reset (for clean demo starts) ---
export function resetStore() {
  store.events = [];
  store.currentScore = 87;
  store.scoreHistory = [
    { score: 92, timestamp: new Date(Date.now() - 7200000).toISOString() },
    { score: 90, timestamp: new Date(Date.now() - 3600000).toISOString() },
    { score: 87, timestamp: new Date().toISOString() },
  ];
  store.agentLog = [];
  store.feedbackLog = [];
  store.scanCount = 0;
}
