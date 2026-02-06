import { NextResponse } from 'next/server';
import { getEvents, getLogs, getScore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    events: getEvents(),
    logs: getLogs(),
    score: getScore(),
  });
}
