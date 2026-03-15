# Phase 11: Live Dashboard Wiring - Research

**Researched:** 2026-03-15
**Domain:** Dashboard integration wiring -- closing broken flows identified in v1.0 milestone audit
**Confidence:** HIGH

## Summary

Phase 11 addresses exactly four broken integration flows identified in the v1.0 milestone audit (MISSING-01, MISSING-02, BROKEN-01, BROKEN-02, BROKEN-03). Every fix involves modifying existing, well-understood code files with minimal new code. No new libraries are needed. The gaps are:

1. **VoiceWidget clientTools gap (MISSING-01/BROKEN-01):** `VoiceWidget.tsx` calls `useConversation({onMessage, onError})` without passing `clientTools`. The ElevenLabs `@elevenlabs/react` v0.14.2 `useConversation` hook accepts `clientTools` as part of `HookOptions` (which extends `ClientToolsConfig`). The fix is to define browser-side client tool functions that call the voice server API and pass them to `useConversation`.

2. **x402 payment signature loss (MISSING-02/BROKEN-02):** `X402ScoutAdapter` and `X402AnalyzerAdapter` read `body.proposals` and `body.evaluation` respectively but drop `body.txSignature`. The servers (scout-server, analyzer-server) already include `txSignature` in response bodies via `(req as any).x402Signature`. The fix is to preserve the signature and emit it via the event bus.

3. **Static payment history (BROKEN-02 continued):** Dashboard `/api/payments` calls `getDemoPayments()` returning hardcoded static data. The fix is to create an in-memory payment log that captures `pipeline:funded` events with x402 signatures, and have the payments API serve from it.

4. **Governance pipeline not updating proposals-store (BROKEN-03):** `proposals-store.ts` is static in-memory demo data. `mapPipelineStage()` in `pipeline.ts` is defined but never imported. The fix is to listen to pipeline events and update the proposals store accordingly.

**Primary recommendation:** Fix all four broken flows by wiring existing components together. No new libraries, no new patterns -- pure integration of already-built code.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-02 | Client tools map voice commands to agent actions (findProposals, analyzeProposal, fundProject, checkTreasury) | ElevenLabs React hook accepts `clientTools` in `HookOptions`; browser-side tools call `/api/voice/command` REST endpoint |
| VOICE-03 | Voice interactions trigger real on-chain agent actions (not just text responses) | clientTools wiring enables ElevenLabs agent to invoke real pipeline via voice server proxy |
| GOV-03 | Governance Agent routes voice commands to appropriate specialist agents | VoiceCommandRouter already handles routing; gap is only the ElevenLabs-to-router bridge in browser |
| PAY-02 | At least one agent-to-agent x402 payment with real on-chain USDC transfer on devnet | Adapters must preserve txSignature from x402 server responses; payment log must capture it |
| DASH-03 | Dashboard shows proposal pipeline (submitted, evaluating, approved, funded) | proposals-store must be updated by pipeline events via mapPipelineStage(); already defined but unused |
| DASH-05 | Dashboard shows x402 payment history between agents | Payment API must serve live data from payment log instead of static getDemoPayments() |
</phase_requirements>

## Standard Stack

### Core (already installed, no changes)

| Library | Version | Purpose | Already In |
|---------|---------|---------|------------|
| @elevenlabs/react | 0.14.2 | useConversation hook with clientTools | dashboard/package.json |
| @elevenlabs/client | 0.15.1 | Conversation types, ClientToolsConfig | root package.json |
| next | 15.3.3 | Dashboard framework, API routes | dashboard/package.json |
| express | 5.2.1 | Voice/Scout/Analyzer servers | root package.json |
| vitest | 4.1.0 | Test framework | root package.json |

### Supporting (no new installs needed)

None. All required libraries are already installed.

### Alternatives Considered

None. This phase is pure integration wiring, not library selection.

**Installation:**
```bash
# No installation needed -- all dependencies already present
```

## Architecture Patterns

