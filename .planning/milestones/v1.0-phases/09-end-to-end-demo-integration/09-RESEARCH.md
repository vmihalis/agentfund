# Phase 9: End-to-End Demo Integration - Research

**Researched:** 2026-03-14
**Domain:** Multi-agent orchestration, demo reliability, Solana devnet integration
**Confidence:** HIGH

## Summary

Phase 9 is the final integration phase for the AgentFund hackathon demo. All 8 prior phases are complete: agents are registered on-chain (Phase 1), the governance pipeline coordinates Scout/Analyzer/Treasury (Phase 2), each specialist agent is implemented (Phases 3-5), x402 micropayments gate agent services (Phase 6), voice/text commands route to agent actions (Phase 7), and the Next.js dashboard displays all data (Phase 8). The critical remaining work is wiring everything together for a reliable end-to-end demo flow and ensuring all agent actions produce real, verifiable on-chain transactions.

The key architectural gap is that the GovernanceAgent currently calls Scout and Analyzer agents directly (in-process) rather than through their x402-gated HTTP servers. The STATE.md decision log explicitly notes: "GovernanceAgent x402-aware adapter wiring deferred to Phase 9." This is the most important integration task. Additionally, the dashboard needs an activity feed showing multi-agent coordination in real-time, and a demo orchestration script is needed to ensure reliable startup/teardown of all services.

**Primary recommendation:** Build the x402-aware adapter wiring so GovernanceAgent calls Scout/Analyzer through paid HTTP endpoints, create an activity feed component backed by EventBus events, write a demo startup script, and add an end-to-end integration test that validates the full voice->fund->verify-on-Solscan flow.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEMO-01 | End-to-end demo flow working: voice command -> Scout -> Analyze -> Fund -> verify on Solscan | Requires: (1) demo startup script for all services, (2) x402-aware GovernanceAgent adapter wiring, (3) integration test proving full pipeline with real tx signatures |
| DEMO-02 | All agent actions produce real Solana transaction signatures viewable on explorer | Already supported by TreasuryAgent.executeFunding (returns signature), x402 middleware (attaches x402Signature), and existing Solscan URL builder. Needs: ensuring signatures propagate through pipeline to dashboard |
| DEMO-03 | Multi-agent coordination visible (agents communicating and acting in sequence) | Requires: (1) activity feed component in dashboard, (2) API endpoint streaming/polling EventBus events, (3) GovernanceAgent already emits pipeline:step, pipeline:decision, pipeline:funded events |
</phase_requirements>

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^5.2.1 | HTTP servers for agent services | Already used for Scout/Analyzer/Voice servers |
| @solana/web3.js | ^1.98.4 | Transaction verification, connection | Core blockchain SDK |
| vitest | ^4.1.0 | Integration testing | Already configured, 60s timeout for devnet |
| tsx | ^4.21.0 | Script execution | Already used for all scripts |

### Supporting (No New Dependencies)

This phase requires NO new npm dependencies. All integration work uses existing libraries:
- Express servers: existing server factory pattern from Phase 6
- Event bus: existing TypedEventBus from Phase 2
- Solana: existing connection and key management
- Dashboard: existing Next.js app with API routes

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling for activity feed | WebSocket (ws) | WebSocket is better UX but adds a dependency and complexity; polling every 2s is fine for a 5-minute hackathon demo |
| In-memory event log | Redis/database | Massive overkill for demo; in-memory array with max 100 entries is sufficient |

## Architecture Patterns

### Current System Architecture (What Exists)

```
Dashboard (Next.js :3000)
  |
  +-- /api/voice/command --> Voice Server (Express :4003)
  |                            |
  |                            +-- VoiceCommandRouter
  |                                  |
  |                                  +-- GovernanceAgent (in-process)
  |                                        |
  |                                        +-- scout.discoverProposals()    [DIRECT CALL]
  |                                        +-- analyzer.evaluateProposal() [DIRECT CALL]
  |                                        +-- treasury.executeFunding()   [DIRECT CALL]
  |
  +-- /api/agents     --> reads keys/addresses.json
  +-- /api/treasury   --> proxies to Voice Server "check treasury"
  +-- /api/payments   --> static demo data
  +-- /api/proposals  --> in-memory store

Scout Server (Express :4001)   -- standalone, x402-gated, NOT called by governance
Analyzer Server (Express :4002) -- standalone, x402-gated, NOT called by governance
```

### Target Architecture (What Phase 9 Builds)

