/**
 * /api/proposals/submit
 *
 * POST - Accept a ProposalSubmission, validate required fields,
 *        create a PipelineProposal, and push it into the shared store
 *        so it appears in the pipeline visualization served by /api/proposals.
 */

import { NextResponse } from 'next/server';
import { addProposal } from '@/lib/proposals-store';
import type { ProposalSubmission, PipelineProposal } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ProposalSubmission>;

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 },
      );
    }
    if (!body.description || typeof body.description !== 'string' || body.description.trim() === '') {
      return NextResponse.json(
        { error: 'Missing required field: description' },
        { status: 400 },
      );
    }
    if (body.requestedAmount === undefined || typeof body.requestedAmount !== 'number' || body.requestedAmount < 1) {
      return NextResponse.json(
        { error: 'Missing or invalid field: requestedAmount (must be >= 1)' },
        { status: 400 },
      );
    }
    if (!body.teamInfo || typeof body.teamInfo !== 'string' || body.teamInfo.trim() === '') {
      return NextResponse.json(
        { error: 'Missing required field: teamInfo' },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const proposal: PipelineProposal = {
      id,
      title: body.title.trim(),
      stage: 'submitted',
      updatedAt: Date.now(),
    };

    addProposal(proposal);

    return NextResponse.json({ success: true, proposal });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
