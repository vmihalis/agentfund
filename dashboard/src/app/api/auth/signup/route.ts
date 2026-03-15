import { NextResponse } from 'next/server';

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${VOICE_SERVER_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Server unavailable' }, { status: 502 });
  }
}
