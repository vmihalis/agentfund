# Phase 2: Agent Architecture & Governance Core - Research

**Researched:** 2026-03-14
**Domain:** TypeScript multi-agent coordination, typed event bus, pipeline orchestration, Claude API for decision summarization
**Confidence:** HIGH

## Summary

Phase 2 builds the coordination framework on top of Phase 1's blockchain foundation. The three deliverables are: (1) a `BaseAgent` abstract class providing keypair access, event bus connection, and standard lifecycle hooks; (2) a typed event bus for inter-agent communication and downstream observability; and (3) a `GovernanceAgent` that orchestrates the full funding pipeline (discover -> evaluate -> fund) and produces human-readable decision summaries.

The existing codebase already has the `AgentRole` type, `AgentConfig` definitions, `getWeb3Keypair()` for each role, and singleton `Connection`/`Umi` instances. Phase 2 extends this foundation with a `BaseAgent` abstract class that wraps these primitives, plus a typed `EventBus` that broadcasts all agent activity. The Governance Agent is the first concrete implementation -- it coordinates mock versions of Scout, Analyzer, and Treasury (whose real implementations come in Phases 3-5) to demonstrate the full pipeline.

The Anthropic SDK (`@anthropic-ai/sdk`) provides the Claude API integration for decision summarization. The SDK supports tool_use for structured output, enabling the Governance Agent to produce typed decision summaries with scores and reasoning. No framework like LangChain is needed -- the project explicitly excludes it. A simple orchestrator pattern with direct async method calls is the right approach for this hackathon scope.

**Primary recommendation:** Build the typed EventBus first, then BaseAgent (which depends on it), then GovernanceAgent. Use Node.js native `EventEmitter` wrapped in a generic TypeScript class for type safety. Keep agent interfaces simple -- each agent exposes a small set of typed async methods. The Governance Agent calls these directly (not via the event bus) for pipeline orchestration, and emits events for observability.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GOV-01 | Governance Agent coordinates the full funding pipeline: Scout discovers -> Analyzer evaluates -> Treasury funds | Orchestrator-Worker pattern: GovernanceAgent holds references to specialist agent interfaces and calls them sequentially. Stub implementations for Scout/Analyzer/Treasury return mock data in Phase 2; real implementations plug in during Phases 3-5. |
| GOV-02 | Governance Agent aggregates agent evaluations and makes final allocation decisions | Claude API (`@anthropic-ai/sdk`) with tool_use for structured output. Define a `FundingDecision` schema, force Claude to produce typed decisions with scores and allocations. The tool_choice pattern ensures structured JSON output. |
| GOV-04 | Governance Agent produces decision summaries with reasoning for each funding action | The Claude API response includes the reasoning as part of the structured output. Decision summaries are typed interfaces (`DecisionSummary`) containing proposal name, scores, reasoning text, and funding action (fund/reject/defer). |
</phase_requirements>

## Standard Stack

### Core (New for Phase 2)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 | Claude API for decision summarization | Direct SDK -- no LangChain wrapper. Provides tool_use for structured output. |
| `zod` | ^3.23 | Schema validation for agent messages and decisions | Used with Anthropic SDK's `betaZodTool` helper for type-safe structured output. Also validates event payloads. |
| `zod-to-json-schema` | ^3.23 | Convert Zod schemas to JSON Schema for Claude tools | Required by the tool_use pattern to define input schemas. |

### Existing (From Phase 1, still used)
| Library | Version | Purpose |
|---------|---------|---------|
| `@solana/web3.js` | 1.98.x | Keypair access for agents |
| Node.js `events` | built-in | Base for typed EventEmitter |
| `vitest` | ^4.1.0 | Test framework |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native EventEmitter wrapper | `eventemitter3` | eventemitter3 is faster but adds a dependency; native EventEmitter is sufficient for 4 agents |
| Direct Claude API | LangChain | LangChain is explicitly out of scope (REQUIREMENTS.md) -- unnecessary abstraction |
| Custom event bus | `ts-bus` or `mitt` | External libs add minimal value over a 30-line typed wrapper around native EventEmitter |
| Zod for schemas | io-ts or JSON Schema directly | Zod integrates with Anthropic SDK via `betaZodTool`, has the best DX |

