/**
 * x402 Scout Adapter - HTTP adapter for Scout agent with x402 payment.
 *
 * Implements IScoutAgent by calling the Scout HTTP server's /discover
 * endpoint through an x402-wrapped fetch function. GovernanceAgent can
 * use this adapter as a drop-in replacement for the in-process ScoutAgent.
 */

import type { IScoutAgent } from '../types.js';
import type { Proposal } from '../../types/proposals.js';

export class X402ScoutAdapter implements IScoutAgent {
  /** Last x402 payment transaction signature from the most recent discoverProposals call. */
  public lastTxSignature: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly paidFetch: typeof fetch,
  ) {}

  async discoverProposals(query: string): Promise<Proposal[]> {
    const url = `${this.baseUrl}/discover?q=${encodeURIComponent(query)}`;
    const response = await this.paidFetch(url);

    if (!response.ok) {
      throw new Error(`Scout request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { proposals: Proposal[]; txSignature?: string };
    this.lastTxSignature = body.txSignature ?? null;
    return body.proposals;
  }
}
