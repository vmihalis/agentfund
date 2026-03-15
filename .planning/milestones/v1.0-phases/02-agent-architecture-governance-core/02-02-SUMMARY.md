---
phase: 02-agent-architecture-governance-core
plan: 02
subsystem: agents
tags: [governance-agent, claude-api, anthropic-sdk, zod, tool-use, pipeline-orchestration, decision-making, fallback]

# Dependency graph
requires:
  - phase: 02-agent-architecture-governance-core
    plan: 01
    provides: "TypedEventBus, BaseAgent, IScoutAgent/IAnalyzerAgent/ITreasuryAgent interfaces, stub implementations, domain types"
provides:
  - "GovernanceAgent class with executeFundingPipeline and makeDecision methods"
  - "Claude API integration with tool_use for structured funding decisions"
  - "Score-threshold fallback when Claude API is unavailable"
  - "FundingRequest interface for pipeline invocation"
  - "23 unit tests covering pipeline, decisions, and summaries"
affects: [03-scout-agent, 04-analyzer-agent, 05-treasury-agent, 08-dashboard]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk 0.78.0", "zod 4.3.6", "zod-to-json-schema 3.25.1"]
  patterns: [claude-tool-use-structured-output, fallback-decision-heuristic, proposal-cache-for-budget-awareness, zod-v4-native-json-schema]

key-files:
  created:
    - src/agents/governance-agent.ts
    - tests/unit/governance-pipeline.test.ts
    - tests/unit/governance-decision.test.ts
    - tests/unit/decision-summary.test.ts
  modified:
    - src/agents/index.ts
    - .env.example
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Used Zod v4 native z.toJSONSchema() instead of zod-to-json-schema package -- zod-to-json-schema produces empty schemas with Zod v4, but native method works correctly"
  - "GovernanceAgent.proposalCache stores proposals discovered during pipeline for fallback budget-aware decisions -- Evaluation type does not carry requestedAmount"
  - "Fallback threshold set at overallScore >= 7 with proposals sorted by score descending -- simple heuristic for demo resilience"

patterns-established:
  - "Claude tool_use with tool_choice forced: pass Zod schema via z.toJSONSchema(), force tool_choice to named tool, extract tool_use block from response"
  - "Fallback decision pattern: try Claude API in try/catch, fall back to deterministic heuristic with clear reasoning mentioning API unavailability"
  - "Proposal cache pattern: GovernanceAgent caches discovered proposals as Map<id, Proposal> for budget-aware fallback decisions"

requirements-completed: [GOV-01, GOV-02, GOV-04]

# Metrics
duration: 6min
completed: 2026-03-14
---

# Phase 2 Plan 02: Governance Agent Pipeline Summary

**GovernanceAgent orchestrating discover->evaluate->decide->fund pipeline with Claude API tool_use for structured decisions and score-threshold fallback**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-14T21:11:15Z
- **Completed:** 2026-03-14T21:17:49Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- GovernanceAgent class (398 lines) orchestrating the full funding pipeline: discover proposals via Scout, evaluate via Analyzer, decide via Claude API, fund via Treasury
- Claude API integration using tool_use with forced tool_choice for guaranteed structured JSON output, validated with Zod schemas
- Score-threshold fallback heuristic (overallScore >= 7) with budget awareness when Claude API is unavailable
- Pipeline emits typed events at each step (discover, evaluate, decide, fund) for downstream observability
- 23 unit tests across 3 test files covering pipeline orchestration (GOV-01), decision aggregation (GOV-02), and decision summary format (GOV-04)
- All tests use mocked Anthropic client -- zero real API calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and update env config** - `d13700b` (chore)
2. **Task 2 (TDD RED): Failing tests for GovernanceAgent** - `0677dd3` (test)
3. **Task 2 (TDD GREEN): GovernanceAgent implementation** - `4f4d742` (feat)

