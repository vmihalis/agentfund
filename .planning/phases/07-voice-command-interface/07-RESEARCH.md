# Phase 7: Voice Command Interface - Research

**Researched:** 2026-03-14
**Domain:** ElevenLabs Conversational AI + Agent Command Routing
**Confidence:** MEDIUM

## Summary

Phase 7 integrates ElevenLabs Conversational AI as a voice command interface that routes spoken commands to the existing GovernanceAgent pipeline. The core architecture uses ElevenLabs client tools -- JavaScript functions registered with the voice agent session that execute when the AI agent decides to invoke them. Four client tools (`findProposals`, `analyzeProposal`, `fundProject`, `checkTreasury`) map to existing GovernanceAgent and agent pipeline methods. The text fallback requirement (VOICE-04) is satisfied by building a `VoiceCommandRouter` class that both the ElevenLabs client tools and a direct text API call.

**Primary recommendation:** Build a `VoiceCommandRouter` that wraps GovernanceAgent methods, register its methods as ElevenLabs client tools with "Wait for response" enabled, and expose an Express endpoint (`/api/voice/command`) for text-input fallback. The ElevenLabs agent is configured via dashboard with a custom system prompt. The signed-URL pattern keeps the API key server-side.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-01 | ElevenLabs Conversational AI agent configured with custom system prompt for treasury command center | Dashboard-based agent creation with system prompt, voice selection, and tool configuration. Signed URL auth pattern for secure client access. |
| VOICE-02 | Client tools map voice commands to agent actions (findProposals, analyzeProposal, fundProject, checkTreasury) | ElevenLabs client tools API: register async functions in `startSession({ clientTools: {...} })`. Each tool maps to a GovernanceAgent or specialist agent method. "Wait for response" must be enabled per tool in dashboard. |
| VOICE-03 | Voice interactions trigger real on-chain agent actions (not just text responses) | Client tools call VoiceCommandRouter which calls GovernanceAgent.executeFundingPipeline (Scout -> Analyze -> Treasury). Same code path as API-driven actions. Return values (tx signatures, proposal data) flow back to agent conversation context. |
| VOICE-04 | Text-input fallback for all voice commands (protects demo if audio fails) | VoiceCommandRouter is a standalone class callable from both ElevenLabs client tools and an Express REST endpoint. Text commands parsed with simple intent matching (keyword-based). |
| GOV-03 | Governance Agent routes voice commands to appropriate specialist agents | GovernanceAgent already orchestrates Scout -> Analyzer -> Treasury pipeline. VoiceCommandRouter adds a command-routing layer on top that maps high-level intents to specific GovernanceAgent methods or direct agent calls. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@elevenlabs/client` | 0.15.1 | Browser-side Conversation SDK (startSession, clientTools, events) | Official ElevenLabs Agents SDK, replaces deprecated `@11labs/client` |
| `@elevenlabs/react` | 0.14.2 | React `useConversation` hook for Next.js dashboard integration | Official React wrapper, used in Phase 8 dashboard. Optional for Phase 7 if building standalone. |
| `express` | ^5.2.1 | REST API for signed-URL endpoint and text fallback | Already in project (Phase 6 servers) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@elevenlabs/elevenlabs-js` | 2.39.0 | Server-side API calls (create agent, get signed URL) | If programmatic agent creation needed instead of dashboard. Optional -- can use raw fetch. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ElevenLabs client tools | ElevenLabs server tools (webhooks) | Server tools make HTTP calls from ElevenLabs infra back to your server. Client tools run in-browser. Client tools are simpler for hackathon -- no public URL needed, no webhook tunneling. |
| `@elevenlabs/elevenlabs-js` for signed URL | Raw `fetch` to ElevenLabs API | Raw fetch is simpler, fewer deps. Only need one API call (`GET /v1/convai/conversation/get-signed-url`). |
| Dashboard agent config | Programmatic API agent creation | Dashboard is faster for hackathon. API is better for reproducibility. Recommend dashboard + document the config. |

**Installation:**
```bash
pnpm add @elevenlabs/client
```

Note: `@elevenlabs/react` is needed for Phase 8 (dashboard), not Phase 7. Phase 7 focuses on the command router and ElevenLabs integration layer. If a minimal test UI is needed in Phase 7, use `@elevenlabs/client` directly with vanilla JS/HTML.

## Architecture Patterns

