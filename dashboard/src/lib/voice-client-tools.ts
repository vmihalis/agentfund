/**
 * Browser-side ElevenLabs clientTools factory.
 *
 * Extracted as a pure function (no React, no JSX) for testability.
 * Each tool function calls sendCommandFn with the appropriate text command
 * and returns the response message string (which ElevenLabs will speak back).
 *
 * Tool names match the ElevenLabs dashboard configuration exactly:
 * findProposals, analyzeProposal, fundProject, checkTreasury
 *
 * @module lib/voice-client-tools
 */

/**
 * Create browser-side ElevenLabs clientTools wired to a sendCommand function.
 *
 * @param sendCommandFn - Function that sends text commands to the voice server
 * @returns Record of tool functions for ElevenLabs useConversation
 */
export function createBrowserClientTools(
  sendCommandFn: (text: string) => Promise<{ message: string }>,
): Record<string, (params: any) => Promise<string>> {
  return {
    findProposals: async ({ query }: { query?: string }) => {
      const r = await sendCommandFn(query || 'find proposals');
      return r.message;
    },
    analyzeProposal: async ({ proposalId }: { proposalId: string }) => {
      const r = await sendCommandFn('analyze proposal ' + proposalId);
      return r.message;
    },
    fundProject: async ({ proposalId, amount }: { proposalId: string; amount?: string }) => {
      const cmd = amount ? 'fund ' + proposalId + ' ' + amount : 'fund ' + proposalId;
      const r = await sendCommandFn(cmd);
      return r.message;
    },
    checkTreasury: async () => {
      const r = await sendCommandFn('check treasury');
      return r.message;
    },
  };
}
