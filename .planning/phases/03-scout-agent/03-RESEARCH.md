# Phase 3: Scout Agent - Research

**Researched:** 2026-03-14
**Domain:** Unbrowse intent resolution API, web data extraction, agent data pipeline
**Confidence:** MEDIUM

## Summary

Phase 3 replaces the `StubScoutAgent` (created in Phase 2) with a real `ScoutAgent` that calls the Unbrowse API at `localhost:6969` to discover grant proposals from the web. The existing architecture already defines `IScoutAgent` interface (`discoverProposals(query: string): Promise<Proposal[]>`), `BaseAgent` abstract class, and `TypedEventBus` -- the Scout agent needs to implement these contracts while making HTTP calls to Unbrowse's `/v1/intent/resolve` endpoint.

The key challenge is that Unbrowse runs locally and may not be available during tests, CI, or demo failures. The success criteria explicitly require graceful fallback to stub/cached data when Unbrowse is unavailable. This means the Scout must have a layered resolution strategy: try Unbrowse first, fall back to cached data from previous successful calls, and ultimately fall back to hardcoded stub data (the same data currently in `StubScoutAgent`).

Since Unbrowse returns raw web data (not structured `Proposal` objects), the Scout must also parse and normalize Unbrowse results into the `Proposal` interface (`id`, `title`, `description`, `requestedAmount`, `teamInfo`, `sourceUrl`). This parsing layer needs to handle varying data formats since Unbrowse may return different structures depending on the target site.

**Primary recommendation:** Build a `ScoutAgent` class extending `BaseAgent` that implements `IScoutAgent`, uses native `fetch` to call Unbrowse `/v1/intent/resolve`, parses results into `Proposal[]`, and falls back gracefully through cached data to stub data on failure.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCOUT-01 | Scout agent discovers grant proposals and funding opportunities via Unbrowse intent resolution | Unbrowse API endpoint documented; request/response format identified; ScoutAgent class extends BaseAgent and implements IScoutAgent |
| SCOUT-02 | Scout calls Unbrowse `/v1/intent/resolve` with natural language intents for grant platform data | Endpoint is `POST http://localhost:6969/v1/intent/resolve` with `{intent, params, context}` body; natural language intents like "find active grant proposals on Solana" |
| SCOUT-03 | Scout returns structured proposal data (title, description, amount, team info) to Governance Agent | Existing `Proposal` interface already defined in `src/types/proposals.ts`; Scout normalizes Unbrowse results into this shape and returns via `discoverProposals()` which Governance already calls |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `fetch` | Built-in (Node 18+) | HTTP calls to Unbrowse API | No extra dependencies; project uses Node 22+; simple POST requests don't need axios |
| Zod | ^4.3.6 | Validate and parse Unbrowse responses | Already in project; used in GovernanceAgent for structured validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.0 | Unit testing Scout agent | Already in project; all Phase 2 tests use vitest |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | axios | Adds dependency for no real gain; project already uses native fetch patterns |
| Zod parsing | Manual JSON parsing | Zod gives runtime validation + type inference; already in project |

**Installation:**
```bash
# No new dependencies needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  agents/
    scout-agent.ts         # Real ScoutAgent implementation (NEW)
    stubs/
      stub-scout.ts        # Existing stub (kept as fallback data source)
    types.ts               # IScoutAgent interface (EXISTS)
    base-agent.ts          # BaseAgent abstract class (EXISTS)
  lib/
    unbrowse/
      client.ts            # Unbrowse HTTP client wrapper (NEW)
      types.ts             # Unbrowse request/response types (NEW)
      parser.ts            # Raw Unbrowse result -> Proposal[] parser (NEW)
tests/
  unit/
    scout-agent.test.ts    # Unit tests with mocked Unbrowse (NEW)
    unbrowse-parser.test.ts # Parser tests with fixture data (NEW)
```

### Pattern 1: Layered Fallback Strategy
**What:** ScoutAgent tries Unbrowse first, falls back to cache, then to stub data
**When to use:** Always -- Unbrowse is a local service that may not be running
**Example:**
```typescript
async discoverProposals(query: string): Promise<Proposal[]> {
  // Layer 1: Try Unbrowse live
  try {
    const raw = await this.unbrowseClient.resolveIntent(query);
    const proposals = parseUnbrowseResult(raw);
    if (proposals.length > 0) {
      this.cache = proposals; // Cache for next fallback
      return proposals;
    }
  } catch (err) {
    this.emitStatus('unbrowse-unavailable', `Falling back: ${err}`);
  }

  // Layer 2: Return cached data from last successful call
  if (this.cache.length > 0) {
    this.emitStatus('using-cache', `Returning ${this.cache.length} cached proposals`);
    return this.cache;
  }

  // Layer 3: Return hardcoded stub data (same as StubScoutAgent)
  this.emitStatus('using-stub', 'Returning stub proposals');
  return STUB_PROPOSALS;
}
```

