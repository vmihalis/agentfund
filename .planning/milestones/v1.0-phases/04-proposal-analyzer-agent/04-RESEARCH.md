# Phase 4: Proposal Analyzer Agent - Research

**Researched:** 2026-03-14
**Domain:** Claude API structured evaluation, Anthropic SDK tool_use, AI-powered scoring rubric
**Confidence:** HIGH

## Summary

Phase 4 replaces the `StubAnalyzerAgent` (created in Phase 2) with a real `AnalyzerAgent` that calls the Claude API to evaluate proposals and return structured, scored assessments. The existing architecture already defines `IAnalyzerAgent` interface (`evaluateProposal(proposal: Proposal): Promise<Evaluation>`), the `Evaluation` type with four scoring dimensions (teamQuality, technicalFeasibility, impactPotential, budgetReasonableness), and the `BaseAgent` abstract class. The Analyzer must implement these contracts using Claude API for intelligent evaluation.

The GovernanceAgent in Phase 2 already establishes the exact Claude API + tool_use pattern needed: define a Zod schema for structured output, convert to JSON Schema via `z.toJSONSchema()`, call `client.messages.create()` with a forced `tool_choice`, extract the `tool_use` block, and validate with Zod. The AnalyzerAgent follows this identical pattern -- the only difference is the prompt (evaluation rubric instead of funding decisions) and the output schema (Evaluation scores instead of FundingDecision allocations).

This phase is architecturally simple because no new libraries, no new infrastructure, and no new patterns are needed. Everything is already in place from Phase 2. The main engineering work is: (1) crafting an effective evaluation prompt/rubric for Claude, (2) building the AnalyzerAgent class following the established BaseAgent pattern, (3) wiring the Anthropic client with fallback when the API is unavailable, and (4) writing unit tests with mocked Anthropic client following the governance-decision test pattern.

**Primary recommendation:** Build `AnalyzerAgent` extending `BaseAgent` implementing `IAnalyzerAgent`, using the same Claude API + tool_use + Zod pattern already proven in `GovernanceAgent`. Inject `Anthropic` client for testability. Fall back to heuristic scoring when the API is unavailable. Export from `src/agents/index.ts` as drop-in replacement for `StubAnalyzerAgent`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLZ-01 | Proposal Analyzer evaluates proposals using Claude API with structured scoring rubric | GovernanceAgent already demonstrates Claude API + tool_use + Zod structured output pattern; AnalyzerAgent uses same pattern with evaluation-specific schema and rubric prompt |
| ANLZ-02 | Evaluation includes explained reasoning (why fund/reject) visible to humans | Evaluation type already has `reasoning: string` and `recommendation: 'fund' | 'reject' | 'defer'`; Claude prompt instructs detailed reasoning for each score dimension |
| ANLZ-03 | Analyzer scores proposals on: team quality, technical feasibility, impact potential, budget reasonableness | EvaluationScores type already defines all four dimensions as `number` (1-10); Zod schema enforces this structure in Claude tool_use response |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.78.0 | Claude API calls for proposal evaluation | Already installed; GovernanceAgent uses it; proven tool_use pattern |
| zod | ^4.3.6 | Schema definition + validation + JSON Schema conversion | Already installed; Zod v4 `z.toJSONSchema()` proven in GovernanceAgent |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.0 | Unit testing with mocked Anthropic client | Already configured; test pattern established in governance-decision.test.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tool_use for structured output | JSON mode / output_config.format | tool_use is already proven in GovernanceAgent; consistency matters more than novelty |
| Zod v4 z.toJSONSchema() | zod-to-json-schema package | zod-to-json-schema produces empty schemas with Zod v4 (documented in STATE.md decision [02-02]) |
| Injected Anthropic client | Global singleton | Injection enables test mocking (proven pattern in governance tests) |

**Installation:**
```bash
# No new dependencies needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  agents/
    analyzer-agent.ts       # Real AnalyzerAgent implementation (NEW)
    stubs/
      stub-analyzer.ts      # Existing stub (kept for reference + fallback data)
    types.ts                # IAnalyzerAgent interface (EXISTS, unchanged)
    base-agent.ts           # BaseAgent abstract class (EXISTS, unchanged)
    index.ts                # Re-export AnalyzerAgent (UPDATE)
tests/
  unit/
    analyzer-agent.test.ts  # Unit tests with mocked Anthropic client (NEW)
```

