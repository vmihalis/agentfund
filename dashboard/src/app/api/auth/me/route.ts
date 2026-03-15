import { NextResponse } from 'next/server';

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const res = await fetch(`${VOICE_SERVER_URL}/api/auth/me`, {
      headers: { Authorization: authHeader },
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Server unavailable' }, { status: 502 });
  }
}
