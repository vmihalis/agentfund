/**
 * VoiceCommandRouter -- maps voice/text intents to agent actions.
 *
 * Stub implementation for TDD RED phase.
 *
 * @module voice/voice-command-router
 */

import type { VoiceCommand, VoiceResult } from './voice-types.js';
import type { GovernanceAgent } from '../agents/governance-agent.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from '../agents/types.js';

export interface VoiceRouterDeps {
  governance: GovernanceAgent;
  scout: IScoutAgent;
  analyzer: IAnalyzerAgent;
  treasury: ITreasuryAgent;
}

export class VoiceCommandRouter {
  constructor(_deps: VoiceRouterDeps) {}

  async execute(_command: VoiceCommand): Promise<VoiceResult> {
    throw new Error('Not implemented');
  }
}