### Recommended Project Structure
```
src/
  voice/
    voice-command-router.ts    # Command routing (core logic, no ElevenLabs dep)
    voice-tools.ts             # ElevenLabs client tools definitions
    voice-types.ts             # VoiceCommand, VoiceResult types
    signed-url.ts              # Server-side signed URL endpoint
    index.ts                   # Barrel export
```

### Pattern 1: VoiceCommandRouter (Framework-Agnostic Core)
**What:** A class that maps string command intents to GovernanceAgent/agent methods. Completely independent of ElevenLabs -- can be called from CLI, REST API, or client tools.
**When to use:** Always. This is the core routing layer.
**Example:**
```typescript
// Source: Project architecture pattern (matches GovernanceAgent pattern)
import type { GovernanceAgent } from '../agents/governance-agent.js';
import type { ITreasuryAgent } from '../agents/types.js';

export type VoiceIntent = 'findProposals' | 'analyzeProposal' | 'fundProject' | 'checkTreasury';

export interface VoiceCommand {
  intent: VoiceIntent;
  params: Record<string, string>;
}

export interface VoiceResult {
  success: boolean;
  intent: VoiceIntent;
  message: string;           // Human-readable summary for voice response
  data?: unknown;            // Structured data (proposals, balances, tx sigs)
}

export class VoiceCommandRouter {
  constructor(
    private readonly governance: GovernanceAgent,
    private readonly treasury: ITreasuryAgent,
  ) {}

  async execute(command: VoiceCommand): Promise<VoiceResult> {
    switch (command.intent) {
      case 'findProposals':
        return this.handleFindProposals(command.params);
      case 'analyzeProposal':
        return this.handleAnalyzeProposal(command.params);
      case 'fundProject':
        return this.handleFundProject(command.params);
      case 'checkTreasury':
        return this.handleCheckTreasury();
      default:
        return { success: false, intent: command.intent, message: 'Unknown command' };
    }
  }
}
```

### Pattern 2: ElevenLabs Client Tools Registration
**What:** Map VoiceCommandRouter methods to ElevenLabs clientTools object.
**When to use:** When starting the ElevenLabs conversation session.
**Example:**
```typescript
// Source: ElevenLabs client tools docs (elevenlabs.io/docs/eleven-agents/customization/tools/client-tools)
import { Conversation } from '@elevenlabs/client';

function createClientTools(router: VoiceCommandRouter) {
  return {
    findProposals: async ({ query }: { query: string }) => {
      const result = await router.execute({
        intent: 'findProposals',
        params: { query: query || 'new grant proposals' },
      });
      return result.message; // Returned to agent conversation context
    },
    analyzeProposal: async ({ proposalId }: { proposalId: string }) => {
      const result = await router.execute({
        intent: 'analyzeProposal',
        params: { proposalId },
      });
      return result.message;
    },
    fundProject: async ({ proposalId, amount }: { proposalId: string; amount: string }) => {
      const result = await router.execute({
        intent: 'fundProject',
        params: { proposalId, amount },
      });
      return result.message;
    },
    checkTreasury: async () => {
      const result = await router.execute({
        intent: 'checkTreasury',
        params: {},
      });
      return result.message;
    },
  };
}

// Starting a session
const conversation = await Conversation.startSession({
  signedUrl: await fetchSignedUrl(),
  clientTools: createClientTools(router),
  onMessage: (msg) => console.log('Agent:', msg),
  onModeChange: ({ mode }) => console.log('Mode:', mode),
});
```

### Pattern 3: Signed URL Server Endpoint
**What:** Express endpoint that proxies ElevenLabs signed URL creation, keeping API key server-side.
**When to use:** For private/authenticated ElevenLabs agents.
**Example:**
```typescript
// Source: ElevenLabs authentication docs
import express from 'express';

const app = express();

app.get('/api/voice/signed-url', async (req, res) => {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': apiKey! } },
  );

  if (!response.ok) {
    return res.status(500).json({ error: 'Failed to get signed URL' });
  }

  const body = await response.json();
  res.json({ signedUrl: body.signed_url });
});
```

