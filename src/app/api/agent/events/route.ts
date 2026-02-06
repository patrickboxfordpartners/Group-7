import { NextResponse } from 'next/server';
import { getEvents, getLogs, getScore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    events: getEvents(),
    logs: getLogs(),
    score: getScore(),
    integrations: {
      apify: !!process.env.APIFY_API_TOKEN || !!process.env.APIFY_DATASET_ID,
      groq: !!process.env.GROQ_API_KEY,
      crm: !!process.env.CRM_BASE_URL,
      intercom: !!process.env.INTERCOM_ACCESS_TOKEN,
      redpanda: !!process.env.REDPANDA_BROKERS,
      sentry: !!process.env.SENTRY_DSN,
    },
  });
}
