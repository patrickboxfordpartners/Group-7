import { NextResponse } from 'next/server';
import { resetStore, log } from '@/lib/store';

export async function POST() {
  resetStore();
  log('Agent reset — ready for new demo cycle', 'info');
  return NextResponse.json({ reset: true });
}