### Pattern 4: Text Fallback Endpoint
**What:** Express POST endpoint that accepts text commands and routes through the same VoiceCommandRouter.
**When to use:** Always -- VOICE-04 requires text fallback for demo protection.
**Example:**
```typescript
// Text fallback -- same router, no ElevenLabs dependency
app.post('/api/voice/command', express.json(), async (req, res) => {
  const { text } = req.body;
  const command = parseTextCommand(text); // Simple intent extraction
  const result = await router.execute(command);
  res.json(result);
});

function parseTextCommand(text: string): VoiceCommand {
  const lower = text.toLowerCase();
  if (lower.includes('find') && lower.includes('proposal')) {
    return { intent: 'findProposals', params: { query: text } };
  }
  if (lower.includes('analyze') || lower.includes('evaluate')) {
    return { intent: 'analyzeProposal', params: { proposalId: extractId(text) } };
  }
  if (lower.includes('fund') || lower.includes('approve')) {
    return { intent: 'fundProject', params: { proposalId: extractId(text), amount: extractAmount(text) } };
  }
  if (lower.includes('treasury') || lower.includes('balance') || lower.includes('check')) {
    return { intent: 'checkTreasury', params: {} };
  }
  // Default to find proposals
  return { intent: 'findProposals', params: { query: text } };
}
```

### Anti-Patterns to Avoid
- **Coupling voice logic to ElevenLabs SDK:** The VoiceCommandRouter must be testable without ElevenLabs. Never import `@elevenlabs/client` in the router itself.
- **Client-side API key exposure:** Never pass ELEVENLABS_API_KEY to the browser. Use signed URL pattern.
- **Fire-and-forget tools:** All four tools MUST have "Wait for response" enabled in the ElevenLabs dashboard. Without this, the agent speaks over the operation and ignores results.
- **Blocking voice on long operations:** Scout discovery and funding pipeline can take 5-15 seconds. The agent should acknowledge the command ("Looking for proposals now...") while the client tool runs. ElevenLabs handles this natively when "Wait for response" is on.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voice-to-text (ASR) | Custom whisper/ASR pipeline | ElevenLabs Conversational AI built-in ASR | ElevenLabs handles real-time ASR + LLM + TTS in one session |
| Text-to-speech | Custom TTS pipeline | ElevenLabs built-in TTS | Same session, no extra infra |
| WebRTC audio management | Custom WebRTC signaling | `@elevenlabs/client` Conversation class | Handles audio device selection, streaming, mode changes |
| Conversation state management | Custom conversation tracker | ElevenLabs agent session | Agent maintains conversation context, tool history |
| Intent parsing for voice | NLP intent classifier | ElevenLabs agent LLM + tool definitions | The agent LLM (GPT-4o, Claude, etc.) decides when to call tools based on conversation context and tool descriptions |

**Key insight:** ElevenLabs Conversational AI is a complete voice agent platform -- it handles ASR, LLM reasoning, tool selection, and TTS. We only need to provide: (1) the system prompt, (2) tool definitions in the dashboard, and (3) client-side tool implementations. The complexity lives in the command router that bridges voice tools to existing agent infrastructure.

## Common Pitfalls

### Pitfall 1: Tool Name Case Sensitivity
**What goes wrong:** Client tool names in code don't match dashboard configuration, so tools never fire.
**Why it happens:** Tool names in ElevenLabs dashboard are case-sensitive and must exactly match the key names in the `clientTools` object.
**How to avoid:** Define tool names as constants, use them in both dashboard config and code. Document the exact names: `findProposals`, `analyzeProposal`, `fundProject`, `checkTreasury`.
**Warning signs:** Agent says "I'll look into that" but never triggers the tool. Check `onUnhandledClientToolCall` callback.

### Pitfall 2: "Wait for Response" Not Enabled
**What goes wrong:** Agent fires the tool but immediately continues talking without waiting for the result. Tool return values are ignored.
**Why it happens:** By default, ElevenLabs client tools are non-blocking. Must explicitly enable "Wait for response" per tool in dashboard.
**How to avoid:** Enable "Wait for response" for ALL four tools in the ElevenLabs dashboard. This is critical -- without it, the agent cannot report real on-chain results back to the user.
**Warning signs:** Agent says generic responses like "I've started that process" instead of reporting actual data.

### Pitfall 3: Signed URL Expiration
**What goes wrong:** User tries to start a conversation but gets connection failure.
**Why it happens:** Signed URLs expire after 15 minutes. If the page loads but user doesn't start conversation for 15+ minutes, the URL is stale.
**How to avoid:** Fetch signed URL at session start time (when user clicks "Start Conversation"), not at page load. Or implement retry logic that re-fetches on connection failure.
**Warning signs:** Connection works intermittently, especially after idle periods.

