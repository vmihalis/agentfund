/**
 * Voice command interface module.
 *
 * Exports types, router, parser, and server for the voice/text command system.
 *
 * @module voice
 */

export type { VoiceIntent, VoiceCommand, VoiceResult } from './voice-types.js';
export { VoiceCommandRouter } from './voice-command-router.js';
export type { VoiceRouterDeps } from './voice-command-router.js';
export { parseTextCommand } from './text-parser.js';
export { createVoiceServer } from './voice-server.js';
export type { VoiceServerOptions } from './voice-server.js';
