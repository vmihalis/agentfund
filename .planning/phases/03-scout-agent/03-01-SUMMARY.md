---
phase: 03-scout-agent
plan: 01
subsystem: agents
tags: [unbrowse, fetch, zod, scout, web-data, fallback, http-client]

# Dependency graph
requires:
  - phase: 02-agent-architecture-governance-core
    provides: BaseAgent, IScoutAgent interface, AgentEventBus, Proposal type, StubScoutAgent
provides:
  - UnbrowseClient HTTP wrapper with resolveIntent() and healthCheck()
  - Zod-validated response parser normalizing Unbrowse data into Proposal[]
  - ScoutAgent with 3-layer fallback (live -> cache -> stub)
  - STUB_PROPOSALS named export for reuse as fallback data
  - GRANT_TARGETS configurable grant platform targets
affects: [04-analyzer-agent, 06-x402-payments, 07-voice-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [constructor-injection, 3-layer-fallback, flexible-zod-parsing, AbortController-timeout]

key-files:
  created:
    - src/lib/unbrowse/types.ts
    - src/lib/unbrowse/client.ts
    - src/lib/unbrowse/parser.ts
    - src/lib/unbrowse/index.ts
    - src/agents/scout-agent.ts
    - tests/unit/unbrowse-parser.test.ts
    - tests/unit/scout-agent.test.ts
  modified:
    - src/agents/stubs/stub-scout.ts
    - src/agents/index.ts

key-decisions:
  - "Nullable Zod unions for amount fields -- Unbrowse may return null for numeric fields, added .nullable() to z.union([z.number(), z.string()])"
  - "Explicit Proposal typing instead of satisfies -- TypeScript strict mode flags sourceUrl optional vs undefined mismatch with satisfies keyword"
  - "Extracted STUB_PROPOSALS as named export from stub-scout.ts -- both StubScoutAgent and ScoutAgent reference the same fallback data"

patterns-established:
  - "Constructor injection: UnbrowseClient injected into ScoutAgent for testability"
  - "3-layer fallback: live service -> cached results -> stub data guarantees pipeline never breaks"
  - "Flexible Zod parsing: passthrough schemas with multiple field name variations for unpredictable API responses"
  - "AbortController timeout: native fetch timeout pattern with cleanup via finally block"

requirements-completed: [SCOUT-01, SCOUT-02, SCOUT-03]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 3 Plan 01: Scout Agent Summary

**ScoutAgent with Unbrowse intent resolution, Zod-validated response parser, and 3-layer fallback (live -> cache -> stub) replacing StubScoutAgent**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T21:44:20Z
- **Completed:** 2026-03-14T21:49:17Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- UnbrowseClient wraps Unbrowse /v1/intent/resolve with timeout, Bearer auth, and health checking
- Flexible Zod parser normalizes varying Unbrowse response shapes (alternative field names, nested structures, string amounts) into typed Proposal[]
- ScoutAgent implements IScoutAgent with 3-layer fallback: live Unbrowse -> cached results -> STUB_PROPOSALS
- 33 new tests (20 parser/client + 13 ScoutAgent) with full suite at 80 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Unbrowse client library with types, HTTP client, and response parser** - `76eff00` (feat)
2. **Task 2: ScoutAgent with 3-layer fallback and Governance wiring** - `87088dc` (feat)

_Both tasks followed TDD: tests written first (RED), implementation added (GREEN), TypeScript strict mode fix (REFACTOR)._

## Files Created/Modified
- `src/lib/unbrowse/types.ts` - UnbrowseRequest, UnbrowseResponse, GrantTarget interfaces and GRANT_TARGETS constant
- `src/lib/unbrowse/client.ts` - UnbrowseClient class with resolveIntent() and healthCheck() methods
- `src/lib/unbrowse/parser.ts` - parseUnbrowseResult, parseAmount, extractResultArray with Zod validation
- `src/lib/unbrowse/index.ts` - Barrel export for unbrowse library
- `src/agents/scout-agent.ts` - ScoutAgent extending BaseAgent, implementing IScoutAgent with 3-layer fallback
- `src/agents/index.ts` - Added ScoutAgent export alongside existing agent exports
- `src/agents/stubs/stub-scout.ts` - Extracted STUB_PROPOSALS as named export for reuse
- `tests/unit/unbrowse-parser.test.ts` - 20 tests covering parser normalization and client HTTP interactions
- `tests/unit/scout-agent.test.ts` - 13 tests covering fallback chain, events, lifecycle, interface compliance

## Decisions Made
- **Nullable Zod unions for amounts:** Unbrowse may return `null` for numeric fields; added `.nullable()` to `z.union([z.number(), z.string()])` to prevent safeParse rejections
- **Explicit Proposal typing over satisfies:** TypeScript strict mode flags `sourceUrl: string | undefined` vs optional property mismatch when using `satisfies Proposal`; switched to explicit `const proposal: Proposal` with conditional `sourceUrl` assignment
- **STUB_PROPOSALS extraction:** Moved hardcoded proposals from inline in `StubScoutAgent.discoverProposals()` to a named `STUB_PROPOSALS` export so both stub and real agents share the same fallback data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod schema rejecting null amount values**
- **Found during:** Task 1 (Parser implementation)
- **Issue:** `z.union([z.number(), z.string()])` rejects `null`, causing items with `amount: null` to fail Zod safeParse
- **Fix:** Added `.nullable()` to all amount field schemas
- **Files modified:** src/lib/unbrowse/parser.ts
- **Verification:** Test "handles NaN and invalid amount values gracefully" passes
- **Committed in:** 76eff00 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript strict mode error with satisfies keyword**
- **Found during:** Task 2 (Full TypeScript check)
- **Issue:** `satisfies Proposal` infers `sourceUrl: string | undefined` which is incompatible with `Proposal`'s optional `sourceUrl?: string`
- **Fix:** Replaced `.map().filter()` with explicit for-loop, typed `const proposal: Proposal`, conditionally assigned `sourceUrl`
- **Files modified:** src/lib/unbrowse/parser.ts
- **Verification:** `pnpm exec tsc --noEmit` passes with zero errors
- **Committed in:** 87088dc (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. Unbrowse is optional (ScoutAgent falls back gracefully when unavailable).

## Next Phase Readiness
- ScoutAgent is a drop-in replacement for StubScoutAgent via IScoutAgent interface
- GovernanceAgent can use `new ScoutAgent(bus)` instead of `new StubScoutAgent(bus)` with no code changes
- Pipeline degradation is tested: live Unbrowse -> cache -> stub data flow verified
- Analyzer agent (Phase 4) and Treasury agent (Phase 5) can proceed independently

---
*Phase: 03-scout-agent*
*Completed: 2026-03-14*