### Pattern 1: Claude API tool_use for Structured Evaluation (from GovernanceAgent)
**What:** Define a Zod schema matching the `Evaluation` type, convert to JSON Schema, call Claude with forced tool_choice, extract and validate the response
**When to use:** Every `evaluateProposal()` call
**Example:**
```typescript
// Source: Established pattern from src/agents/governance-agent.ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const EvaluationOutputSchema = z.object({
  scores: z.object({
    teamQuality: z.number().min(1).max(10).describe('Team quality score 1-10'),
    technicalFeasibility: z.number().min(1).max(10).describe('Technical feasibility score 1-10'),
    impactPotential: z.number().min(1).max(10).describe('Impact potential score 1-10'),
    budgetReasonableness: z.number().min(1).max(10).describe('Budget reasonableness score 1-10'),
  }),
  reasoning: z.string().describe('Detailed human-readable explanation of the evaluation'),
  recommendation: z.enum(['fund', 'reject', 'defer']).describe('Overall funding recommendation'),
});

// Convert to JSON Schema using Zod v4 native method (NOT zod-to-json-schema)
const jsonSchema = z.toJSONSchema(EvaluationOutputSchema, { target: 'draft-07' });

const response = await this.client.messages.create({
  model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: EVALUATION_SYSTEM_PROMPT,
  messages: [{ role: 'user', content: formatProposalForEvaluation(proposal) }],
  tools: [{
    name: 'submit_evaluation',
    description: 'Submit a structured evaluation of the proposal',
    input_schema: jsonSchema as Anthropic.Tool.InputSchema,
  }],
  tool_choice: { type: 'tool' as const, name: 'submit_evaluation' },
});

// Extract tool_use block (same pattern as GovernanceAgent)
const toolUseBlock = response.content.find(block => block.type === 'tool_use');
if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
  throw new Error('No tool_use block in Claude response');
}

const parsed = EvaluationOutputSchema.parse(toolUseBlock.input);
```

### Pattern 2: AnalyzerAgent Class Structure (mirrors ScoutAgent pattern)
**What:** Extend BaseAgent, implement IAnalyzerAgent, inject Anthropic client, add fallback
**When to use:** The class definition
**Example:**
```typescript
export class AnalyzerAgent extends BaseAgent implements IAnalyzerAgent {
  private readonly client: Anthropic;

  constructor(bus: AgentEventBus, client?: Anthropic) {
    super('analyzer', bus);
    this.client = client ?? new Anthropic();
  }

  async initialize(): Promise<void> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[AnalyzerAgent] ANTHROPIC_API_KEY not set -- will use fallback scoring');
    }
    this.emitStatus('initialized', 'AnalyzerAgent ready');
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'AnalyzerAgent stopped');
  }

  async evaluateProposal(proposal: Proposal): Promise<Evaluation> {
    this.emitStatus('evaluating', `Analyzing: ${proposal.title}`);
    try {
      return await this.evaluateWithClaude(proposal);
    } catch {
      return this.evaluateWithFallback(proposal);
    }
  }
}
```

### Pattern 3: Fallback Heuristic Scoring (mirrors GovernanceAgent fallback)
**What:** When Claude API is unavailable, return deterministic scores based on proposal content heuristics
**When to use:** API key missing, rate limit, network error, response parse failure
**Example:**
```typescript
private evaluateWithFallback(proposal: Proposal): Evaluation {
  // Simple heuristic: score based on content presence/length
  const scores: EvaluationScores = {
    teamQuality: proposal.teamInfo.length > 20 ? 7 : 5,
    technicalFeasibility: proposal.description.length > 100 ? 7 : 5,
    impactPotential: 6,
    budgetReasonableness: proposal.requestedAmount > 0 && proposal.requestedAmount < 50000 ? 7 : 5,
  };

  const overallScore = (scores.teamQuality + scores.technicalFeasibility +
    scores.impactPotential + scores.budgetReasonableness) / 4;

  return {
    proposalId: proposal.id,
    proposalTitle: proposal.title,
    scores,
    overallScore,
    reasoning: `Auto-evaluated (Claude API unavailable): ...`,
    recommendation: overallScore >= 6 ? 'fund' : 'reject',
  };
}
```

