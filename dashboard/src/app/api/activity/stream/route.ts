/**
 * SSE proxy for activity stream — proxies to voice server SSE endpoint.
 *
 * GET /api/activity/stream
 * Returns a Server-Sent Events stream of activity entries.
 */

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

export async function GET() {
  try {
    const upstream = await fetch(`${VOICE_SERVER_URL}/api/activity/stream`, {
      cache: 'no-store',
      headers: { Accept: 'text/event-stream' },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response('SSE upstream unavailable', { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return new Response('SSE upstream unavailable', { status: 502 });
  }
}