**Installation:**
```bash
pnpm add @anthropic-ai/sdk zod zod-to-json-schema
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)
```
src/
  agents/
    base-agent.ts          # Abstract BaseAgent class
    governance-agent.ts    # GovernanceAgent concrete implementation
    types.ts               # Agent interfaces, event types, message types
    index.ts               # Public API barrel
  events/
    event-bus.ts           # Typed EventBus singleton
    event-types.ts         # All event type definitions
    index.ts               # Public API barrel
  lib/                     # (existing from Phase 1)
    keys.ts
    metaplex/
    solana/
  types/
    agents.ts              # (existing -- AgentRole, AgentConfig)
    proposals.ts           # Proposal, Evaluation, FundingDecision types
```

### Pattern 1: Typed EventBus via Generic Wrapper
**What:** A lightweight wrapper around Node.js `EventEmitter` that enforces compile-time type safety for event names and payloads.
**When to use:** All inter-agent communication and observability events.
**Example:**
```typescript
// src/events/event-bus.ts
import { EventEmitter } from 'events';

export class TypedEventBus<TEvents extends Record<string, any[]>> {
  private emitter = new EventEmitter();

  emit<K extends keyof TEvents & string>(
    event: K,
    ...args: TEvents[K]
  ): boolean {
    return this.emitter.emit(event, ...args);
  }

  on<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.on(event, listener as (...args: any[]) => void);
    return this;
  }

  off<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.off(event, listener as (...args: any[]) => void);
    return this;
  }

  once<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.once(event, listener as (...args: any[]) => void);
    return this;
  }

  removeAllListeners<K extends keyof TEvents & string>(event?: K): this {
    this.emitter.removeAllListeners(event);
    return this;
  }
}
```

### Pattern 2: BaseAgent Abstract Class
**What:** An abstract class that all agents implement, providing keypair, event bus connection, role identity, and standard lifecycle.
**When to use:** Every agent in the system (Scout, Analyzer, Treasury, Governance).
**Example:**
```typescript
// src/agents/base-agent.ts
import { Keypair } from '@solana/web3.js';
import { getWeb3Keypair } from '../lib/keys.js';
import { getConnection } from '../lib/solana/index.js';
import type { AgentRole } from '../types/agents.js';
import type { AgentEventBus } from '../events/event-types.js';

export abstract class BaseAgent {
  readonly role: AgentRole;
  readonly keypair: Keypair;
  protected readonly bus: AgentEventBus;

  constructor(role: AgentRole, bus: AgentEventBus) {
    this.role = role;
    this.keypair = getWeb3Keypair(role);
    this.bus = bus;
  }

  get publicKey() {
    return this.keypair.publicKey;
  }

  protected get connection() {
    return getConnection();
  }

  /** Emit a lifecycle event */
  protected emitStatus(status: string, detail?: string): void {
    this.bus.emit('agent:status', {
      agent: this.role,
      status,
      detail,
      timestamp: Date.now(),
    });
  }

  /** Initialize agent (connect, verify identity, etc.) */
  abstract initialize(): Promise<void>;

