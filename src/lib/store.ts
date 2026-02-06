// In-memory store for hackathon demo
// Uses globalThis + /tmp file sync for serverless environments (Vercel)

import { readFileSync, writeFileSync } from 'fs';

const STORE_PATH = '/tmp/credibility-store.json';

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

function freshStore(): Store {
  return {
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

// Try to load from /tmp (survives across serverless invocations on warm instances)
function loadStore(): Store {
  try {
    const data = readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(data) as Store;
  } catch {
    return freshStore();
  }
}

function persistStore() {
  try {
    writeFileSync(STORE_PATH, JSON.stringify(store));
  } catch {
    // /tmp write may fail in some environments; no-op
  }
}

// Persist store on globalThis so it survives Next.js hot reloads
const g = globalThis as unknown as { __store?: Store };

if (!g.__store) {
  g.__store = loadStore();
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
  persistStore();
  return event;
}

export function updateEvent(id: string, updates: Partial<CredibilityEvent>) {
  const idx = store.events.findIndex((e) => e.id === id);
  if (idx !== -1) {
    store.events[idx] = { ...store.events[idx], ...updates };
  }
  persistStore();
  return store.events[idx];
}

export function getEvents() {
  // Re-read from /tmp in case another instance updated it
  try {
    const data = readFileSync(STORE_PATH, 'utf-8');
    const loaded = JSON.parse(data) as Store;
    store.events = loaded.events;
    store.currentScore = loaded.currentScore;
    store.scoreHistory = loaded.scoreHistory;
    store.agentLog = loaded.agentLog;
    store.feedbackLog = loaded.feedbackLog;
    store.scanCount = loaded.scanCount;
  } catch {
    // Use in-memory if /tmp read fails
  }
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
  persistStore();
}

// --- Logs ---
export function log(message: string, type: string = 'info') {
  store.agentLog.unshift({
    message,
    timestamp: new Date().toISOString(),
    type,
  });
  persistStore();
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
  persistStore();
}

export function getFeedbackHistory() {
  return store.feedbackLog;
}

// --- Scan Counter (for seed data rotation) ---
export function nextScanIndex() {
  const idx = store.scanCount++;
  persistStore();
  return idx;
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
  persistStore();
}
