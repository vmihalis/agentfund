/**
 * Passport gating logic extracted as a pure function for testability.
 *
 * Determines whether a user should be allowed to submit proposals
 * based on their humanity score and verification state.
 */

/**
 * Decide whether a user passes the sybil gate.
 *
 * @param score     - The user's humanity score (null when loading or unverified).
 * @param isPassing - Whether the Passport API considers the score sufficient.
 * @param demoMode  - True when Passport API keys are not configured.
 * @returns True if the user should be allowed to submit proposals.
 */
export function shouldAllowSubmission(
  score: number | null,
  isPassing: boolean,
  demoMode: boolean,
): boolean {
  // No score yet (loading or unverified) -- always block.
  if (score === null) {
    return false;
  }

  // In demo mode, only allow when a simulated score >= 20 is provided.
  if (demoMode) {
    return score >= 20;
  }

  // Production mode: trust the Passport API's isPassing flag AND verify score >= 20.
  return isPassing && score >= 20;
}