  /** Graceful shutdown */
  abstract shutdown(): Promise<void>;
}
```

### Pattern 3: Orchestrator-Worker for Governance Pipeline
**What:** The GovernanceAgent holds references to specialist agent interfaces and orchestrates them sequentially. It does NOT use the event bus for orchestration -- it calls agent methods directly. The event bus is for observability (broadcasting what happened for dashboard/logs).
**When to use:** The "fund this project" pipeline: discover -> evaluate -> decide -> fund.
**Why direct calls instead of event bus:** Event buses decouple producers from consumers, which is great for observability but bad for orchestration where you need to await results, handle errors, and maintain sequential flow. The Governance Agent needs to know the result of each step before proceeding to the next.
**Example:**
```typescript
// GovernanceAgent orchestration (simplified)
async executeFundingPipeline(request: FundingRequest): Promise<DecisionSummary> {
  this.emitStatus('pipeline:started', request.description);

  // Step 1: Discover proposals
  this.bus.emit('pipeline:step', { step: 'discover', status: 'started' });
  const proposals = await this.scout.discoverProposals(request.query);
  this.bus.emit('pipeline:step', { step: 'discover', status: 'completed', count: proposals.length });

  // Step 2: Evaluate each proposal
  const evaluations: Evaluation[] = [];
  for (const proposal of proposals) {
    this.bus.emit('pipeline:step', { step: 'evaluate', status: 'started', proposal: proposal.title });
    const evaluation = await this.analyzer.evaluateProposal(proposal);
    evaluations.push(evaluation);
    this.bus.emit('pipeline:step', { step: 'evaluate', status: 'completed', proposal: proposal.title, score: evaluation.overallScore });
  }

  // Step 3: Make funding decision (Claude API)
  const decision = await this.makeDecision(evaluations);
  this.bus.emit('pipeline:decision', decision);

  // Step 4: Execute funding for approved proposals
  for (const allocation of decision.allocations) {
    if (allocation.action === 'fund') {
      await this.treasury.executeFunding(allocation);
      this.bus.emit('pipeline:funded', allocation);
    }
  }

  return decision;
}
```

### Pattern 4: Agent Interfaces for Stub/Real Swap
**What:** Define TypeScript interfaces for each specialist agent. Phase 2 implements stubs returning mock data. Phases 3-5 implement real versions. The GovernanceAgent depends on the interface, not the concrete class.
**When to use:** Scout, Analyzer, Treasury agent references within GovernanceAgent.
**Example:**
```typescript
// src/agents/types.ts
export interface IScoutAgent {
  discoverProposals(query: string): Promise<Proposal[]>;
}

export interface IAnalyzerAgent {
  evaluateProposal(proposal: Proposal): Promise<Evaluation>;
}

export interface ITreasuryAgent {
  executeFunding(allocation: FundingAllocation): Promise<TransactionResult>;
  getBalance(): Promise<TreasuryBalance>;
}
```

### Pattern 5: Claude API for Structured Decision Output
**What:** Use the Anthropic SDK's tool_use mechanism to force Claude to produce a typed JSON decision summary. Define the schema as a Zod object, convert to JSON Schema, and pass as a tool.
**When to use:** GovernanceAgent decision-making step.
**Example:**
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const FundingDecisionSchema = z.object({
  summary: z.string().describe('Overall summary of funding decisions'),
  allocations: z.array(z.object({
    proposalTitle: z.string(),
    action: z.enum(['fund', 'reject', 'defer']),
    amount: z.number().optional(),
    reasoning: z.string().describe('Detailed explanation of why this decision was made'),
    scores: z.object({
      teamQuality: z.number().min(1).max(10),
      technicalFeasibility: z.number().min(1).max(10),
      impactPotential: z.number().min(1).max(10),
      budgetReasonableness: z.number().min(1).max(10),
    }),
  })),
  totalAllocated: z.number(),
  remainingBudget: z.number(),
});

type FundingDecision = z.infer<typeof FundingDecisionSchema>;

// Usage in GovernanceAgent
const client = new Anthropic();

const jsonSchema = zodToJsonSchema(FundingDecisionSchema, 'FundingDecision');
const schemaDefinition = (jsonSchema as any).definitions?.FundingDecision ?? jsonSchema;

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 2048,
  system: 'You are a funding governance agent. Analyze proposals and make allocation decisions.',
  messages: [{
    role: 'user',
    content: `Evaluate these proposals and decide funding allocations:\n${JSON.stringify(evaluations)}`,
  }],
  tools: [{
    name: 'submit_decision',
    description: 'Submit funding decisions for proposals',
    input_schema: schemaDefinition as Anthropic.Tool.InputSchema,
  }],
  tool_choice: { type: 'tool' as const, name: 'submit_decision' },
});

// Extract structured output from tool_use content block
const toolUseBlock = response.content.find(b => b.type === 'tool_use');
const decision = toolUseBlock?.input as FundingDecision;
```