### Recommended Changes by File

```
dashboard/src/components/VoiceWidget.tsx  # Add clientTools to useConversation
src/agents/adapters/x402-scout-adapter.ts  # Preserve txSignature from response
src/agents/adapters/x402-analyzer-adapter.ts  # Preserve txSignature from response
dashboard/src/lib/payments.ts  # Add in-memory payment log + live data functions
dashboard/src/app/api/payments/route.ts  # Serve live + demo payments
dashboard/src/lib/proposals-store.ts  # Add updateProposalStage function
dashboard/src/lib/pipeline.ts  # Already correct, just needs consumers
scripts/demo.ts  # Wire payment log + proposals-store updates on event bus
```

### Pattern 1: Browser-Side Client Tools for ElevenLabs

**What:** Define `clientTools` that call the dashboard REST API (`/api/voice/command`) from the browser, then pass them to `useConversation`.

**When to use:** When the ElevenLabs agent needs to invoke server-side actions from the browser.

**Why this approach:** The `createClientTools` in `src/voice/voice-tools.ts` imports `VoiceCommandRouter` which depends on Node.js agent code -- impossible to use in browser. Instead, create browser-safe tool functions that POST to `/api/voice/command` and extract the result message.

**Key insight from type analysis:** `useConversation` accepts `HookOptions` which extends `SessionConfig & HookCallbacks & ClientToolsConfig & InputConfig & OutputConfig & AudioWorkletConfig & { serverLocation }`. `ClientToolsConfig` is defined as:
```typescript
type ClientToolsConfig = {
  clientTools: Record<string, (parameters: any) => Promise<string | number | void> | string | number | void>;
};
```

The `clientTools` can be passed either at `useConversation()` init time or at `startSession()` time. Since the hook is initialized once, passing at init time is cleaner.

**Example:**
```typescript
// Source: @elevenlabs/react v0.14.2 type definitions (local node_modules)
const clientTools: Record<string, (params: any) => Promise<string>> = {
  findProposals: async ({ query }: { query: string }) => {
    const result = await sendCommand(query || 'find proposals');
    return result.message;
  },
  analyzeProposal: async ({ proposalId }: { proposalId: string }) => {
    const result = await sendCommand(`analyze proposal ${proposalId}`);
    return result.message;
  },
  fundProject: async ({ proposalId, amount }: { proposalId: string; amount?: string }) => {
    const text = amount ? `fund ${proposalId} ${amount}` : `fund ${proposalId}`;
    const result = await sendCommand(text);
    return result.message;
  },
  checkTreasury: async () => {
    const result = await sendCommand('check treasury');
    return result.message;
  },
};

const conversation = useConversation({
  clientTools,
  onMessage: ...,
  onError: ...,
});
```

**Important:** The `onUnhandledClientToolCall` callback is part of `HookCallbacks` and can be passed to `useConversation` directly alongside `clientTools`.

### Pattern 2: Adapter txSignature Preservation

**What:** Modify x402 adapters to extract and expose `txSignature` from the HTTP response alongside the domain data.

**When to use:** When the adapter response includes payment metadata (txSignature) that must be propagated to downstream consumers.

**Key insight:** The scout and analyzer servers already include `txSignature` in their JSON response bodies. The adapters currently destructure only `body.proposals` / `body.evaluation`, discarding the signature. Two approaches:

**Approach A (Minimal - event emission):** Have the adapters accept an optional callback or event bus, and emit a payment event when a txSignature is received. This does not change the `IScoutAgent`/`IAnalyzerAgent` interfaces.

**Approach B (Return signature separately):** Add a `lastTxSignature` property to each adapter, set after each call. The caller (GovernanceAgent or demo script) can read it.

**Recommendation: Approach B** -- simpler, no interface changes, no new abstractions. The GovernanceAgent pipeline already emits `pipeline:funded` events with txSignature for treasury funding. A similar pattern can emit payment events for x402 discovery/evaluation payments.

