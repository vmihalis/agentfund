/**
 * ElevenLabs client tools mapping for the voice command interface.
 *
 * Maps the 4 ElevenLabs dashboard tool names to VoiceCommandRouter.execute calls.
 * Each tool function accepts the parameters as configured in the ElevenLabs dashboard
 * and returns a human-readable string message for the agent to speak back.
 *
 * Tool names are case-sensitive and must match the ElevenLabs dashboard configuration:
 * - findProposals
 * - analyzeProposal
 * - fundProject
 * - checkTreasury
 *
 * @module voice/voice-tools
 */

import type { VoiceCommandRouter } from './voice-command-router.js';

/**
 * Create the ElevenLabs client tools object wired to a VoiceCommandRouter.
 *
 * Each tool function calls router.execute with the matching VoiceIntent and
 * returns result.message (the human-readable string the ElevenLabs agent speaks).
 *
 * Also includes an onUnhandledClientToolCall handler that logs a warning for
 * debugging tool name mismatches between dashboard config and code.
 *
 * @param router - VoiceCommandRouter instance to route commands through
 * @returns Object with tool functions and onUnhandledClientToolCall callback
 */
export function createClientTools(router: VoiceCommandRouter) {
  const clientTools: Record<
    string,
    (parameters: any) => Promise<string>
  > = {
    /**
     * Search for grant proposals and funding opportunities.
     * Dashboard parameter: query (string, required)
     */
    findProposals: async ({ query }: { query: string }): Promise<string> => {
      const result = await router.execute({
        intent: 'findProposals',
        params: { query: query || 'new grant proposals' },
      });
      return result.message;
    },

    /**
     * Evaluate a specific proposal using AI analysis.
     * Dashboard parameter: proposalId (string, required)
     */
    analyzeProposal: async ({
      proposalId,
    }: {
      proposalId: string;
    }): Promise<string> => {
      const result = await router.execute({
        intent: 'analyzeProposal',
        params: { proposalId },
      });
      return result.message;
    },

    /**
     * Approve and fund a project with on-chain USDC transfer.
     * Dashboard parameters: proposalId (string, required), amount (string, optional)
     */
    fundProject: async ({
      proposalId,
      amount,
    }: {
      proposalId: string;
      amount?: string;
    }): Promise<string> => {
      const params: Record<string, string> = { proposalId };
      if (amount) {
        params.amount = amount;
      }
      const result = await router.execute({
        intent: 'fundProject',
        params,
      });
      return result.message;
    },

    /**
     * Check treasury balance, LP positions, and yield performance.
     * Dashboard parameters: none
     */
    checkTreasury: async (): Promise<string> => {
      const result = await router.execute({
        intent: 'checkTreasury',
        params: {},
      });
      return result.message;
    },
  };

  /**
   * Handler for unhandled client tool calls.
   * Logs a warning when ElevenLabs invokes a tool name not in our clientTools map.
   * This helps debug dashboard/code tool name mismatches.
   */
  const onUnhandledClientToolCall = (params: {
    tool_name: string;
    tool_call_id: string;
    parameters: unknown;
  }) => {
    console.warn(
      `[VoiceTools] Unhandled client tool call: "${params.tool_name}" ` +
        `(id: ${params.tool_call_id}). ` +
        `Check that the tool name in the ElevenLabs dashboard matches the code.`,
    );
  };

  return { clientTools, onUnhandledClientToolCall };
}
