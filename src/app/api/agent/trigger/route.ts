import { NextResponse } from 'next/server';
import { runAgentCycle } from '@/lib/agent/orchestrator';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const businessId = body.businessId || 'demo-business';
    const businessName =
      body.businessName ||
      process.env.DEFAULT_BUSINESS_NAME ||
      'Demo Real Estate Group';
    const placeId = body.placeId || process.env.DEFAULT_PLACE_ID || '';

    // Await the full pipeline — required on serverless (Vercel)
    // so the function stays alive until all actions complete
    await runAgentCycle(businessId, businessName, placeId);

    return NextResponse.json({ triggered: true, businessName });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