### Pattern 4: Evaluation Prompt Engineering
**What:** System prompt defining the scoring rubric and user message formatting the proposal
**When to use:** The Claude API call
**Example:**
```typescript
const EVALUATION_SYSTEM_PROMPT =
  'You are a proposal evaluation agent for a Solana ecosystem grant fund. ' +
  'Evaluate proposals rigorously on four dimensions, each scored 1-10:\n' +
  '- Team Quality: experience, track record, team size and composition\n' +
  '- Technical Feasibility: is the proposed technology realistic and achievable?\n' +
  '- Impact Potential: how much value does this create for the Solana ecosystem?\n' +
  '- Budget Reasonableness: is the requested amount justified for the scope?\n\n' +
  'Provide detailed, specific reasoning referencing the proposal content. ' +
  'Be honest and critical -- not every proposal deserves funding.';

function formatProposalForEvaluation(proposal: Proposal): string {
  return `Evaluate this grant proposal:\n\n` +
    `Title: ${proposal.title}\n` +
    `Description: ${proposal.description}\n` +
    `Requested Amount: $${proposal.requestedAmount}\n` +
    `Team: ${proposal.teamInfo}\n` +
    (proposal.sourceUrl ? `Source: ${proposal.sourceUrl}\n` : '') +
    `\nProvide your structured evaluation.`;
}
```