```
Dashboard (Next.js :3000)
  |
  +-- /api/voice/command --> Voice Server (Express :4003)
  |                            |
  |                            +-- VoiceCommandRouter
  |                                  |
  |                                  +-- GovernanceAgent (in-process)
  |                                        |
  |                                        +-- x402ScoutAdapter.discoverProposals()
  |                                        |     --> HTTP GET :4001/discover (pays 0.001 USDC)
  |                                        +-- x402AnalyzerAdapter.discoverProposals()
  |                                        |     --> HTTP POST :4002/evaluate (pays 0.002 USDC)
  |                                        +-- treasury.executeFunding()
  |                                              --> SPL transfer on devnet
  |
  +-- /api/activity    --> NEW: returns recent EventBus log entries
  +-- /api/agents      --> reads keys/addresses.json
  +-- /api/treasury    --> proxies to Voice Server "check treasury"
  +-- /api/payments    --> static demo data (or live from activity log)
  +-- /api/proposals   --> in-memory store

Scout Server (Express :4001)   -- x402-gated, CALLED by governance via adapter
Analyzer Server (Express :4002) -- x402-gated, CALLED by governance via adapter
```

### Pattern 1: x402 Adapter (IScoutAgent/IAnalyzerAgent over HTTP)

**What:** Wrapper classes that implement the existing IScoutAgent/IAnalyzerAgent interfaces but delegate to HTTP calls through x402-gated endpoints using wrapFetchWithPayment.

**When to use:** When GovernanceAgent needs to call Scout/Analyzer through paid HTTP endpoints instead of direct in-process calls.

**Example:**
```typescript
// src/agents/adapters/x402-scout-adapter.ts
import type { IScoutAgent } from '../types.js';
import type { Proposal } from '../../types/proposals.js';
import { wrapFetchWithPayment } from '../../lib/x402/client.js';

export class X402ScoutAdapter implements IScoutAgent {
  private readonly paidFetch: typeof fetch;
  private readonly baseUrl: string;

  constructor(baseUrl: string, paidFetch: typeof fetch) {
    this.baseUrl = baseUrl;
    this.paidFetch = paidFetch;
  }

  async discoverProposals(query: string): Promise<Proposal[]> {
    const url = `${this.baseUrl}/discover?q=${encodeURIComponent(query)}`;
    const res = await this.paidFetch(url);
    if (!res.ok) throw new Error(`Scout HTTP error: ${res.status}`);
    const body = await res.json();
    return body.proposals;
  }
}
```

### Pattern 2: Activity Log (EventBus -> In-Memory Ring Buffer -> REST API)

**What:** A shared event log that listens to all EventBus events and stores them in a bounded array, exposed via a REST endpoint for the dashboard to poll.

**When to use:** To make multi-agent coordination visible (DEMO-03) without adding WebSocket complexity.

**Example:**
```typescript
// src/events/activity-log.ts
import type { AgentEventBus } from './event-types.js';

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: 'status' | 'step' | 'decision' | 'funded' | 'error';
  agent?: string;
  message: string;
  detail?: Record<string, unknown>;
  txSignature?: string;
}

const MAX_ENTRIES = 100;

export function createActivityLog(bus: AgentEventBus) {
  const entries: ActivityEntry[] = [];

  bus.on('agent:status', (event) => {
    push({ type: 'status', agent: event.agent, message: event.detail ?? event.status, timestamp: event.timestamp });
  });

  bus.on('pipeline:step', (event) => {
    push({ type: 'step', message: `${event.step}: ${event.status}`, detail: event.detail, timestamp: Date.now() });
  });

  bus.on('pipeline:funded', (event) => {
    push({ type: 'funded', message: `Funded ${event.proposalTitle}`, txSignature: event.txSignature, timestamp: Date.now() });
  });

  function push(partial: Omit<ActivityEntry, 'id'>) {
    const entry = { id: crypto.randomUUID(), ...partial };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.shift();
  }

  return {
    getEntries: (since?: number) => since ? entries.filter(e => e.timestamp > since) : [...entries],
    getAll: () => [...entries],
  };
}
```

### Pattern 3: Demo Startup Script

**What:** A single script that starts all services in the correct order, verifies health, and provides a unified entry point for the demo.

**When to use:** Demo rehearsal and presentation.

**Example:**
```typescript
// scripts/demo.ts
// 1. Start Scout server (:4001)
// 2. Start Analyzer server (:4002)
// 3. Start Voice server (:4003) with x402-wired GovernanceAgent
// 4. Health-check all three
// 5. Print "Ready for demo" with URLs
// Dashboard is started separately via `cd dashboard && pnpm dev`
```

### Anti-Patterns to Avoid

