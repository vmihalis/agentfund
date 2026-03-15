/**
 * ElevenLabs voice session helper.
 *
 * Thin wrapper around Conversation.startSession that wires up the
 * client tools from createClientTools and provides a clean interface
 * for starting a voice conversation session.
 *
 * This module is the only file in the voice package that imports
 * from @elevenlabs/client -- keeping the ElevenLabs SDK dependency
 * isolated from the framework-agnostic VoiceCommandRouter.
 *
 * @module voice/voice-session
 */

import { Conversation } from '@elevenlabs/client';
import type { VoiceCommandRouter } from './voice-command-router.js';
import { createClientTools } from './voice-tools.js';

/** Options for creating a voice session. */
export interface VoiceSessionOptions {
  /** Signed URL from ElevenLabs convai API (obtained via /api/voice/signed-url). */
  signedUrl: string;
  /** VoiceCommandRouter instance to route tool calls through. */
  router: VoiceCommandRouter;
  /** Callback fired when the agent or user sends a message. */
  onMessage?: (msg: { message: string; source: string }) => void;
  /** Callback fired when the conversation mode changes (speaking/listening). */
  onModeChange?: (data: { mode: string }) => void;
  /** Callback fired on connection or session errors. */
  onError?: (error: string, context?: unknown) => void;
}

/**
 * Start an ElevenLabs Conversational AI session with client tools
 * wired to the VoiceCommandRouter.
 *
 * @param options - Session configuration with signed URL, router, and callbacks
 * @returns The active Conversation instance (call endSession() to stop)
 */
export async function createVoiceSession(
  options: VoiceSessionOptions,
): Promise<Conversation> {
  const { signedUrl, router, onMessage, onModeChange, onError } = options;
  const { clientTools, onUnhandledClientToolCall } = createClientTools(router);

  const conversation = await Conversation.startSession({
    signedUrl,
    clientTools,
    onMessage: onMessage as any,
    onModeChange: onModeChange as any,
    onError,
    onUnhandledClientToolCall,
  });

  return conversation;
}