**Example:**
```typescript
// In X402ScoutAdapter
export class X402ScoutAdapter implements IScoutAgent {
  lastTxSignature: string | null = null;

  async discoverProposals(query: string): Promise<Proposal[]> {
    const url = `${this.baseUrl}/discover?q=${encodeURIComponent(query)}`;
    const response = await this.paidFetch(url);
    if (!response.ok) throw new Error(`Scout request failed with status ${response.status}`);
    const body = (await response.json()) as { proposals: Proposal[]; txSignature?: string };
    this.lastTxSignature = body.txSignature ?? null;
    return body.proposals;
  }
}
```

### Pattern 3: In-Memory Payment Log

**What:** Module-level mutable array in `dashboard/src/lib/payments.ts` that accumulates live payment records alongside demo data.

**When to use:** When payment records need to be collected from multiple sources (x402 adapter signatures, pipeline:funded events) and served via a single API endpoint.

**Key insight:** The dashboard already uses this pattern for proposals (`proposals-store.ts` has a module-level mutable array with `addProposal` and `getProposals`). Follow the identical pattern for payments.

**Example:**
```typescript
// In dashboard/src/lib/payments.ts
const livePayments: PaymentRecord[] = [];

export function addPayment(payment: PaymentRecord): void {
  livePayments.push(payment);
}

export function getAllPayments(): PaymentRecord[] {
  return [...getDemoPayments(), ...livePayments];
}
```

**How live payments get added:** The voice server (demo.ts) already listens to the shared EventBus. Add a handler for payment events that POSTs to the dashboard's payment API, or more practically, add a new event type for x402 payments and have the demo script's `/api/activity` endpoint also serve payment data that the dashboard polls.

**Simpler alternative:** The voice server already has the activity log. Extend the activity log to include payment metadata (from, to, amount, service, txSignature) on `pipeline:funded` events and on new `x402:payment` events. The dashboard `/api/payments` route then fetches from the voice server's activity endpoint and filters for payment-type entries. This avoids cross-process state management.

**Recommended approach:** Add a `/api/payments` endpoint to the voice server (in demo.ts) backed by an in-memory payment log on the EventBus. The dashboard `/api/payments` route proxies to it, same pattern as `/api/activity`.

### Pattern 4: Pipeline Stage Updates to Proposals Store

**What:** When governance pipeline events fire (discover, evaluate, fund), update the proposals-store with new stage values using `mapPipelineStage()`.

**When to use:** To make the dashboard ProposalPipeline reflect live governance pipeline progress.

**Key insight:** `mapPipelineStage()` already exists in `dashboard/src/lib/pipeline.ts` and correctly maps pipeline steps to dashboard stages. The proposals-store needs an `updateProposalStage()` function. The voice server's pipeline events need to be forwarded to the dashboard.

**Approach:** The dashboard already polls `/api/activity` every 2 seconds. Modify the `/api/proposals` route to also check the activity endpoint for pipeline events and update the proposals-store accordingly. Or, add a function to proposals-store that accepts pipeline events and updates stages.

**Simpler approach:** Add `updateProposalStage(id, stage, evaluation?)` to `proposals-store.ts`. Have the `/api/proposals` GET handler first check the activity feed for pipeline events and reconcile them with the store before returning.

### Anti-Patterns to Avoid

- **Importing Node.js agent code in browser:** Never import `VoiceCommandRouter`, `GovernanceAgent`, or any `src/` module into `dashboard/src/` components. Use REST API calls instead.
- **Changing IScoutAgent/IAnalyzerAgent interfaces:** These are stable contracts used across the codebase. Add `lastTxSignature` as a public property, not an interface change.
- **WebSocket for payment updates:** The project explicitly uses 2-second polling (decision from Phase 09). Do not introduce WebSockets -- it contradicts existing decisions and adds complexity.
- **Persisting payment data to files:** In-memory is fine for this hackathon demo. File persistence adds complexity without demo value.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser-side voice tool routing | Custom WebSocket protocol | REST calls to /api/voice/command via sendCommand() | Already works for text tab; same endpoint for voice tools |
| Payment event propagation | Custom pub/sub between processes | Activity log polling (existing pattern) | Cross-process state sync is hard; polling is proven in this codebase |
| Pipeline stage mapping | New mapping logic | mapPipelineStage() in dashboard/src/lib/pipeline.ts | Already implemented and tested, just needs to be imported |
| Payment record validation | Manual field checks | isValidPaymentRecord() in dashboard/src/lib/payments.ts | Already exists |

