/**
 * GET /api/payments
 *
 * Returns x402 payment history data.
 * Proxies to voice server /api/payments for live data and merges
 * with demo data. Falls back to demo-only when voice server is unavailable.
 */

import { NextResponse } from 'next/server';
import { getDemoPayments } from '@/lib/payments';

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function GET() {
  const demoPayments = getDemoPayments();
  try {
    const res = await fetch(`${VOICE_SERVER_URL}/api/payments`, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json(demoPayments);
    const livePayments = await res.json();
    return NextResponse.json([...demoPayments, ...livePayments]);
  } catch {
    // Voice server unavailable -- return demo data as fallback
    return NextResponse.json(demoPayments);
  }
}