### Pattern 2: Unbrowse Client Wrapper
**What:** Thin HTTP client encapsulating Unbrowse API details
**When to use:** Isolates Unbrowse protocol from Scout business logic; easy to mock in tests
**Example:**
```typescript
export class UnbrowseClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl = 'http://localhost:6969', timeoutMs = 15000) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async resolveIntent(intent: string, targetUrl?: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/v1/intent/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          params: targetUrl ? { url: targetUrl } : undefined,
          context: targetUrl ? { url: targetUrl } : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Unbrowse returned ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

### Pattern 3: Response Parser with Zod Validation
**What:** Parse varying Unbrowse response shapes into typed `Proposal[]`
**When to use:** Unbrowse returns arbitrary web data; we need to normalize it
**Example:**
```typescript
import { z } from 'zod';
import type { Proposal } from '../../types/proposals.js';

// Flexible schema matching what Unbrowse might return
const UnbrowseProposalSchema = z.object({
  title: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  requested_amount: z.union([z.number(), z.string()]).optional(),
  funding_amount: z.union([z.number(), z.string()]).optional(),
  team: z.string().optional(),
  team_info: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
});

export function parseUnbrowseResult(raw: unknown): Proposal[] {
  // Unbrowse result may be nested under .result or be a direct array
  const data = extractResultArray(raw);

  return data
    .map((item, idx) => {
      const parsed = UnbrowseProposalSchema.safeParse(item);
      if (!parsed.success) return null;
      const d = parsed.data;

      const title = d.title ?? d.name ?? `Proposal ${idx + 1}`;
      const description = d.description ?? d.summary ?? '';
      const amount = parseAmount(d.amount ?? d.requested_amount ?? d.funding_amount);
      const teamInfo = d.team ?? d.team_info ?? 'Unknown team';
      const sourceUrl = d.url ?? d.link;

      return {
        id: `unbrowse-${Date.now()}-${idx}`,
        title,
        description,
        requestedAmount: amount,
        teamInfo,
        sourceUrl,
      } satisfies Proposal;
    })
    .filter((p): p is Proposal => p !== null && p.title !== '');
}
```

### Pattern 4: Inject UnbrowseClient for Testability
**What:** Pass the client as a constructor argument to ScoutAgent
**When to use:** Enables mocking Unbrowse in unit tests without network calls
**Example:**
```typescript
export class ScoutAgent extends BaseAgent implements IScoutAgent {
  private readonly unbrowseClient: UnbrowseClient;
  private cache: Proposal[] = [];

