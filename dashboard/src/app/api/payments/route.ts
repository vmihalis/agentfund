/**
 * GET /api/payments
 *
 * Returns live x402 payment history from the voice server.
 * Returns empty array when voice server is unavailable.
 */

import { NextResponse } from 'next/server';

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function GET() {
  try {
    const res = await fetch(`${VOICE_SERVER_URL}/api/payments`, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json([]);
    const livePayments = await res.json();
    return NextResponse.json(livePayments);
  } catch {
    // Voice server unavailable -- no payments to show
    return NextResponse.json([]);
  }
}
