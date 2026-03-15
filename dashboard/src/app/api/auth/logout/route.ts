import { NextResponse } from 'next/server';

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const res = await fetch(`${VOICE_SERVER_URL}/api/auth/logout`, {
      method: 'POST',
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true });
  }
}