- **Starting too many processes:** Do not try to start the Next.js dashboard from the demo script. It uses a different package manager workspace and has its own dev server. Keep them separate.
- **Blocking on Unbrowse availability:** Scout has a 3-layer fallback (Unbrowse -> cache -> stub). Do not add Unbrowse health checks to the demo startup -- let the fallback handle it.
- **Polling too aggressively:** 2-second polling for the activity feed is fine. Do not use 100ms intervals.
- **Hardcoding transaction signatures:** All signatures in the demo must come from real devnet transactions, not hardcoded strings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| x402 payment wrapping | Custom HTTP client with payment logic | `wrapFetchWithPayment` from `src/lib/x402/client.ts` | Already handles 402 -> pay -> retry flow with safety cap |
| Event bus | Custom pub/sub system | `TypedEventBus` from `src/events/event-bus.ts` | Already type-safe, already used by all agents |
| Agent interface adaptation | New agent interfaces for HTTP | Implement existing `IScoutAgent`/`IAnalyzerAgent` interfaces | GovernanceAgent already depends on these interfaces -- adapters are drop-in |
| Solscan URL building | Manual URL construction | `buildTxUrl` from `dashboard/src/lib/payments.ts` | Already handles devnet cluster param |
| Server startup pattern | Custom server lifecycle | `createXxxServer` factory pattern from Phases 6/7 | Consistent pattern: `{ app, start }` with random port support for tests |

**Key insight:** Phase 9 is pure integration -- every building block already exists. The work is connecting them, not creating new abstractions.

## Common Pitfalls

### Pitfall 1: Devnet Rate Limiting During Demo
**What goes wrong:** Solana devnet rate-limits RPC calls, causing transaction failures mid-demo.
**Why it happens:** Multiple agents making concurrent RPC calls (balance checks, transfers, confirmations) can exceed the free tier rate limit.
**How to avoid:** Use a single shared Connection instance, add retry logic with exponential backoff on 429 errors, and pre-fund wallets well before the demo (not during).
**Warning signs:** `429 Too Many Requests` errors, `TransactionExpiredBlockheightExceeded` errors.

### Pitfall 2: x402 Payment Fails Due to Insufficient USDC
**What goes wrong:** GovernanceAgent's wallet runs out of USDC after multiple x402 payments to Scout and Analyzer.
**Why it happens:** Each pipeline run costs 0.003 USDC (0.001 Scout + 0.002 Analyzer). If the governance wallet isn't funded with enough USDC, payments fail.
**How to avoid:** Pre-fund governance wallet with at least 1 USDC (enough for ~333 pipeline runs). Check balance at demo startup. The existing `fund-wallets` script handles this.
**Warning signs:** 402 responses not resolving after payment, "insufficient balance" errors.

### Pitfall 3: Service Startup Order Dependencies
**What goes wrong:** Voice server starts before Scout/Analyzer servers, and the first pipeline run fails because HTTP endpoints aren't available yet.
**Why it happens:** Services are started in parallel or wrong order.
**How to avoid:** Start Scout server -> Analyzer server -> wait for health checks -> start Voice server with x402 adapters pointing to running servers. Demo script enforces order.
**Warning signs:** `ECONNREFUSED` errors on first pipeline run.

### Pitfall 4: Transaction Confirmation Timing
**What goes wrong:** Dashboard tries to link to a Solscan TX URL but the transaction hasn't been confirmed yet, showing "Transaction not found" to judges.
**Why it happens:** Solana devnet confirmation can take 5-30 seconds. If the demo moves too fast, the explorer hasn't indexed the TX yet.
**How to avoid:** Add a brief pause in the demo narrative ("Let's verify this on Solscan..."), or display the signature immediately and note "confirming..." before opening the explorer link.
**Warning signs:** Solscan showing "Transaction not found" for a valid signature.

### Pitfall 5: EventBus Shared Instance
**What goes wrong:** Activity log shows no events because the Voice server, GovernanceAgent, and activity log use different EventBus instances.
**Why it happens:** Each `new TypedEventBus()` creates an independent emitter. Events emitted on one bus are not visible on another.
**How to avoid:** Create ONE shared EventBus instance in the demo startup script and pass it to all agents, the activity log, and any event-dependent components.
**Warning signs:** Activity feed shows "No activity" even after running pipeline commands.

## Code Examples

### Wiring GovernanceAgent with x402 Adapters

```typescript
// In the demo startup script, wire real agents with x402 adapters:
import { TypedEventBus } from '../src/events/event-bus.js';
import { GovernanceAgent } from '../src/agents/governance-agent.js';
import { TreasuryAgent } from '../src/agents/treasury-agent.js';
import { X402ScoutAdapter } from '../src/agents/adapters/x402-scout-adapter.js';
import { X402AnalyzerAdapter } from '../src/agents/adapters/x402-analyzer-adapter.js';
import { wrapFetchWithPayment } from '../src/lib/x402/client.js';
import { getWeb3Keypair } from '../src/lib/keys.js';
import { getConnection } from '../src/lib/solana/connection.js';
import { DEVNET_USDC_MINT } from '../src/lib/solana/token-accounts.js';

const bus = new TypedEventBus();
const connection = getConnection();
const govKeypair = getWeb3Keypair('governance');

// Create x402 payment-wrapped fetch for governance agent
const paidFetch = wrapFetchWithPayment(fetch, {
  keypair: govKeypair,
  connection,
  usdcMint: DEVNET_USDC_MINT,
  maxPaymentUsdc: 10000, // 0.01 USDC cap per payment
});

// Adapters implement IScoutAgent / IAnalyzerAgent over HTTP
const scout = new X402ScoutAdapter('http://localhost:4001', paidFetch);
const analyzer = new X402AnalyzerAdapter('http://localhost:4002', paidFetch);
const treasury = new TreasuryAgent(bus);
await treasury.initialize();

const governance = new GovernanceAgent(bus, scout, analyzer, treasury);
await governance.initialize();
```