### Pitfall 4: Microphone Permissions in Demo Environment
**What goes wrong:** Voice input doesn't work at the hackathon venue.
**Why it happens:** Browser microphone permissions, venue noise, system audio settings.
**How to avoid:** VOICE-04 text fallback is the safety net. Test mic permissions beforehand. Have the text fallback prominently visible.
**Warning signs:** No audio input detected. The `onModeChange` callback will never switch to "listening" mode.

### Pitfall 5: Long-Running Tool Timeouts
**What goes wrong:** The funding pipeline takes 10+ seconds; the ElevenLabs session times out or the agent gives up waiting.
**Why it happens:** Scout discovery (Unbrowse) + Analyzer (Claude API) + Treasury (Solana tx) can be slow in sequence.
**How to avoid:** For `fundProject`, consider running the full pipeline outside the client tool. Have the tool initiate the action and return a "processing" message, then update via a separate channel. Alternatively, keep the tool blocking but ensure the ElevenLabs agent's `max_duration` is set appropriately.
**Warning signs:** Agent disconnects mid-operation or returns timeout errors.

## Code Examples

### ElevenLabs Dashboard Configuration (Document for Reproducibility)

```
Agent Name: AgentFund Treasury Command Center
First Message: "Welcome to the AgentFund Treasury Command Center. I can help you discover grant proposals, analyze them, fund projects, and check the treasury balance. What would you like to do?"
Language: en
LLM: gpt-4o-mini (or claude-3-5-sonnet if available)
Voice: Pick from ElevenLabs voice library (professional, clear)

System Prompt:
"You are the voice interface for AgentFund, an autonomous AI treasury system on Solana.
You coordinate four AI agents: Scout (discovers grant proposals), Proposal Analyzer
(evaluates proposals with AI), Treasury Manager (manages funds and DeFi positions),
and Governance (makes funding decisions).

Your role:
- Help users discover grant proposals by calling findProposals
- Analyze specific proposals by calling analyzeProposal
- Fund approved projects by calling fundProject (this triggers real on-chain transactions)
- Report treasury status by calling checkTreasury

Always use the appropriate tool for each request. When a tool returns data, summarize
the results conversationally. For funding actions, always confirm the transaction
signature so the user can verify on Solscan.

Be concise but informative. This is a hackathon demo -- be enthusiastic about the
multi-agent coordination happening behind the scenes."

Tools (all Client type, all "Wait for response" enabled):
1. findProposals
   - Description: "Search for grant proposals and funding opportunities"
   - Parameters: query (string, required) - "Search query describing what proposals to find"

2. analyzeProposal
   - Description: "Evaluate a specific proposal using AI analysis"
   - Parameters: proposalId (string, required) - "ID of the proposal to analyze"

3. fundProject
   - Description: "Approve and fund a project with on-chain USDC transfer"
   - Parameters: proposalId (string, required) - "ID of the proposal to fund"
                  amount (string, optional) - "Amount in USDC to allocate"

4. checkTreasury
   - Description: "Check treasury balance, LP positions, and yield performance"
   - Parameters: none
```

### VoiceCommandRouter Test Pattern
```typescript
// Source: Project test patterns (vitest, matches event-bus.test.ts style)
import { describe, it, expect, vi } from 'vitest';
import { VoiceCommandRouter } from '../../src/voice/voice-command-router.js';

describe('VoiceCommandRouter', () => {
  it('findProposals routes to scout.discoverProposals', async () => {
    const mockGovernance = {
      executeFundingPipeline: vi.fn(),
      // ... stub methods
    };
    const mockTreasury = {
      getBalance: vi.fn().mockResolvedValue({ solBalance: 10, usdcBalance: 500, totalValueUsd: 2000 }),
      executeFunding: vi.fn(),
    };

    const router = new VoiceCommandRouter(mockGovernance as any, mockTreasury);
    const result = await router.execute({ intent: 'checkTreasury', params: {} });

    expect(result.success).toBe(true);
    expect(mockTreasury.getBalance).toHaveBeenCalledOnce();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@11labs/client` + `@11labs/react` | `@elevenlabs/client` + `@elevenlabs/react` | 2025 | Must use new package names; old ones are deprecated |
| WebSocket-only connections | WebSocket + WebRTC options | 2025 | WebRTC is now default for lower latency |
| Manual TTS + ASR integration | Full Conversational AI platform | 2024-2025 | Single SDK handles voice-to-voice with tools |
| Text-only agent tools | Multimodal (voice + text) support | 2025-2026 | Agents can handle text input alongside voice |

