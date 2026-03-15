/**
 * GET /api/treasury
 *
 * Proxies treasury data from the voice server.
 * Falls back to demo data when voice server is not running.
 */

import { NextResponse } from 'next/server';
import { parseTreasuryResponse, TREASURY_FALLBACK } from '@/lib/treasury';

export async function GET() {
  try {
    const port = process.env.VOICE_SERVER_PORT || '4003';
    const response = await fetch(`http://localhost:${port}/api/voice/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'check treasury' }),
    });

    if (!response.ok) {
      return NextResponse.json(TREASURY_FALLBACK);
    }

    const voiceResult = await response.json();
    const treasury = parseTreasuryResponse(voiceResult);
    return NextResponse.json(treasury);
  } catch {
    // Voice server not running -- return demo fallback
    return NextResponse.json(TREASURY_FALLBACK);
  }
}