### Anti-Patterns to Avoid
- **Duplicating Anthropic SDK patterns:** The GovernanceAgent already proves the tool_use + Zod pattern. Copy the exact same mechanical flow, only changing the schema and prompt.
- **Not injecting the Anthropic client:** Must accept optional `Anthropic` constructor parameter for test mocking (same as GovernanceAgent).
- **Omitting fallback scoring:** API may be rate-limited, missing key, or down. Always return a valid Evaluation even without Claude.
- **Hardcoding the model string:** Use `process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'` (same as GovernanceAgent).
- **Using zod-to-json-schema:** The project decision is to use `z.toJSONSchema()` from Zod v4 (the zod-to-json-schema package produces empty schemas with Zod v4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured Claude output | Custom JSON parsing of free-text | tool_use + forced tool_choice + Zod validation | Guarantees schema compliance; proven in GovernanceAgent |
| JSON Schema generation | Manual JSON Schema objects | `z.toJSONSchema(schema, { target: 'draft-07' })` | Zod v4 native; keeps schema and validation in sync |
| Proposal scoring logic | Custom NLP/regex scoring | Claude API with rubric prompt | LLM evaluation is the entire point of this agent |
| Response validation | typeof/instanceof checks | Zod `.parse()` on tool_use input | Already in project; type-safe; good error messages |

**Key insight:** The AnalyzerAgent is mechanically identical to GovernanceAgent's Claude API integration -- different schema, different prompt, same flow. No new patterns needed.

## Common Pitfalls

### Pitfall 1: ANTHROPIC_API_KEY Not Set
**What goes wrong:** `new Anthropic()` looks for `ANTHROPIC_API_KEY` env var; throws or produces auth errors
**Why it happens:** Environment not configured, especially in tests or fresh clones
**How to avoid:** Check for API key in `initialize()`, warn but don't throw. Always have fallback scoring. In tests, mock the Anthropic client entirely.
**Warning signs:** Tests fail with auth errors; need to set env vars for unit tests to pass

### Pitfall 2: Claude Returns Scores Outside 1-10 Range
**What goes wrong:** Claude returns 0, 11, or float scores that don't match expected integer range
**Why it happens:** Claude follows instructions loosely; may use 0-based or percentage scales
**How to avoid:** Use Zod `.min(1).max(10)` constraints in the schema. Clamp in post-processing if needed. The prompt should explicitly state "score 1-10 (integer)".
**Warning signs:** Zod parse fails on valid-looking Claude responses

### Pitfall 3: Inconsistent Evaluation Results
**What goes wrong:** Same proposal gets wildly different scores on repeated evaluations
**Why it happens:** Claude's non-deterministic nature; temperature defaults
**How to avoid:** Not a real problem for hackathon demo. If consistency matters, set `temperature: 0` (not currently used in GovernanceAgent either). For demo purposes, variability is acceptable.
**Warning signs:** Repeated pipeline runs show large score variance

### Pitfall 4: Reasoning Text Too Long or Too Short
**What goes wrong:** Claude produces a 3-word reasoning or a 2000-word essay
**Why it happens:** No length guidance in prompt
**How to avoid:** Prompt should ask for "2-4 sentences of specific reasoning for each score dimension." The `max_tokens: 1024` constraint also bounds output length.
**Warning signs:** Dashboard rendering issues with very long reasoning text

### Pitfall 5: Forgetting to Wire AnalyzerAgent into GovernanceAgent
**What goes wrong:** GovernanceAgent still uses StubAnalyzerAgent; all evaluations return hardcoded scores
**Why it happens:** GovernanceAgent takes `IAnalyzerAgent` in constructor; wiring code needs updating
**How to avoid:** Update any orchestration/wiring code to pass `new AnalyzerAgent(bus)` instead of `new StubAnalyzerAgent(bus)`. The interface is identical -- it's a drop-in replacement.
**Warning signs:** All proposals get exactly 7/8/6/7 scores (the stub values)

## Code Examples

Verified patterns from the existing codebase:

### Existing IAnalyzerAgent Interface (src/agents/types.ts)
```typescript
export interface IAnalyzerAgent {
  evaluateProposal(proposal: Proposal): Promise<Evaluation>;
}
```

### Existing Evaluation Type (src/types/proposals.ts)
```typescript
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
```

### Existing StubAnalyzerAgent Pattern (src/agents/stubs/stub-analyzer.ts)
```typescript
// This is the exact contract the real AnalyzerAgent must satisfy
export class StubAnalyzerAgent extends BaseAgent implements IAnalyzerAgent {
  constructor(bus: AgentEventBus) {
    super('analyzer', bus);
  }

  async evaluateProposal(proposal: Proposal): Promise<Evaluation> {
    this.emitStatus('evaluating', `Analyzing: ${proposal.title}`);
    const scores = {
      teamQuality: 7,
      technicalFeasibility: 8,
      impactPotential: 6,
      budgetReasonableness: 7,
    };
    const overallScore =
      (scores.teamQuality + scores.technicalFeasibility +
        scores.impactPotential + scores.budgetReasonableness) / 4;
    const recommendation = overallScore >= 6 ? 'fund' : 'reject';
    return {
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      scores,
      overallScore,
      reasoning: `Proposal "${proposal.title}" demonstrates...`,
      recommendation: recommendation as 'fund' | 'reject' | 'defer',
    };
  }
}
```

### GovernanceAgent Claude API Call Pattern (src/agents/governance-agent.ts)
```typescript
// This is the mechanical pattern to replicate in AnalyzerAgent
const jsonSchema = z.toJSONSchema(FundingDecisionSchema, { target: 'draft-07' });

const response = await this.client.messages.create({
  model,
  max_tokens: 2048,
  system: 'You are a funding governance agent...',
  messages: [{ role: 'user', content: evaluationSummary }],
  tools: [{
    name: 'submit_decision',
    description: 'Submit funding allocation decisions...',
    input_schema: jsonSchema as Anthropic.Tool.InputSchema,
  }],
  tool_choice: { type: 'tool' as const, name: 'submit_decision' },
});

const toolUseBlock = response.content.find(block => block.type === 'tool_use');
if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
  throw new Error('No tool_use block in Claude response');
}

const parsed = FundingDecisionSchema.parse(toolUseBlock.input);
```

### GovernanceAgent Test Pattern -- Mocked Anthropic Client (tests/unit/governance-decision.test.ts)
```typescript
// This test pattern is directly reusable for AnalyzerAgent tests
let mockAnthropicClient: { messages: { create: ReturnType<typeof vi.fn> } };

mockAnthropicClient = {
  messages: {
    create: vi.fn().mockResolvedValue({
      content: [{
        type: 'tool_use',
        id: 'test-call',
        name: 'submit_evaluation',
        input: {
          scores: { teamQuality: 8, technicalFeasibility: 7, impactPotential: 9, budgetReasonableness: 6 },
          reasoning: 'Strong team with proven Solana track record...',
          recommendation: 'fund',
        },
      }],
    }),
  },
};

const agent = new AnalyzerAgent(bus, mockAnthropicClient as any);
```

### Module Mock Pattern for Keys + Solana (from scout-agent.test.ts)
```typescript
// Required in every agent test file
vi.mock('../../src/lib/keys.js', () => {
  const mockKeypairs: Record<string, Keypair> = {
    scout: Keypair.generate(),
    analyzer: Keypair.generate(),
    treasury: Keypair.generate(),
    governance: Keypair.generate(),
  };
  return { getWeb3Keypair: (role: string) => mockKeypairs[role] };
});

vi.mock('../../src/lib/solana/index.js', () => ({
  getConnection: () => ({ rpcEndpoint: 'https://mock.devnet.solana.com' }),
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| StubAnalyzerAgent (hardcoded scores) | AnalyzerAgent with Claude API | Phase 4 | Real AI evaluation instead of static scores |
| No Claude API in Analyzer | tool_use with Zod structured output | Phase 4 | Scoring rubric enforced by schema |

**Kept from Phase 2:**
- `StubAnalyzerAgent` is NOT deleted -- kept as reference and potential fallback data pattern
- `IAnalyzerAgent` interface is unchanged -- no API contract changes needed
- GovernanceAgent calls `analyzer.evaluateProposal(proposal)` the same way
- Evaluation and EvaluationScores types are unchanged

## Open Questions

1. **Evaluation prompt tuning**
   - What we know: The four scoring dimensions are defined; Claude needs a rubric prompt
   - What's unclear: Exact prompt wording for consistent, useful evaluations
   - Recommendation: Start with the system prompt from the Code Examples section; iterate based on output quality during testing. Not critical for hackathon -- any reasonable prompt works.

2. **Score weighting for overallScore**
   - What we know: StubAnalyzerAgent uses simple average ((t+f+i+b)/4); Evaluation type says "Weighted average"
   - What's unclear: Whether the four dimensions should be weighted equally or with different weights
   - Recommendation: Use equal weights (simple average) for hackathon simplicity. The prompt can instruct Claude to weigh dimensions, but the `overallScore` calculation should be deterministic on our side.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm vitest run tests/unit/analyzer-agent.test.ts --reporter=verbose` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLZ-01 | Analyzer calls Claude API with proposal and returns structured Evaluation with scores | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "calls Claude" --reporter=verbose` | Wave 0 |
| ANLZ-02 | Evaluation includes human-readable reasoning explaining scores | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "reasoning" --reporter=verbose` | Wave 0 |
| ANLZ-03 | Evaluation scores proposals on all four dimensions (team, tech, impact, budget) | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "scores" --reporter=verbose` | Wave 0 |
| FALLBACK | Analyzer falls back to heuristic scoring when Claude API unavailable | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "fallback" --reporter=verbose` | Wave 0 |
| INTERFACE | AnalyzerAgent implements IAnalyzerAgent interface | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "IAnalyzerAgent" --reporter=verbose` | Wave 0 |
| EVENTS | AnalyzerAgent emits status events via event bus | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "status" --reporter=verbose` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/unit/analyzer-agent.test.ts --reporter=verbose`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/analyzer-agent.test.ts` -- covers ANLZ-01, ANLZ-02, ANLZ-03, FALLBACK, INTERFACE, EVENTS
- [ ] No new framework install needed -- vitest already configured

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/agents/governance-agent.ts` -- proves Claude API + tool_use + Zod v4 `z.toJSONSchema()` pattern; exact mechanical template for AnalyzerAgent
- Existing codebase: `src/agents/stubs/stub-analyzer.ts` -- defines the exact Evaluation return shape and interface contract
- Existing codebase: `src/agents/types.ts` -- IAnalyzerAgent interface definition
- Existing codebase: `src/types/proposals.ts` -- Proposal, Evaluation, EvaluationScores type definitions
- Existing codebase: `tests/unit/governance-decision.test.ts` -- mocked Anthropic client test pattern
- Existing codebase: `tests/unit/scout-agent.test.ts` -- agent test pattern with mocked keys/solana

### Secondary (MEDIUM confidence)
- [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- confirms tool_use + strict mode for guaranteed schema compliance
- [Anthropic Tool Use docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) -- tool_choice parameter, tool definition format

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; everything already installed and proven in GovernanceAgent
- Architecture: HIGH -- identical pattern to GovernanceAgent's Claude API integration; IAnalyzerAgent interface and Evaluation types already defined
- Pitfalls: HIGH -- well-understood from GovernanceAgent experience; API fallback pattern already proven
- Test strategy: HIGH -- governance-decision.test.ts provides exact template for mocking Anthropic client

**Research date:** 2026-03-14
**Valid until:** 2026-03-28 (stable -- no new libraries or APIs involved)
