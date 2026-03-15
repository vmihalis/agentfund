/**
 * Voice command Express server -- stub for TDD RED phase.
 *
 * @module voice/voice-server
 */

import type { Server } from 'http';
import type { Express } from 'express';
import type { VoiceCommandRouter } from './voice-command-router.js';

export interface VoiceServerOptions {
  port?: number;
  router: VoiceCommandRouter;
}

export function createVoiceServer(_options: VoiceServerOptions): {
  app: Express;
  start: () => Promise<Server>;
} {
  throw new Error('Not implemented');
}
