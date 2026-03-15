/**
 * /api/proposals
 *
 * GET  - Fetches live proposal state from voice server, merges into store
 *        via updateProposalStage, and returns combined proposals.
 *        Falls back to store-only data when voice server is unavailable.
 * POST - Accepts { text: string }, proxies to voice command to trigger
 *        pipeline actions, and returns the voice result.
 */

import { NextResponse } from 'next/server';
import { addProposal, getProposals, updateProposalStage } from '@/lib/proposals-store';
import type { PipelineStage } from '@/lib/types';

const VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'http://localhost:4003';

/** Return all proposals in the pipeline, merged with live voice server state. */
export async function GET() {
  // Fetch live proposal state from voice server and merge into store
  try {
    const res = await fetch(`${VOICE_SERVER_URL}/api/proposals/live`, { cache: 'no-store' });
    if (res.ok) {
      const liveProposals: Array<{
        id: string;
        title: string;
        stage: string;
        updatedAt: number;
        evaluation?: { overallScore: number; recommendation: string; reasoning: string };
      }> = await res.json();
      for (const lp of liveProposals) {
        // Add new live proposals to store if not already present
        const existing = getProposals().find((p) => p.id === lp.id);
        if (!existing) {
          addProposal({
            id: lp.id,
            title: lp.title,
            stage: lp.stage as PipelineStage,
            updatedAt: lp.updatedAt,
            evaluation: lp.evaluation,
          });
        } else {
          // Update existing proposal stage from live data
          updateProposalStage(
            lp.id,
            lp.stage as PipelineStage,
            lp.evaluation,
          );
        }
      }
    }
  } catch {
    // Voice server unavailable -- return store data as-is (graceful degradation)
  }

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
      `${VOICE_SERVER_URL}/api/voice/command`,
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
