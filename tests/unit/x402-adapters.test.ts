/**
 * Tests for x402 Scout and Analyzer HTTP adapters.
 *
 * Verifies that:
 * - X402ScoutAdapter.discoverProposals calls paidFetch with correct URL and returns proposals
 * - X402ScoutAdapter URL-encodes query parameters
 * - X402ScoutAdapter throws on non-ok HTTP responses
 * - X402AnalyzerAdapter.evaluateProposal calls paidFetch with correct body and returns evaluation
 * - X402AnalyzerAdapter sends proposal in request body
 * - X402AnalyzerAdapter throws on non-ok HTTP responses
 *
 * All HTTP interactions are mocked via vi.fn() paidFetch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { X402ScoutAdapter } from '../../src/agents/adapters/x402-scout-adapter.js';
import { X402AnalyzerAdapter } from '../../src/agents/adapters/x402-analyzer-adapter.js';
import type { Proposal, Evaluation } from '../../src/types/proposals.js';

// --- Helpers ---

function makeOkResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeErrorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const mockProposals: Proposal[] = [
  {
    id: 'prop-1',
    title: 'Solana SDK Enhancement',
    description: 'Improve the Solana TypeScript SDK',
    requestedAmount: 50000,
    teamInfo: 'Experienced Solana developers',
    sourceUrl: 'https://grants.example.com/1',
  },
  {
    id: 'prop-2',
    title: 'DeFi Analytics Dashboard',
    description: 'Build analytics for Solana DeFi protocols',
    requestedAmount: 30000,
    teamInfo: 'Data science team',
  },
];

const mockEvaluation: Evaluation = {
  proposalId: 'prop-1',
  proposalTitle: 'Solana SDK Enhancement',
  scores: {
    teamQuality: 8,
    technicalFeasibility: 7,
    impactPotential: 9,
    budgetReasonableness: 7,
  },
  overallScore: 7.75,
  reasoning: 'Strong team with clear technical direction',
  recommendation: 'fund',
};

// --- X402ScoutAdapter Tests ---

describe('X402ScoutAdapter', () => {
  let mockPaidFetch: ReturnType<typeof vi.fn>;
  let adapter: X402ScoutAdapter;

  beforeEach(() => {
    mockPaidFetch = vi.fn();
    adapter = new X402ScoutAdapter('http://localhost:4001', mockPaidFetch);
  });

  it('returns proposals from mock response', async () => {
    mockPaidFetch.mockResolvedValue(
      makeOkResponse({ proposals: mockProposals }),
    );

    const result = await adapter.discoverProposals('solana grants');

    expect(result).toEqual(mockProposals);
    expect(result).toHaveLength(2);
  });

  it('URL-encodes query parameter', async () => {
    mockPaidFetch.mockResolvedValue(
      makeOkResponse({ proposals: [] }),
    );

    await adapter.discoverProposals('solana grants & DeFi');

    const calledUrl = mockPaidFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe(
      'http://localhost:4001/discover?q=solana%20grants%20%26%20DeFi',
    );
  });

  it('calls GET on the /discover endpoint', async () => {
    mockPaidFetch.mockResolvedValue(
      makeOkResponse({ proposals: [] }),
    );

    await adapter.discoverProposals('test');

    expect(mockPaidFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockPaidFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/discover?q=');
  });

  it('throws on 500 response', async () => {
    mockPaidFetch.mockResolvedValue(
      makeErrorResponse(500, 'Internal server error'),
    );

    await expect(adapter.discoverProposals('test'))
      .rejects.toThrow('Scout request failed with status 500');
  });

  it('throws on 404 response', async () => {
    mockPaidFetch.mockResolvedValue(
      makeErrorResponse(404, 'Not found'),
    );

    await expect(adapter.discoverProposals('test'))
      .rejects.toThrow('Scout request failed with status 404');
  });
});

// --- X402AnalyzerAdapter Tests ---

describe('X402AnalyzerAdapter', () => {
  let mockPaidFetch: ReturnType<typeof vi.fn>;
  let adapter: X402AnalyzerAdapter;

  beforeEach(() => {
    mockPaidFetch = vi.fn();
    adapter = new X402AnalyzerAdapter('http://localhost:4002', mockPaidFetch);
  });

  it('returns evaluation from mock response', async () => {
    mockPaidFetch.mockResolvedValue(
      makeOkResponse({ evaluation: mockEvaluation }),
    );

    const result = await adapter.evaluateProposal(mockProposals[0]);

    expect(result).toEqual(mockEvaluation);
    expect(result.recommendation).toBe('fund');
  });

  it('sends proposal in request body as JSON', async () => {
    mockPaidFetch.mockResolvedValue(
      makeOkResponse({ evaluation: mockEvaluation }),
    );

    await adapter.evaluateProposal(mockProposals[0]);

    expect(mockPaidFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockPaidFetch.mock.calls[0];
    expect(url).toBe('http://localhost:4002/evaluate');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.proposal).toEqual(mockProposals[0]);
  });

  it('throws on 500 response', async () => {
    mockPaidFetch.mockResolvedValue(
      makeErrorResponse(500, 'Internal server error'),
    );

    await expect(adapter.evaluateProposal(mockProposals[0]))
      .rejects.toThrow('Analyzer request failed with status 500');
  });

  it('throws on 400 response', async () => {
    mockPaidFetch.mockResolvedValue(
      makeErrorResponse(400, 'Bad request'),
    );

    await expect(adapter.evaluateProposal(mockProposals[0]))
      .rejects.toThrow('Analyzer request failed with status 400');
  });
});
