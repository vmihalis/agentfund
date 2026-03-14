/**
 * Stub Scout Agent returning mock proposals.
 *
 * Implements IScoutAgent with hardcoded realistic proposals
 * for pipeline testing in Phase 2. Replaced by real ScoutAgent in Phase 3.
 * STUB_PROPOSALS is exported separately so the real ScoutAgent can use it
 * as the final fallback layer.
 */

import { BaseAgent } from '../base-agent.js';
import type { IScoutAgent } from '../types.js';
import type { Proposal } from '../../types/proposals.js';
import type { AgentEventBus } from '../../events/event-types.js';

/** Hardcoded fallback proposals used when Unbrowse is unavailable and cache is empty. */
export const STUB_PROPOSALS: Proposal[] = [
  {
    id: 'prop-001',
    title: 'Solana DeFi Analytics Dashboard',
    description:
      'Build a real-time analytics dashboard for Solana DeFi protocols, providing TVL tracking, yield comparisons, and risk metrics across major DEXs and lending platforms.',
    requestedAmount: 5000,
    teamInfo: '3 developers with 2 years Solana experience',
  },
  {
    id: 'prop-002',
    title: 'Cross-chain Bridge Monitor',
    description:
      'Monitor and alert on cross-chain bridge transactions for security. Tracks Wormhole, deBridge, and Allbridge activity with anomaly detection.',
    requestedAmount: 8000,
    teamInfo: '5 developers, previously built Wormhole tooling',
  },
  {
    id: 'prop-003',
    title: 'Solana Mobile Wallet SDK',
    description:
      'Open-source mobile wallet SDK for building Solana dApps on iOS and Android with biometric auth and Saga phone integration.',
    requestedAmount: 12000,
    teamInfo: '4 mobile developers, 1 Solana core contributor',
  },
];

export class StubScoutAgent extends BaseAgent implements IScoutAgent {
  constructor(bus: AgentEventBus) {
    super('scout', bus);
  }

  async initialize(): Promise<void> {
    this.emitStatus('initialized', 'StubScoutAgent ready');
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'StubScoutAgent stopped');
  }

  async discoverProposals(_query: string): Promise<Proposal[]> {
    this.emitStatus('discovering', `Searching for proposals`);
    return [...STUB_PROPOSALS];
  }
}
