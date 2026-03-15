/**
 * x402 Analyzer Adapter - HTTP adapter for Analyzer agent with x402 payment.
 *
 * Implements IAnalyzerAgent by calling the Analyzer HTTP server's /evaluate
 * endpoint through an x402-wrapped fetch function. GovernanceAgent can
 * use this adapter as a drop-in replacement for the in-process AnalyzerAgent.
 */

import type { IAnalyzerAgent } from '../types.js';
import type { Proposal, Evaluation } from '../../types/proposals.js';

export class X402AnalyzerAdapter implements IAnalyzerAgent {
  /** Last x402 payment transaction signature from the most recent evaluateProposal call. */
  public lastTxSignature: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly paidFetch: typeof fetch,
  ) {}

  async evaluateProposal(proposal: Proposal): Promise<Evaluation> {
    const response = await this.paidFetch(`${this.baseUrl}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal }),
    });

    if (!response.ok) {
      throw new Error(`Analyzer request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { evaluation: Evaluation; txSignature?: string };
    this.lastTxSignature = body.txSignature ?? null;
    return body.evaluation;
  }
}
