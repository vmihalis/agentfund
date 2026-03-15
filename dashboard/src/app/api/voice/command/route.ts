/**
 * POST /api/voice/command
 *
 * Accepts { text: string } and proxies to the Express voice server.
 * Forwards Authorization header for per-user session isolation.
 */

import { NextResponse } from 'next/server';

const VOICE_SERVER_PORT = process.env.VOICE_SERVER_PORT || '4003';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };

    if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
      return NextResponse.json(
        { error: 'Missing required field: text' },
        { status: 400 },
      );
    }

    // Forward auth header for per-user session isolation
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('authorization');
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch(
      `http://localhost:${VOICE_SERVER_PORT}/api/voice/command`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: body.text }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Voice server error: ${res.status} ${text}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Voice server unavailable' },
      { status: 503 },
    );
  }
}
