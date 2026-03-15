/**
 * GET /api/voice/signed-url
 *
 * Proxies signed URL requests to the voice server which in turn
 * calls the ElevenLabs convai API. Returns { signedUrl: string }.
 */

import { NextResponse } from 'next/server';

const VOICE_SERVER_PORT = process.env.VOICE_SERVER_PORT || '4003';

export async function GET() {
  try {
    const res = await fetch(
      `http://localhost:${VOICE_SERVER_PORT}/api/voice/signed-url`,
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Voice server error: ${res.status} ${text}` },
        { status: 503 },
      );
    }

    const data = (await res.json()) as { signedUrl?: string };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Voice server unavailable' },
      { status: 503 },
    );
  }
}
