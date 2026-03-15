/**
 * Memory stats API route -- proxies to voice server (auth required).
 */

import { NextResponse } from 'next/server';

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function GET(request: Request) {
  try {
    const headers: Record<string, string> = {};
    const authHeader = request.headers.get('authorization');
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch(`${VOICE_SERVER_URL}/api/memory/stats`, {
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      return NextResponse.json({ totalEvaluations: 0, totalDecisions: 0, avgScore: 0 });
    }

    const stats = await res.json();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ totalEvaluations: 0, totalDecisions: 0, avgScore: 0 });
  }
}
