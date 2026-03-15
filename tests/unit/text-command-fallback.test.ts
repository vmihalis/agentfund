/**
 * Tests for text command parser and voice server (VOICE-04).
 *
 * Verifies that:
 * - parseTextCommand maps natural language to correct VoiceCommand intents
 * - Default fallback intent is findProposals
 * - POST /api/voice/command parses text and routes through VoiceCommandRouter
 * - POST /api/voice/command returns 400 when no text provided
 * - GET /api/voice/signed-url returns 500 when env vars not set
 * - GET /api/voice/health returns 200 with status ok
 *
 * Server tests use random port (port 0) and fetch, matching Phase 6 pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';

// --- Text Parser Tests ---

describe('parseTextCommand', () => {
  // Dynamic import to avoid module caching issues
  let parseTextCommand: typeof import('../../src/voice/text-parser.js').parseTextCommand;

  beforeEach(async () => {
    const mod = await import('../../src/voice/text-parser.js');
    parseTextCommand = mod.parseTextCommand;
  });

  it('maps "find new grant proposals" to findProposals intent', () => {
    const result = parseTextCommand('find new grant proposals');
    expect(result.intent).toBe('findProposals');
    expect(result.params.query).toBe('find new grant proposals');
  });

  it('maps "find proposal about defi" to findProposals intent', () => {
    const result = parseTextCommand('find proposal about defi');
    expect(result.intent).toBe('findProposals');
    expect(result.params.query).toBe('find proposal about defi');
  });

  it('maps "search for grants" to findProposals intent', () => {
    const result = parseTextCommand('search for grants');
    expect(result.intent).toBe('findProposals');
  });

  it('maps "analyze proposal XYZ" to analyzeProposal intent', () => {
    const result = parseTextCommand('analyze proposal XYZ');
    expect(result.intent).toBe('analyzeProposal');
    expect(result.params.proposalId).toBe('XYZ');
  });

  it('maps "evaluate this project" to analyzeProposal intent', () => {
    const result = parseTextCommand('evaluate this project');
    expect(result.intent).toBe('analyzeProposal');
  });

  it('maps "fund project ABC 5000" to fundProject intent', () => {
    const result = parseTextCommand('fund project ABC 5000');
    expect(result.intent).toBe('fundProject');
    expect(result.params.proposalId).toBe('ABC');
    expect(result.params.amount).toBe('5000');
  });

  it('maps "approve proposal DEF" to fundProject intent', () => {
    const result = parseTextCommand('approve proposal DEF');
    expect(result.intent).toBe('fundProject');
    expect(result.params.proposalId).toBe('DEF');
  });

  it('maps "fund project with $2500" to fundProject with amount', () => {
    const result = parseTextCommand('fund project with $2500');
    expect(result.intent).toBe('fundProject');
    expect(result.params.amount).toBe('2500');
  });

  it('maps "check treasury balance" to checkTreasury intent', () => {
    const result = parseTextCommand('check treasury balance');
    expect(result.intent).toBe('checkTreasury');
    expect(result.params).toEqual({});
  });

  it('maps "show balance" to checkTreasury intent', () => {
    const result = parseTextCommand('show balance');
    expect(result.intent).toBe('checkTreasury');
  });

  it('maps "what is our treasury" to checkTreasury intent', () => {
    const result = parseTextCommand('what is our treasury');
    expect(result.intent).toBe('checkTreasury');
  });

  it('defaults unknown text to findProposals with query', () => {
    const result = parseTextCommand('hello world');
    expect(result.intent).toBe('findProposals');
    expect(result.params.query).toBe('hello world');
  });

  it('handles case-insensitive input', () => {
    const result = parseTextCommand('CHECK TREASURY BALANCE');
    expect(result.intent).toBe('checkTreasury');
  });

  it('handles empty string gracefully', () => {
    const result = parseTextCommand('');
    expect(result.intent).toBe('findProposals');
  });
});

// --- Voice Server Tests ---

describe('Voice Server', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  async function startTestServer(routerOverrides?: Record<string, any>) {
    const { createVoiceServer } = await import('../../src/voice/voice-server.js');
    const { VoiceCommandRouter } = await import('../../src/voice/voice-command-router.js');

    // Create a mock router
    const mockRouter = Object.assign(Object.create(VoiceCommandRouter.prototype), {
      execute: vi.fn().mockResolvedValue({
        success: true,
        intent: 'checkTreasury',
        message: 'Treasury holds 10 SOL',
        data: { solBalance: 10 },
      }),
      ...routerOverrides,
    });

    const result = createVoiceServer({ port: 0, router: mockRouter as any });
    server = await result.start();
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    return { server, port, mockRouter };
  }

  it('POST /api/voice/command returns VoiceResult for valid text', async () => {
    const { port, mockRouter } = await startTestServer();

    const res = await fetch(`http://localhost:${port}/api/voice/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'check treasury balance' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.intent).toBeDefined();
    expect(body.message).toBeDefined();
    expect(mockRouter.execute).toHaveBeenCalled();
  });

  it('POST /api/voice/command returns 400 when no text provided', async () => {
    const { port } = await startTestServer();

    const res = await fetch(`http://localhost:${port}/api/voice/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('POST /api/voice/command returns 400 for empty body', async () => {
    const { port } = await startTestServer();

    const res = await fetch(`http://localhost:${port}/api/voice/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    });

    expect(res.status).toBe(400);
  });

  it('GET /api/voice/signed-url returns 500 when env vars not set', async () => {
    // Ensure env vars are not set
    const origKey = process.env.ELEVENLABS_API_KEY;
    const origAgent = process.env.ELEVENLABS_AGENT_ID;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_AGENT_ID;

    try {
      const { port } = await startTestServer();

      const res = await fetch(`http://localhost:${port}/api/voice/signed-url`);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('ElevenLabs credentials not configured');
    } finally {
      // Restore env vars
      if (origKey) process.env.ELEVENLABS_API_KEY = origKey;
      if (origAgent) process.env.ELEVENLABS_AGENT_ID = origAgent;
    }
  });

  it('GET /api/voice/health returns 200 with status ok', async () => {
    const { port } = await startTestServer();

    const res = await fetch(`http://localhost:${port}/api/voice/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