### Activity Feed Dashboard Component Pattern

```typescript
// dashboard/src/components/ActivityFeed.tsx
// Poll /api/activity every 2 seconds, display entries in reverse chronological order
// Each entry shows: timestamp, agent name, action, and optional Solscan TX link
// Use the existing Solscan URL pattern from PaymentHistory component
```

### Activity Feed API Route Pattern

```typescript
// dashboard/src/app/api/activity/route.ts
// GET /api/activity?since=<timestamp>
// Proxies to voice server's activity endpoint
// Returns ActivityEntry[] array
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stub agents for pipeline testing | Real agents with Solana devnet | Phases 3-5 | Pipeline produces real transactions |
| Direct agent calls (in-process) | x402-gated HTTP endpoints | Phase 6 | Agent services are independently deployable and paid |
| Static demo data for payments | Real x402 payment cycle | Phase 6 | On-chain USDC transfers between agent wallets |
| No activity visibility | EventBus with typed events | Phase 2 | Pipeline emits step/decision/funded events |

**What remains:** Connecting these existing capabilities into a unified demo flow. All building blocks are implemented.

## Open Questions

1. **Unbrowse availability during demo**
   - What we know: Scout has 3-layer fallback (Unbrowse -> cache -> stub data)
   - What's unclear: Whether Unbrowse will be running at localhost:6969 during the demo
   - Recommendation: The fallback guarantees the demo works regardless. If Unbrowse is available, real web data makes the demo more impressive; if not, stub data still shows the pipeline working. No action needed.

2. **How many demo runs to rehearse**
   - What we know: Each pipeline run costs ~0.003 USDC in x402 payments plus SOL for tx fees
   - What's unclear: How much USDC/SOL is currently in the governance wallet
   - Recommendation: Run `fund-wallets` script before demo to ensure adequate balance. Include balance check in demo startup script.

3. **Dashboard live updates during demo**
   - What we know: Dashboard currently polls APIs on page load only. ProposalPipeline uses static seed data.
   - What's unclear: Whether the activity feed polling will be fast enough to show real-time agent coordination
   - Recommendation: 2-second polling interval is sufficient for a 5-minute demo. The activity feed entries arrive in sequence during a pipeline run that takes 3-5 seconds total.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test -- --reporter=verbose tests/integration/e2e-demo.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEMO-01 | Full pipeline: voice text -> scout -> analyze -> fund -> tx signature | integration | `pnpm test -- tests/integration/e2e-demo.test.ts -x` | Wave 0 |
| DEMO-02 | Agent actions produce real Solana tx signatures | integration | `pnpm test -- tests/integration/e2e-demo.test.ts -x` | Wave 0 |
| DEMO-03 | Multi-agent coordination visible in activity feed | unit | `pnpm test -- tests/unit/activity-log.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- tests/unit/activity-log.test.ts tests/unit/x402-adapters.test.ts -x`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/x402-adapters.test.ts` -- covers x402 Scout/Analyzer adapter wiring (DEMO-01, DEMO-02)
- [ ] `tests/unit/activity-log.test.ts` -- covers activity log EventBus -> entries (DEMO-03)
- [ ] `tests/integration/e2e-demo.test.ts` -- covers full pipeline with stub agents (DEMO-01)

*(No new framework install needed -- vitest is already configured)*

## Sources

### Primary (HIGH confidence)
- Project codebase direct inspection -- all source files read in full
- `.planning/STATE.md` -- decision log explicitly defers x402 adapter wiring to Phase 9
- `.planning/REQUIREMENTS.md` -- DEMO-01/02/03 requirements and traceability
- Existing test patterns -- `tests/integration/voice-pipeline.test.ts`, `tests/integration/x402-payment.test.ts`

### Secondary (MEDIUM confidence)
- Solana devnet behavior -- based on existing integration test patterns in the codebase and known devnet characteristics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies needed, all libraries already installed and used
- Architecture: HIGH - all building blocks exist, integration patterns are clear from codebase
- Pitfalls: HIGH - derived from existing code patterns and Solana devnet experience visible in tests

**Research date:** 2026-03-14
**Valid until:** 2026-03-16 (hackathon ends March 15)