## Files Created/Modified
- `src/agents/governance-agent.ts` - GovernanceAgent class with executeFundingPipeline, makeDecision, makeFallbackDecision, and proposalCache
- `src/agents/index.ts` - Updated barrel to re-export GovernanceAgent and FundingRequest
- `tests/unit/governance-pipeline.test.ts` - 7 tests for pipeline orchestration, event emission, empty proposals handling (GOV-01)
- `tests/unit/governance-decision.test.ts` - 6 tests for Claude API calls, fallback decisions, budget constraints (GOV-02)
- `tests/unit/decision-summary.test.ts` - 10 tests for summary format, reasoning, totals, timestamps (GOV-04)
- `.env.example` - Added ANTHROPIC_API_KEY and ANTHROPIC_MODEL entries
- `package.json` - Added @anthropic-ai/sdk, zod, zod-to-json-schema dependencies
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used Zod v4 native `z.toJSONSchema()` instead of `zod-to-json-schema` package because `zod-to-json-schema` produces empty schemas with Zod v4 (the installed version is 4.3.6, not 3.x). The `zod-to-json-schema` package remains as a declared dependency per the plan.
- Added `proposalCache` (Map<string, Proposal>) to GovernanceAgent to enable budget-aware fallback decisions. The `Evaluation` type does not carry `requestedAmount`, so the cache bridges the gap between pipeline discovery and fallback decision-making.
- Fallback threshold set at overallScore >= 7 (plan specified), with proposals sorted by score descending and allocated until budget runs out.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used Zod v4 native toJSONSchema instead of zod-to-json-schema**
- **Found during:** Task 1 verification / Task 2 implementation
- **Issue:** `zod-to-json-schema` produces empty `{}` schemas when used with Zod v4 (installed as 4.3.6). The library is designed for Zod v3.
- **Fix:** Used `z.toJSONSchema(schema, { target: 'draft-07' })` from Zod v4's built-in JSON Schema conversion. Produces correct, complete schemas.
- **Files modified:** src/agents/governance-agent.ts
- **Verification:** Tests pass with correct tool_use schema; TypeScript compiles cleanly
- **Committed in:** 4f4d742 (Task 2 GREEN commit)

**2. [Rule 2 - Missing Critical] Added proposalCache for budget-aware fallback decisions**
- **Found during:** Task 2 implementation
- **Issue:** `makeDecision` receives `Evaluation[]` and `budget`, but `Evaluation` does not carry `requestedAmount`. The fallback decision logic needs proposal amounts to respect budget constraints.
- **Fix:** Added `proposalCache` (Map<string, Proposal>) to GovernanceAgent. Populated during `executeFundingPipeline` when proposals are discovered. Tests that call `makeDecision` directly populate the cache in beforeEach.
- **Files modified:** src/agents/governance-agent.ts, tests/unit/governance-decision.test.ts, tests/unit/decision-summary.test.ts
- **Verification:** Fallback budget constraint tests pass -- totalAllocated respects available budget
- **Committed in:** 4f4d742 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both essential for correctness. Zod v4 native method is a drop-in replacement. Proposal cache is a minimal addition for budget-aware fallback. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required

ANTHROPIC_API_KEY is required for Claude API decision-making (but not for tests). To configure:
1. Visit console.anthropic.com -> API Keys -> Create Key
2. Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env`
3. Optionally set `ANTHROPIC_MODEL=claude-haiku-4-20250514` for faster/cheaper responses

All tests run without an API key (fully mocked).

## Next Phase Readiness
- GovernanceAgent is ready to orchestrate real Scout (Phase 3), Analyzer (Phase 4), and Treasury (Phase 5) agents
- Stub agents can be swapped for real implementations without changing GovernanceAgent code (interface-based dependency injection)
- Pipeline event emission provides the observability foundation for the dashboard (Phase 8)
- Fallback decision logic ensures the system degrades gracefully without Claude API access

## Self-Check: PASSED

- All 8 files verified present on disk
- All 3 task commits (d13700b, 0677dd3, 4f4d742) verified in git log
- 23/23 new tests passing
- 47/47 total tests passing (full suite)
- TypeScript compiles with zero errors

---
*Phase: 02-agent-architecture-governance-core*
*Completed: 2026-03-14*