**Key insight:** Almost every function needed already exists somewhere in the codebase. The work is connecting them, not creating them.

## Common Pitfalls

### Pitfall 1: ElevenLabs clientTools Return Type
**What goes wrong:** clientTools functions must return `Promise<string | number | void>` (or sync equivalents). Returning a JSON object or Response will break the ElevenLabs agent's spoken response.
**Why it happens:** Developers return the full VoiceResult object instead of just the message string.
**How to avoid:** Always return `result.message` (string) from each client tool function, not the full result object.
**Warning signs:** ElevenLabs agent says "[object Object]" or goes silent after a tool call.

### Pitfall 2: clientTools Tool Name Mismatch
**What goes wrong:** ElevenLabs dashboard has tool names configured (findProposals, analyzeProposal, fundProject, checkTreasury). If browser clientTools use different names, tools are silently unhandled.
**Why it happens:** Case sensitivity, typos, or using different naming conventions.
**How to avoid:** Use the exact same tool names as in `src/voice/voice-tools.ts`: `findProposals`, `analyzeProposal`, `fundProject`, `checkTreasury`. Add `onUnhandledClientToolCall` to log mismatches.
**Warning signs:** Voice commands get text responses but no actions fire. Console warnings from onUnhandledClientToolCall.

### Pitfall 3: Cross-Process State Sync
**What goes wrong:** Dashboard (Next.js on port 3000) and voice server (Express on port 4003) have separate memory spaces. In-memory state in one process is invisible to the other.
**Why it happens:** Next.js API routes run in the Next.js process, not the Express voice server process.
**How to avoid:** Use the existing proxy pattern: dashboard API routes proxy to voice server endpoints. All state lives in the voice server process (which has the EventBus).
**Warning signs:** Payments or proposals appear in voice server logs but not in dashboard.

### Pitfall 4: useConversation Re-initialization
**What goes wrong:** If `clientTools` is defined inline inside the component body, it creates a new object reference on every render, potentially causing `useConversation` to reinitialize.
**Why it happens:** React hook deps comparing object references.
**How to avoid:** Define `clientTools` outside the component or memoize with `useMemo`. Since the tool functions are stable (they only call `sendCommand`), defining them as a module-level constant or using `useMemo` with empty deps works.
**Warning signs:** Voice connection drops and reconnects on every render.

### Pitfall 5: Circular Dependencies in Next.js API Routes
**What goes wrong:** Next.js API routes that import from `@/lib/proposals-store` share module-level state within the same Next.js process, but this state resets on hot reload in dev mode.
**Why it happens:** Next.js dev server hot-reloads modules, clearing in-memory state.
**How to avoid:** For demo purposes, this is acceptable. The proposals-store will reset on dev reload. For a production system, you would use a database. Document this as known behavior.
**Warning signs:** Proposals revert to demo data after editing a file in dev mode.

## Code Examples

### Example 1: VoiceWidget with clientTools