**Deprecated/outdated:**
- `@11labs/client` / `@11labs/react`: Deprecated, replaced by `@elevenlabs/client` / `@elevenlabs/react`
- Manual WebSocket setup for voice: Use `Conversation.startSession` instead
- Raw TTS API for conversational use cases: Use Conversational AI platform instead

## Open Questions

1. **ElevenLabs free tier / credit limits for hackathon**
   - What we know: ElevenLabs bounty offers credits, and the platform has a free tier
   - What's unclear: Exact credit allocation for conversational AI sessions, rate limits
   - Recommendation: Create agent in dashboard early to verify access. Have text fallback ready.

2. **Tool execution timeout behavior**
   - What we know: Client tools with "Wait for response" block the agent until the function returns
   - What's unclear: Is there a maximum wait time? What happens after 30+ seconds?
   - Recommendation: Keep tools fast. For `fundProject`, consider splitting into "initiate" + "status" if full pipeline is too slow. Test timeout behavior early.

3. **Package name in project constraints**
   - What we know: PROJECT.md lists `@elevenlabs/react` and `@elevenlabs/client` as dependencies. The official packages are now at `@elevenlabs/client` v0.15.1 and `@elevenlabs/react` v0.14.2.
   - What's unclear: Whether these exact versions have the full client tools API
   - Recommendation: Install `@elevenlabs/client` v0.15.1 and verify `Conversation.startSession` + `clientTools` API exists.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm vitest run tests/unit/voice-command-router.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | ElevenLabs agent config exists (system prompt, tools) | manual-only | N/A -- dashboard config, document and verify | N/A |
| VOICE-02 | Client tools map to agent actions | unit | `pnpm vitest run tests/unit/voice-command-router.test.ts -x` | Wave 0 |
| VOICE-03 | Voice-triggered actions produce real results | integration | `pnpm vitest run tests/integration/voice-pipeline.test.ts -x` | Wave 0 |
| VOICE-04 | Text-input fallback produces identical results | unit | `pnpm vitest run tests/unit/text-command-fallback.test.ts -x` | Wave 0 |
| GOV-03 | Governance routes voice commands to specialists | unit | `pnpm vitest run tests/unit/voice-command-router.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/unit/voice-command-router.test.ts`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/voice-command-router.test.ts` -- covers VOICE-02, GOV-03
- [ ] `tests/unit/text-command-fallback.test.ts` -- covers VOICE-04
- [ ] `tests/integration/voice-pipeline.test.ts` -- covers VOICE-03 (with skipIf for missing env vars)

## Sources

### Primary (HIGH confidence)
- [ElevenLabs Client Tools Documentation](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools) - Tool registration, "Wait for response" behavior, parameter passing
- [ElevenLabs Agents SDK (GitHub)](https://github.com/elevenlabs/packages) - Package names, Conversation.startSession API, clientTools pattern, useConversation hook
- [ElevenLabs Agent API Reference](https://elevenlabs.io/docs/api-reference/agents/get) - Agent configuration schema (prompt, tools, voice, LLM settings)

### Secondary (MEDIUM confidence)
- [ElevenLabs Agent Authentication](https://elevenlabs.io/docs/agents-platform/customization/authentication) - Signed URL pattern, API key security, 15-min expiration
- [ElevenLabs Create Agent API](https://elevenlabs.io/docs/agents-platform/api-reference/agents/create) - POST endpoint for programmatic agent creation
- [npm @elevenlabs/client](https://www.npmjs.com/package/@elevenlabs/client) - Version 0.15.1, package migration from @11labs/client
- [npm @elevenlabs/react](https://www.npmjs.com/package/@elevenlabs/react) - Version 0.14.2, useConversation hook

### Tertiary (LOW confidence)
- ElevenLabs docs URLs returned 404 for several pages (possible documentation restructuring) -- the client tools page at `/eleven-agents/` path worked but others did not. API surface verified through GitHub source and npm packages.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Package names and versions verified via npm, but some docs pages returned 404 suggesting possible API changes
- Architecture: HIGH - VoiceCommandRouter pattern is purely project-internal, follows established GovernanceAgent patterns
- Pitfalls: MEDIUM - Tool configuration details (Wait for response, case sensitivity) verified via official docs, but timeout behavior unverified
- ElevenLabs client tools API: MEDIUM - Verified through multiple sources (GitHub, npm, docs) but exact method signatures on v0.15.1 not fully confirmed

**Research date:** 2026-03-14
**Valid until:** 2026-03-21 (7 days -- ElevenLabs SDK is fast-moving, docs structure appears to be changing)