### Anti-Patterns to Avoid
- **Using the event bus for orchestration:** Events are fire-and-forget. The Governance Agent needs to await results from each pipeline step. Use direct async method calls for orchestration, events for observability.
- **Tight coupling to concrete agent classes:** GovernanceAgent should depend on `IScoutAgent` interface, not `ScoutAgent` class. This enables stub implementations in Phase 2 and real implementations in Phases 3-5 without changing GovernanceAgent.
- **Global singleton agents:** Agents should be instantiated explicitly and passed their dependencies (bus, connection). This makes testing possible. Use a factory or composition root, not singletons.
- **Claude API calls without error handling:** The Anthropic API can fail (rate limits, network errors). Always wrap in try/catch with retry logic and fallback to a hardcoded decision for demo resilience.
- **Over-engineering the event bus:** This is a hackathon. 4 agents, <10 event types. A 30-line typed wrapper is sufficient. Do not build a full pub/sub system with persistence, replay, or ordering guarantees.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured output from Claude | Custom JSON parsing with regex | `tool_use` with `tool_choice` forced to a specific tool | Claude can always produce valid JSON when forced via tool_use. Regex parsing breaks on edge cases. |
| Schema validation | Manual type assertions | Zod schemas with `z.infer<>` | Compile-time types AND runtime validation in one definition. Catches invalid Claude output. |
| Event emitter typing | String-based events with `any` payloads | Generic `TypedEventBus<TEvents>` wrapper | Catches event name typos and payload mismatches at compile time. |
| Agent lifecycle management | Manual init/shutdown calls scattered across codebase | `BaseAgent.initialize()` / `BaseAgent.shutdown()` abstract methods | Consistent lifecycle across all 4 agents. |
| Decision summary formatting | String concatenation | Zod schema defining `DecisionSummary` + Claude structured output | Consistent structure, type-safe downstream consumption. |

**Key insight:** The coordination layer should be thin and typed. Each agent is a small class with 2-3 public methods. The Governance Agent orchestrates them via direct method calls. The event bus provides observability. Claude provides intelligence. Don't build abstractions that are bigger than the problem.

## Common Pitfalls

### Pitfall 1: Event Bus Becoming the Orchestration Layer
**What goes wrong:** Developers route all inter-agent communication through the event bus, creating implicit dependencies and making the pipeline flow impossible to follow or debug.
**Why it happens:** "Event-driven architecture" sounds right, but event buses decouple producers from consumers -- great for notifications, terrible for request-response orchestration.
**How to avoid:** The GovernanceAgent calls `scout.discoverProposals()` directly (not `bus.emit('discover')`). The bus is ONLY for broadcasting activity to observers (dashboard, logs). Pipeline flow is explicit async method calls.
**Warning signs:** `bus.emit()` calls that expect a response. Event handlers that trigger other events in chains. Difficulty tracing what happens after a "fund this project" request.

### Pitfall 2: Claude API Returning Unstructured Output
**What goes wrong:** Without `tool_choice`, Claude may return free-text instead of JSON, or JSON that doesn't match the expected schema.
**Why it happens:** By default, Claude produces natural language. Even with a JSON prompt, it may add explanations or use a different structure.
**How to avoid:** Always use `tool_choice: { type: 'tool', name: 'submit_decision' }` to force structured output. Validate the response with Zod (`FundingDecisionSchema.parse(toolUseBlock.input)`) before using it. Have a fallback hardcoded decision for demo resilience.
**Warning signs:** `tool_use` content block not found in response. `JSON.parse()` errors. Missing required fields in the decision object.

### Pitfall 3: Stub Agents Not Matching Real Interface
**What goes wrong:** Phase 2 stub agents (e.g., `StubScoutAgent`) return mock data with a different shape than the real agents in Phases 3-5, causing integration breakage later.
**Why it happens:** Stub implementation diverges from the interface as real agents are built.
**How to avoid:** Define the interfaces (`IScoutAgent`, `IAnalyzerAgent`, `ITreasuryAgent`) FIRST with exact return types. Both stubs and real implementations must satisfy the same interface. TypeScript's structural typing catches mismatches at compile time.
**Warning signs:** Real agent implementation requires changing the GovernanceAgent code. Interface and stub return types drift apart.

