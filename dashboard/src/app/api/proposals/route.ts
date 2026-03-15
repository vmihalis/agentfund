/**
 * /api/proposals
 *
 * GET  - Returns current pipeline proposals from the shared store.
 * POST - Accepts { text: string }, proxies to voice command to trigger
 *        pipeline actions, and returns the voice result.
 */

import { NextResponse } from 'next/server';
import { getProposals } from '@/lib/proposals-store';

const VOICE_SERVER_PORT = process.env.VOICE_SERVER_PORT || '4003';

/** Return all proposals in the pipeline. */
export async function GET() {
  const data = getProposals();
  return NextResponse.json(data);
}

/**
 * Trigger a pipeline action via voice command and return the result.
 * Accepts { text: string } body.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };

    if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
      return NextResponse.json(
        { error: 'Missing required field: text' },
        { status: 400 },
      );
    }

    const res = await fetch(
      `http://localhost:${VOICE_SERVER_PORT}/api/voice/command`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body.text }),
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Voice server unavailable' },
        { status: 503 },
      );
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Voice server unavailable' },
      { status: 503 },
    );
  }
}
