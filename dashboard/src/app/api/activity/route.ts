/**
 * Activity feed API route -- proxies to voice server at localhost:4003.
 *
 * GET /api/activity?since=<timestamp>
 * Returns ActivityEntry[] from the voice server's activity log.
 * Returns empty array on error for graceful degradation.
 */

import { NextResponse } from 'next/server';

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since') || '0';

    const res = await fetch(`${VOICE_SERVER_URL}/api/activity?since=${since}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const entries = await res.json();
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([]);
  }
}