### Pitfall 4: Anthropic SDK API Key Not Configured
**What goes wrong:** Tests or runtime fail because `ANTHROPIC_API_KEY` environment variable is not set.
**Why it happens:** Phase 1 only needed `SOLANA_RPC_URL`. Phase 2 adds a new dependency on the Anthropic API.
**How to avoid:** Add `ANTHROPIC_API_KEY` to `.env.example`. Check for it at GovernanceAgent initialization and throw a clear error. Unit tests should mock the Anthropic client, not call the real API.
**Warning signs:** "Authentication error" from Anthropic SDK. Tests that require an API key to pass.

### Pitfall 5: Over-Engineering BaseAgent for Future Phases
**What goes wrong:** BaseAgent accumulates too many responsibilities (Umi access, token accounts, x402 endpoints) because developers try to anticipate Phases 3-7.
**Why it happens:** "We'll need it eventually" reasoning adds complexity before it's needed.
**How to avoid:** Phase 2 BaseAgent provides: keypair, event bus, connection, lifecycle methods. Nothing more. Phases 3-5 can extend the base class or add mixins if needed. YAGNI.
**Warning signs:** BaseAgent constructor taking 5+ parameters. Methods that no agent currently uses.

## Code Examples

Verified patterns from official sources and existing project code:

### Event Type Definitions
```typescript
// src/events/event-types.ts
import type { AgentRole } from '../types/agents.js';
import type { TypedEventBus } from './event-bus.js';

export interface AgentStatusEvent {
  agent: AgentRole;
  status: string;
  detail?: string;
  timestamp: number;
}

export interface PipelineStepEvent {
  step: 'discover' | 'evaluate' | 'decide' | 'fund';
  status: 'started' | 'completed' | 'failed';
  detail?: Record<string, unknown>;
}

export interface PipelineDecisionEvent {
  summary: string;
  allocations: Array<{
    proposalTitle: string;
    action: 'fund' | 'reject' | 'defer';
    reasoning: string;
  }>;
}

export type AgentEvents = {
  'agent:status': [AgentStatusEvent];
  'agent:error': [{ agent: AgentRole; error: string; timestamp: number }];
  'pipeline:step': [PipelineStepEvent];
  'pipeline:decision': [PipelineDecisionEvent];
  'pipeline:funded': [{ proposalTitle: string; amount: number; txSignature: string }];
};

export type AgentEventBus = TypedEventBus<AgentEvents>;
```

### Proposal and Evaluation Types
```typescript
// src/types/proposals.ts
export interface Proposal {
  id: string;
  title: string;
  description: string;
  requestedAmount: number;
  teamInfo: string;
  sourceUrl?: string;
}

export interface EvaluationScores {
  teamQuality: number;        // 1-10
  technicalFeasibility: number; // 1-10
  impactPotential: number;     // 1-10
  budgetReasonableness: number; // 1-10
}

export interface Evaluation {
  proposalId: string;
  proposalTitle: string;
  scores: EvaluationScores;
  overallScore: number;        // Weighted average
  reasoning: string;           // Human-readable explanation
  recommendation: 'fund' | 'reject' | 'defer';
}

export interface FundingAllocation {
  proposalId: string;
  proposalTitle: string;
  action: 'fund' | 'reject' | 'defer';
  amount?: number;             // In USDC (6 decimals)
  reasoning: string;
}

export interface DecisionSummary {
  timestamp: number;
  summary: string;             // Overall narrative
  allocations: FundingAllocation[];
  totalAllocated: number;
  remainingBudget: number;
}

export interface TransactionResult {
  success: boolean;
  signature?: string;          // Solana tx signature
  error?: string;
}

export interface TreasuryBalance {
  solBalance: number;
  usdcBalance: number;
  totalValueUsd: number;
}
```

