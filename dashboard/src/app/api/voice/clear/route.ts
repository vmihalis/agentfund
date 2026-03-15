/**
 * POST /api/voice/clear
 *
 * Proxies to voice server to clear conversation history.
 * Forwards auth header for per-user session isolation.
 */

import { NextResponse } from 'next/server';

const VOICE_SERVER_PORT = process.env.VOICE_SERVER_PORT || '4003';

export async function POST(request: Request) {
  try {
    const headers: Record<string, string> = {};
    const authHeader = request.headers.get('authorization');
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch(
      `http://localhost:${VOICE_SERVER_PORT}/api/voice/clear`,
      { method: 'POST', headers },
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Voice server error' }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Voice server unavailable' }, { status: 503 });
  }
}
