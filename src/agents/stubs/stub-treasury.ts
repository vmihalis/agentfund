/**
 * Stub Treasury Agent returning mock transaction results.
 *
 * Implements ITreasuryAgent with hardcoded balance and simulated
 * funding transactions for pipeline testing in Phase 2.
 * Replaced by real TreasuryAgent in Phase 5.
 */

import { randomBytes } from 'crypto';
import { BaseAgent } from '../base-agent.js';
import type { ITreasuryAgent } from '../types.js';
import type { FundingAllocation, TransactionResult, TreasuryBalance } from '../../types/proposals.js';
import type { AgentEventBus } from '../../events/event-types.js';

export class StubTreasuryAgent extends BaseAgent implements ITreasuryAgent {
  constructor(bus: AgentEventBus) {
    super('treasury', bus);
  }

  async initialize(): Promise<void> {
    this.emitStatus('initialized', 'StubTreasuryAgent ready');
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'StubTreasuryAgent stopped');
  }

  async executeFunding(allocation: FundingAllocation): Promise<TransactionResult> {
    this.emitStatus('funding', `Executing: ${allocation.proposalTitle}`);

    const txHash = randomBytes(16).toString('hex');
    return {
      success: true,
      signature: `stub-tx-${txHash}`,
    };
  }

  async getBalance(): Promise<TreasuryBalance> {
    return {
      solBalance: 10,
      usdcBalance: 50000,
      totalValueUsd: 51500,
    };
  }
}