### Stub Agent Implementations (Phase 2 only)
```typescript
// src/agents/stubs/stub-scout.ts
import type { IScoutAgent } from '../types.js';
import type { Proposal } from '../../types/proposals.js';

export class StubScoutAgent implements IScoutAgent {
  async discoverProposals(query: string): Promise<Proposal[]> {
    // Return mock proposals for pipeline testing
    return [
      {
        id: 'prop-001',
        title: 'Solana DeFi Analytics Dashboard',
        description: 'Build a real-time analytics dashboard for Solana DeFi protocols',
        requestedAmount: 5000,
        teamInfo: '3 developers with 2 years Solana experience',
      },
      {
        id: 'prop-002',
        title: 'Cross-chain Bridge Monitor',
        description: 'Monitor and alert on cross-chain bridge transactions for security',
        requestedAmount: 8000,
        teamInfo: '5 developers, previously built Wormhole tooling',
      },
    ];
  }
}
```

### Anthropic Client Initialization
```typescript
// Source: https://github.com/anthropics/anthropic-sdk-typescript README
import Anthropic from '@anthropic-ai/sdk';

// Client reads ANTHROPIC_API_KEY from environment automatically
const client = new Anthropic();

// For structured output via tool_use:
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 2048,
  messages: [{ role: 'user', content: prompt }],
  tools: [{ name: 'submit_decision', description: '...', input_schema: schema }],
  tool_choice: { type: 'tool', name: 'submit_decision' },
});

// Extract tool_use block
const block = response.content.find(b => b.type === 'tool_use');
if (block && block.type === 'tool_use') {
  const decision = block.input; // Typed via schema
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| String-based EventEmitter | Generic typed wrapper class | TypeScript 4.1+ (template literal types) | Full compile-time safety for event names and payloads |
| LangChain for agent orchestration | Direct SDK calls + custom orchestrator | 2025-2026 trend | Less abstraction, fewer dependencies, faster iteration |
| JSON.parse for Claude output | `tool_use` with `tool_choice` forced | Claude API 2024+ | Guaranteed structured output, no parsing failures |
| Untyped agent interfaces | Zod schemas for runtime + compile-time validation | zod v3.x (2023+) | Single source of truth for types and validation |
| Heavy framework-based agents | Lightweight typed classes with async methods | 2025 multi-agent pattern shift | Simpler, more debuggable, fewer framework-imposed constraints |

**Deprecated/outdated:**
- LangChain for this use case: Explicitly excluded in project REQUIREMENTS.md. Unnecessary abstraction layer.
- solana-agent-kit: Explicitly excluded. Does not support mpl-agent-registry.
- `client.beta.messages.toolRunner()`: While available for auto-running tools, overkill for single-tool structured output. Direct `messages.create()` with `tool_choice` is simpler.

## Open Questions

1. **Claude Model Selection for Decision Summarization**
   - What we know: `claude-sonnet-4-20250514` is the latest Sonnet model. Haiku would be faster/cheaper but less capable for nuanced reasoning.
   - What's unclear: Whether the hackathon demo needs fast responses (Haiku) or detailed reasoning (Sonnet).
   - Recommendation: Use Sonnet for decision quality. The latency difference (1-3s vs 0.5s) is acceptable for a demo. Make the model name configurable via env var (`ANTHROPIC_MODEL`).

2. **Event Bus Persistence for Dashboard**
   - What we know: The dashboard (Phase 8) needs to show agent activity history.
   - What's unclear: Whether events should be persisted (in-memory array, file, or database) or if the dashboard will only show live events.
   - Recommendation: Add a simple in-memory event log to the EventBus (array of recent events with a max length). This is sufficient for a hackathon demo. No database needed.

3. **Stub Data Realism**
   - What we know: Phase 2 uses stub agents with mock data. Phases 3-5 replace with real implementations.
   - What's unclear: How realistic the mock proposals should be for demo purposes.
   - Recommendation: Use 2-3 realistic-sounding grant proposals as mock data. This makes the Phase 2 demo compelling even before real agents are integrated.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists from Phase 1) |
| Quick run command | `pnpm exec vitest run tests/unit/ --reporter=verbose` |
| Full suite command | `pnpm exec vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GOV-01 | GovernanceAgent orchestrates full pipeline (discover -> evaluate -> fund) | unit (mocked agents) | `pnpm exec vitest run tests/unit/governance-pipeline.test.ts -x` | No -- Wave 0 |
| GOV-02 | GovernanceAgent aggregates evaluations and produces allocation decisions | unit (mocked Claude) | `pnpm exec vitest run tests/unit/governance-decision.test.ts -x` | No -- Wave 0 |
| GOV-04 | Decision summaries contain reasoning for each funding action | unit (mocked Claude) | `pnpm exec vitest run tests/unit/decision-summary.test.ts -x` | No -- Wave 0 |
| -- | EventBus type safety and emit/on behavior | unit | `pnpm exec vitest run tests/unit/event-bus.test.ts -x` | No -- Wave 0 |
| -- | BaseAgent abstract class and lifecycle | unit | `pnpm exec vitest run tests/unit/base-agent.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run tests/unit/ --reporter=verbose`
- **Per wave merge:** `pnpm exec vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/event-bus.test.ts` -- typed EventBus emit/on/off behavior
- [ ] `tests/unit/base-agent.test.ts` -- BaseAgent lifecycle and keypair access
- [ ] `tests/unit/governance-pipeline.test.ts` -- covers GOV-01 (full pipeline with stubs)
- [ ] `tests/unit/governance-decision.test.ts` -- covers GOV-02 (decision aggregation with mocked Claude)
- [ ] `tests/unit/decision-summary.test.ts` -- covers GOV-04 (summary format and reasoning)
- [ ] `ANTHROPIC_API_KEY` added to `.env.example`