  constructor(bus: AgentEventBus, unbrowseClient?: UnbrowseClient) {
    super('scout', bus);
    this.unbrowseClient = unbrowseClient ?? new UnbrowseClient(
      process.env.UNBROWSE_URL ?? 'http://localhost:6969'
    );
  }
  // ...
}
```

### Anti-Patterns to Avoid
- **Coupling Unbrowse protocol into ScoutAgent directly:** Keep the HTTP client separate. If Unbrowse API changes, only one file changes.
- **Throwing on Unbrowse failure:** The success criteria explicitly require graceful fallback. Never let Unbrowse unavailability break the pipeline.
- **Parsing without validation:** Unbrowse returns arbitrary web data. Always validate with Zod before trusting the shape.
- **Hardcoding target URLs:** Make the grant discovery URLs configurable (env vars or constructor params) so different grant platforms can be targeted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request timeouts | Manual promise race | `AbortController` + `AbortSignal.timeout()` | Built into Node.js, handles cleanup correctly |
| Response validation | typeof checks | Zod schemas | Already in project; handles nested/optional fields; type inference |
| Retry logic | Custom retry loop | Simple try/catch with fallback layers | Hackathon scope; layered fallback (live -> cache -> stub) is simpler and more reliable than retries |

**Key insight:** The Scout agent is fundamentally a thin adapter -- it wraps Unbrowse's HTTP API and normalizes data into the existing `Proposal` type. The complexity is in graceful degradation, not in the happy path.

## Common Pitfalls

### Pitfall 1: Unbrowse Not Running
**What goes wrong:** `fetch` to `localhost:6969` throws `ECONNREFUSED`, crashing the pipeline
**Why it happens:** Unbrowse is a separate local service started manually; may not be running in dev, tests, or demo
**How to avoid:** Always wrap Unbrowse calls in try/catch; implement the 3-layer fallback (live -> cache -> stub); check health before pipeline runs
**Warning signs:** Tests failing intermittently based on whether Unbrowse daemon is running

### Pitfall 2: Unbrowse Response Shape Varies
**What goes wrong:** Unbrowse returns different JSON shapes depending on the target site, resolution method (marketplace vs live capture vs DOM fallback), and data availability
**Why it happens:** Unbrowse auto-discovers APIs and extracts DOM data -- the output is not a fixed schema
**How to avoid:** Use flexible Zod schemas that accept multiple field name variations (`title` OR `name`, `amount` OR `requested_amount`). Extract result data with a helper that checks `.result`, `.data`, direct array, etc.
**Warning signs:** Parser returns empty arrays when Unbrowse clearly found data

### Pitfall 3: Unbrowse Timeout on First Call
**What goes wrong:** First call to Unbrowse takes 30+ seconds because it needs to do live browser capture (no cached skill)
**Why it happens:** The resolution pipeline: cache -> marketplace -> live capture -> DOM fallback. Live capture is slow.
**How to avoid:** Set a generous timeout (15-30 seconds) for Unbrowse calls. During demo, "warm up" by calling Scout once before the live presentation. Cache successful results.
**Warning signs:** First demo call hangs while subsequent calls are fast

### Pitfall 4: Demo Breaks Without Internet
**What goes wrong:** Unbrowse needs internet to browse target sites; offline or slow venue WiFi causes failures
**Why it happens:** Hackathon venues often have unreliable WiFi
**How to avoid:** The stub/cache fallback layer handles this. Also pre-populate cache by running a successful discovery before demo. Include `sourceUrl` field in stub data pointing to real URLs (even if data is cached) for authenticity.
**Warning signs:** All live Unbrowse calls fail at venue

### Pitfall 5: Registering Scout with GovernanceAgent
**What goes wrong:** Governance still uses `StubScoutAgent` because the wiring wasn't updated
**Why it happens:** GovernanceAgent takes `IScoutAgent` in constructor; need to swap the real agent in
**How to avoid:** Update any wiring/entry point code. The interface contract is already correct -- just pass `new ScoutAgent(bus)` instead of `new StubScoutAgent(bus)`.
**Warning signs:** Pipeline works but always returns the same 3 hardcoded proposals

## Code Examples

Verified patterns from the existing codebase:

### Existing IScoutAgent Interface (src/agents/types.ts)
```typescript
export interface IScoutAgent {
  discoverProposals(query: string): Promise<Proposal[]>;
}
```

### Existing Proposal Type (src/types/proposals.ts)
```typescript
export interface Proposal {
  id: string;
  title: string;
  description: string;
  requestedAmount: number;
  teamInfo: string;
  sourceUrl?: string;
}
```

### Existing BaseAgent Pattern (src/agents/base-agent.ts)
```typescript
export abstract class BaseAgent {
  readonly role: AgentRole;
  readonly keypair: Keypair;
  protected readonly bus: AgentEventBus;

  constructor(role: AgentRole, bus: AgentEventBus) {
    this.role = role;
    this.keypair = getWeb3Keypair(role);
    this.bus = bus;
  }

