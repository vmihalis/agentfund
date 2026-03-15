/**
 * GET /api/treasury
 *
 * Fetches treasury balance directly from the backend.
 * Falls back to demo data when the server is not running.
 */

import { NextResponse } from 'next/server';
import { TREASURY_FALLBACK } from '@/lib/treasury';

export async function GET() {
  try {
    const port = process.env.VOICE_SERVER_PORT || '4003';
    const response = await fetch(`http://localhost:${port}/api/treasury/balance`);

    if (!response.ok) {
      return NextResponse.json(TREASURY_FALLBACK);
    }

    const balance = await response.json();
    return NextResponse.json(balance);
  } catch {
    return NextResponse.json(TREASURY_FALLBACK);
  }
}