**Note:** All Phase 2 tests should be UNIT tests that mock the Anthropic client. No real API calls in automated tests. The Anthropic SDK can be mocked by injecting a fake client that returns predetermined tool_use responses. Integration testing with the real Claude API is manual.

## Sources

### Primary (HIGH confidence)
- [Anthropic SDK TypeScript GitHub](https://github.com/anthropics/anthropic-sdk-typescript) -- SDK API patterns, tool_use, streaming, betaZodTool helper, v0.78.0
- [Anthropic SDK Structured Output Issue #816](https://github.com/anthropics/anthropic-sdk-typescript/issues/816) -- Confirmed tool_use with tool_choice is the standard pattern for structured output
- Existing project codebase -- `src/types/agents.ts`, `src/lib/keys.ts`, `src/lib/solana/`, `src/lib/metaplex/`, `tests/` patterns from Phase 1

### Secondary (MEDIUM confidence)
- [MakerX: Type-Safe EventEmitter in Node.js](https://blog.makerx.com.au/a-type-safe-event-emitter-in-node-js/) -- Generic `TypedEventEmitter<TEvents>` wrapper pattern verified
- [This Dot Labs: Event Bus in TypeScript](https://www.thisdot.co/blog/how-to-implement-an-event-bus-in-typescript) -- EventBus implementation patterns
- [OneUpTime: Type-Safe Event Emitters in TypeScript](https://oneuptime.com/blog/post/2026-01-30-how-to-build-type-safe-event-emitters-in-typescript/view) -- 2026 best practices for typed events
- [SitePoint: Agentic Design Patterns 2026](https://www.sitepoint.com/the-definitive-guide-to-agentic-design-patterns-in-2026/) -- Orchestrator-Worker pattern for multi-agent systems
- [Microsoft: AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) -- Coordinator pattern: central agent decomposes and dispatches sub-tasks

### Tertiary (LOW confidence)
- None -- all findings cross-verified with at least two sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @anthropic-ai/sdk verified from GitHub README, zod is industry standard
- Architecture: HIGH -- Orchestrator-Worker pattern well-documented, typed EventBus pattern verified from multiple sources, project codebase already establishes the module patterns
- Pitfalls: HIGH -- event bus misuse is a well-known anti-pattern, Claude structured output pattern verified from SDK issue tracker
- Code examples: MEDIUM -- Anthropic SDK patterns verified from README; exact tool_choice behavior confirmed but TypeScript type casting for input_schema may need adjustment during implementation

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- architecture patterns are stable, Anthropic SDK may update but tool_use API is stable)