```typescript
// Source: Local codebase analysis + @elevenlabs/react v0.14.2 type definitions
'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useConversation } from '@elevenlabs/react';
import type { VoiceResult } from '@/lib/types';
import { fetchSignedUrl, sendCommand } from '@/lib/api';

// Client tools that route ElevenLabs voice commands to the voice server API
function createBrowserClientTools(onCommandSent?: () => void) {
  return {
    findProposals: async ({ query }: { query: string }): Promise<string> => {
      const result = await sendCommand(query || 'find proposals');
      onCommandSent?.();
      return result.message;
    },
    analyzeProposal: async ({ proposalId }: { proposalId: string }): Promise<string> => {
      const result = await sendCommand(`analyze proposal ${proposalId}`);
      onCommandSent?.();
      return result.message;
    },
    fundProject: async ({ proposalId, amount }: { proposalId: string; amount?: string }): Promise<string> => {
      const cmd = amount ? `fund ${proposalId} ${amount}` : `fund ${proposalId}`;
      const result = await sendCommand(cmd);
      onCommandSent?.();
      return result.message;
    },
    checkTreasury: async (): Promise<string> => {
      const result = await sendCommand('check treasury');
      onCommandSent?.();
      return result.message;
    },
  };
}
```

### Example 2: X402 Adapter with txSignature Preservation

```typescript
// Source: Local codebase analysis of x402-scout-adapter.ts and scout-server.ts
export class X402ScoutAdapter implements IScoutAgent {
  lastTxSignature: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly paidFetch: typeof fetch,
  ) {}

  async discoverProposals(query: string): Promise<Proposal[]> {
    const url = `${this.baseUrl}/discover?q=${encodeURIComponent(query)}`;
    const response = await this.paidFetch(url);
    if (!response.ok) {
      throw new Error(`Scout request failed with status ${response.status}`);
    }
    const body = (await response.json()) as {
      proposals: Proposal[];
      txSignature?: string;
    };
    this.lastTxSignature = body.txSignature ?? null;
    return body.proposals;
  }
}
```

### Example 3: Payment Log with Live + Demo Data

```typescript
// Source: Pattern from dashboard/src/lib/proposals-store.ts
const livePayments: PaymentRecord[] = [];

export function addLivePayment(payment: PaymentRecord): void {
  livePayments.push(payment);
}

export function getAllPayments(): PaymentRecord[] {
  return [...getDemoPayments(), ...livePayments];
}
```

### Example 4: Voice Server Payment Endpoint

```typescript
// Source: Pattern from demo.ts /api/activity endpoint
// In demo.ts, add payment tracking alongside activity log
const paymentLog: PaymentRecord[] = [];

bus.on('pipeline:funded', (event) => {
  // event has { proposalTitle, amount, txSignature }
  // This captures treasury funding payments
});

// After adapter calls, check lastTxSignature and record x402 payments
voiceServer.app.get('/api/payments', (_req, res) => {
  res.json(paymentLog);
});
```

### Example 5: Proposals Store Stage Update