  protected emitStatus(status: string, detail?: string): void {
    this.bus.emit('agent:status', {
      agent: this.role,
      status,
      detail,
      timestamp: Date.now(),
    });
  }

  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
}
```

### Existing StubScoutAgent Data (to reuse as fallback)
```typescript
// These 3 proposals are the fallback data when Unbrowse is unavailable
const STUB_PROPOSALS: Proposal[] = [
  {
    id: 'prop-001',
    title: 'Solana DeFi Analytics Dashboard',
    description: 'Build a real-time analytics dashboard for Solana DeFi protocols...',
    requestedAmount: 5000,
    teamInfo: '3 developers with 2 years Solana experience',
  },
  {
    id: 'prop-002',
    title: 'Cross-chain Bridge Monitor',
    description: 'Monitor and alert on cross-chain bridge transactions for security...',
    requestedAmount: 8000,
    teamInfo: '5 developers, previously built Wormhole tooling',
  },
  {
    id: 'prop-003',
    title: 'Solana Mobile Wallet SDK',
    description: 'Open-source mobile wallet SDK for building Solana dApps...',
    requestedAmount: 12000,
    teamInfo: '4 mobile developers, 1 Solana core contributor',
  },
];
```

### Unbrowse Intent Resolution Call
```typescript
// POST http://localhost:6969/v1/intent/resolve
// Source: Unbrowse GitHub README + skill.md documentation
const response = await fetch('http://localhost:6969/v1/intent/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    intent: 'find active grant proposals for Solana ecosystem projects',
    params: { url: 'https://solana.org/grants' },
    context: { url: 'https://solana.org/grants' },
  }),
});
// Response: { skill_id, endpoint_id, result, available_endpoints, marketplace_match, captured }
```

### Grant Platform Targets for Intent Resolution
```typescript
// Realistic targets for Unbrowse to discover grant data from:
const GRANT_TARGETS = [
  { url: 'https://solana.org/grants', intent: 'find active Solana Foundation grant programs and funded projects' },
  { url: 'https://earn.superteam.fun/grants/', intent: 'list available Superteam grants with amounts and descriptions' },
  { url: 'https://dorahacks.io/grant/solana-1/buidl', intent: 'find funded projects from Solana DoraHacks grants' },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded stub data | Unbrowse live web discovery | Phase 3 | Real web data in pipeline instead of mock |
| StubScoutAgent only | ScoutAgent with fallback chain | Phase 3 | Resilient discovery with graceful degradation |

**Kept from Phase 2:**
- `StubScoutAgent` is NOT deleted -- its data is reused as the final fallback layer
- `IScoutAgent` interface is unchanged -- no API contract changes needed
- GovernanceAgent calls `scout.discoverProposals(query)` the same way

## Open Questions

1. **Unbrowse response shape for grant platforms**
   - What we know: Unbrowse returns a `result` field with extracted data; shape varies by site and resolution method
   - What's unclear: Exact structure when pointed at solana.org/grants vs DoraHacks vs Superteam Earn
   - Recommendation: Build flexible parser that handles multiple field name patterns; test against real Unbrowse output during implementation and adjust parser

2. **Multiple grant platform targets**
   - What we know: At least 3 viable targets exist (Solana Foundation, Superteam Earn, DoraHacks)
   - What's unclear: Which platform yields the best structured data through Unbrowse
   - Recommendation: Make target URLs configurable; try all targets and merge results; in tests, mock the Unbrowse response rather than depending on a specific site

3. **Unbrowse authentication**
   - What we know: Unbrowse uses local config at `~/.unbrowse/config.json` for API keys; `/v1/intent/resolve` may not require auth for local usage
   - What's unclear: Whether bearer token is needed for local calls
   - Recommendation: Support optional `UNBROWSE_API_KEY` env var; pass as Bearer token if set; default to no auth for local

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm vitest run tests/unit/scout-agent.test.ts --reporter=verbose` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCOUT-01 | Scout discovers proposals via Unbrowse intent resolution | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "calls Unbrowse" -x` | Wave 0 |
| SCOUT-02 | Scout calls `/v1/intent/resolve` with natural language intent | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "intent/resolve" -x` | Wave 0 |
| SCOUT-03 | Scout returns structured Proposal objects to Governance | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "returns Proposal" -x` | Wave 0 |
| FALLBACK | Scout falls back gracefully when Unbrowse unavailable | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "fallback" -x` | Wave 0 |
| PARSER | Unbrowse response correctly parsed into Proposal[] | unit | `pnpm vitest run tests/unit/unbrowse-parser.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/unit/scout-agent.test.ts tests/unit/unbrowse-parser.test.ts --reporter=verbose`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/scout-agent.test.ts` -- covers SCOUT-01, SCOUT-02, SCOUT-03, FALLBACK
- [ ] `tests/unit/unbrowse-parser.test.ts` -- covers PARSER (response normalization)
- [ ] No new framework install needed -- vitest already configured

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/agents/types.ts`, `src/agents/base-agent.ts`, `src/agents/stubs/stub-scout.ts`, `src/types/proposals.ts` -- defines the exact interface contract
- Existing codebase: `src/agents/governance-agent.ts` -- shows how Scout is called in the pipeline
- Existing codebase: `tests/unit/governance-pipeline.test.ts` -- shows testing patterns with mocked agents

### Secondary (MEDIUM confidence)
- [Unbrowse GitHub README](https://github.com/unbrowse-ai/unbrowse) -- `/v1/intent/resolve` endpoint, resolution pipeline, request format
- [Unbrowse skill.md](https://www.unbrowse.ai/skill.md) -- API endpoint details, request/response TypeScript interfaces
- [Solana Grants page](https://solana.org/grants) -- target data source structure (HubSpot forms, aggregate stats, RFP Airtable links)

### Tertiary (LOW confidence)
- Unbrowse response schema details -- documented interfaces may not exactly match runtime behavior; need to validate against real Unbrowse output during implementation
- Grant platform data availability -- actual data structure from Unbrowse crawling grant sites is untested

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all patterns established in Phase 2
- Architecture: HIGH -- IScoutAgent interface, BaseAgent, and event bus are already defined and tested
- Unbrowse integration: MEDIUM -- API endpoint documented but response parsing needs runtime validation
- Pitfalls: HIGH -- Unbrowse availability issues are well-understood; fallback strategy is clear

**Research date:** 2026-03-14
**Valid until:** 2026-03-21 (hackathon-scoped; Unbrowse API may evolve)
