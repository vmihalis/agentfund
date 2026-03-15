/**
 * Voice command types for the voice/text command interface.
 *
 * Defines the intent vocabulary, command shape, and result format
 * used by both the voice (ElevenLabs) and text fallback paths.
 *
 * @module voice/voice-types
 */

/** Supported voice command intents. */
export type VoiceIntent =
  | 'findProposals'
  | 'analyzeProposal'
  | 'fundProject'
  | 'checkTreasury';

/** Parsed voice/text command ready for routing. */
export interface VoiceCommand {
  intent: VoiceIntent;
  params: Record<string, string>;
}

/** Result returned from command execution. */
export interface VoiceResult {
  success: boolean;
  intent: VoiceIntent;
  message: string;
  data?: unknown;
}