```typescript
// Source: Local codebase analysis of proposals-store.ts and pipeline.ts
import { mapPipelineStage } from './pipeline';

export function updateProposalStage(
  id: string,
  stage: PipelineStage,
  evaluation?: PipelineProposal['evaluation'],
): void {
  const proposal = proposals.find((p) => p.id === id);
  if (proposal) {
    proposal.stage = stage;
    proposal.updatedAt = Date.now();
    if (evaluation) proposal.evaluation = evaluation;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static demo data in getDemoPayments() | Live payment log + demo fallback | Phase 11 | Enables DASH-05 |
| useConversation without clientTools | useConversation with clientTools | Phase 11 | Enables VOICE-02/03 |
| Adapters discard txSignature | Adapters preserve lastTxSignature | Phase 11 | Enables PAY-02 |
| proposals-store is static | proposals-store updated by pipeline events | Phase 11 | Enables DASH-03 |

**Deprecated/outdated:**
- `getDemoPayments()` as sole data source: will be supplemented with live data, but kept as fallback
- `createVoiceSession()` in voice-session.ts: remains an orphaned export (tech debt, not addressed in this phase)

## Open Questions

1. **How to bridge voice server payment events to dashboard process?**
   - What we know: Dashboard and voice server are separate processes. Dashboard proxies to voice server for activity data.
   - What's unclear: Exact endpoint design for payment data proxy.
   - Recommendation: Add `/api/payments` endpoint to voice server (demo.ts), have dashboard `/api/payments/route.ts` proxy to it. Identical pattern to `/api/activity`.

2. **Should proposals-store be updated server-side or client-side?**
   - What we know: proposals-store is in-memory in the Next.js process. Pipeline events happen in the voice server process.
   - What's unclear: How to reconcile cross-process state.
   - Recommendation: Dashboard `/api/proposals` route should proxy to voice server for live pipeline state, or the proposals page should poll both `/api/proposals` (store) and `/api/activity` (events) and reconcile client-side. The simplest approach: add a `/api/proposals/live` endpoint on the voice server that the demo script populates from pipeline events.

3. **Should x402 adapter payment events be emitted on the EventBus?**
   - What we know: The EventBus has `pipeline:funded` for treasury payments but no event type for x402 discovery/evaluation payments.
   - What's unclear: Whether to add a new event type or reuse existing ones.
   - Recommendation: Add an `x402:payment` event type (or reuse the adapter's lastTxSignature in the demo script) to capture discovery and evaluation x402 payments separately from treasury funding payments. This is planner's discretion.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test -- --run tests/unit/{file}.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-02 | Browser clientTools match tool names and return strings | unit | `pnpm test -- --run tests/unit/voice-client-tools-browser.test.ts` | No -- Wave 0 |
| VOICE-03 | clientTools call sendCommand and return message | unit | `pnpm test -- --run tests/unit/voice-client-tools-browser.test.ts` | No -- Wave 0 |
| GOV-03 | Voice command routing (already tested) | unit | `pnpm test -- --run tests/unit/voice-command-router.test.ts` | Yes |
| PAY-02 | x402 adapters preserve txSignature | unit | `pnpm test -- --run tests/unit/x402-adapters.test.ts` | Yes (needs update) |
| DASH-03 | proposals-store updateProposalStage + mapPipelineStage wiring | unit | `pnpm test -- --run tests/unit/proposals-store-update.test.ts` | No -- Wave 0 |
| DASH-05 | Payment log addLivePayment + getAllPayments returns live+demo | unit | `pnpm test -- --run tests/unit/dashboard-payments.test.ts` | Yes (needs update) |

### Sampling Rate
- **Per task commit:** `pnpm test -- --run tests/unit/{changed-test-file}.test.ts`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/voice-client-tools-browser.test.ts` -- covers VOICE-02, VOICE-03 (browser tool function unit tests)
- [ ] `tests/unit/proposals-store-update.test.ts` -- covers DASH-03 (updateProposalStage + mapPipelineStage integration)
- [ ] Update `tests/unit/x402-adapters.test.ts` -- add lastTxSignature preservation assertions
- [ ] Update `tests/unit/dashboard-payments.test.ts` -- add addLivePayment/getAllPayments tests

## Sources

### Primary (HIGH confidence)
- `@elevenlabs/react` v0.14.2 type definitions -- local `node_modules/.pnpm/@elevenlabs+react@0.14.2*/dist/index.d.ts`
- `@elevenlabs/client` v0.15.1 type definitions -- local `node_modules/.pnpm/@elevenlabs+client@0.15.1*/dist/BaseConversation.d.ts`
- v1.0 Milestone Audit -- `.planning/v1.0-MILESTONE-AUDIT.md` (gap definitions MISSING-01, MISSING-02, BROKEN-01/02/03)
- All source files read directly from local codebase

### Secondary (MEDIUM confidence)
- None needed -- all findings derived from local code analysis

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in node_modules
- Architecture: HIGH -- all patterns derived from existing codebase conventions
- Pitfalls: HIGH -- derived from direct type analysis and codebase structure review
- Integration approach: HIGH -- follows established proxy pattern (activity endpoint precedent)

**Research date:** 2026-03-15
**Valid until:** 2026-03-22 (stable -- no external dependencies changing)
