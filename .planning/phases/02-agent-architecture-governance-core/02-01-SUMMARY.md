---
phase: 02-agent-architecture-governance-core
plan: 01
subsystem: agents
tags: [event-bus, typescript, base-agent, stubs, proposals, typed-events]

# Dependency graph
requires:
  - phase: 01-solana-foundation-agent-identity
    provides: "AgentRole type, getWeb3Keypair(), getConnection() singleton"
provides:
  - "TypedEventBus generic class with compile-time event safety"
  - "AgentEventBus type alias for agent-specific events"
  - "Proposal, Evaluation, FundingAllocation, DecisionSummary, TransactionResult, TreasuryBalance domain types"
  - "BaseAgent abstract class with keypair, bus, connection, lifecycle"
  - "IScoutAgent, IAnalyzerAgent, ITreasuryAgent interfaces"
  - "StubScoutAgent, StubAnalyzerAgent, StubTreasuryAgent mock implementations"
affects: [02-02-governance-agent, 03-scout-agent, 04-analyzer-agent, 05-treasury-agent, 06-payment-middleware]

# Tech tracking
tech-stack:
  added: []
  patterns: [typed-event-bus, base-agent-abstract-class, interface-first-stubs]

key-files:
  created:
    - src/types/proposals.ts
    - src/events/event-bus.ts
    - src/events/event-types.ts
    - src/events/index.ts
    - src/agents/types.ts
    - src/agents/base-agent.ts
    - src/agents/stubs/stub-scout.ts
    - src/agents/stubs/stub-analyzer.ts
    - src/agents/stubs/stub-treasury.ts
    - src/agents/index.ts
    - tests/unit/event-bus.test.ts
    - tests/unit/base-agent.test.ts
  modified: []

key-decisions:
  - "EventEmitter.removeAllListeners(undefined) does not clear all listeners -- added explicit undefined check in TypedEventBus wrapper"
  - "StubScoutAgent returns 3 mock proposals (not 2) for richer pipeline testing"

patterns-established:
  - "TypedEventBus<TEvents>: generic wrapper over Node.js EventEmitter for compile-time event safety"
  - "BaseAgent abstract class: all agents extend this for keypair, bus, connection, lifecycle"
  - "Interface-first design: IScoutAgent/IAnalyzerAgent/ITreasuryAgent defined before stubs, ensuring real implementations match"
  - "vi.mock for keys/connection: unit tests mock getWeb3Keypair and getConnection to avoid filesystem/network deps"

requirements-completed: [GOV-01]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 2 Plan 01: Agent Coordination Foundation Summary

**TypedEventBus with compile-time safety, BaseAgent abstract class, 3 agent interfaces, and 3 stub implementations with 20 unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T21:04:30Z
- **Completed:** 2026-03-14T21:08:24Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- TypedEventBus generic class providing emit/on/off/once/removeAllListeners with compile-time type checking
- Proposal domain types (Proposal, Evaluation, FundingAllocation, DecisionSummary, TransactionResult, TreasuryBalance) matching RESEARCH.md definitions
- BaseAgent abstract class with keypair access, event bus connection, Solana Connection, and lifecycle hooks
- IScoutAgent, IAnalyzerAgent, ITreasuryAgent interfaces with exact typed method signatures
- Three stub implementations (StubScoutAgent, StubAnalyzerAgent, StubTreasuryAgent) returning realistic mock data
- 20 unit tests across 2 test files, all passing with clean TypeScript compilation

## Task Commits

Each task was committed atomically:

1. **Task 1: Type definitions, TypedEventBus, and event types** - `84852c6` (feat)
2. **Task 2: BaseAgent abstract class, agent interfaces, and stub implementations** - `01d82d3` (feat)

## Files Created/Modified
- `src/types/proposals.ts` - Proposal, Evaluation, FundingAllocation, DecisionSummary, TransactionResult, TreasuryBalance domain types
- `src/events/event-bus.ts` - Generic TypedEventBus class wrapping Node.js EventEmitter
- `src/events/event-types.ts` - AgentStatusEvent, PipelineStepEvent, PipelineDecisionEvent, AgentEvents map, AgentEventBus alias
- `src/events/index.ts` - Barrel re-export for events module
- `src/agents/types.ts` - IScoutAgent, IAnalyzerAgent, ITreasuryAgent interfaces
- `src/agents/base-agent.ts` - Abstract BaseAgent class with keypair, bus, connection, lifecycle
- `src/agents/stubs/stub-scout.ts` - StubScoutAgent returning 3 realistic mock proposals
- `src/agents/stubs/stub-analyzer.ts` - StubAnalyzerAgent returning mock evaluations with hardcoded scores
- `src/agents/stubs/stub-treasury.ts` - StubTreasuryAgent returning mock transaction results and balance
- `src/agents/index.ts` - Barrel re-export for agents module
- `tests/unit/event-bus.test.ts` - 8 tests for TypedEventBus emit/on/once/off/removeAllListeners
- `tests/unit/base-agent.test.ts` - 12 tests for BaseAgent lifecycle, stubs, and interface compliance

## Decisions Made
- EventEmitter.removeAllListeners(undefined) does not behave the same as removeAllListeners() with no arguments -- added explicit undefined check in TypedEventBus to handle both cases correctly
- StubScoutAgent returns 3 mock proposals instead of the 2 shown in RESEARCH.md examples, providing richer pipeline test data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed removeAllListeners(undefined) behavior**
- **Found during:** Task 1 (TypedEventBus implementation)
- **Issue:** Node.js EventEmitter.removeAllListeners(undefined) does NOT clear all listeners -- only removeAllListeners() with no arguments does
- **Fix:** Added explicit `if (event === undefined)` check to call removeAllListeners() without arguments when event is undefined
- **Files modified:** src/events/event-bus.ts
- **Verification:** Test "removeAllListeners without argument clears all events" passes
- **Committed in:** 84852c6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All agent interfaces and stubs are ready for GovernanceAgent (Plan 02-02) to orchestrate
- TypedEventBus and AgentEventBus provide the observability infrastructure for the funding pipeline
- Stub agents can be swapped for real implementations in Phases 3-5 without changing interface contracts

## Self-Check: PASSED

- All 13 files verified present on disk
- Both task commits (84852c6, 01d82d3) verified in git log
- 20/20 tests passing
- TypeScript compiles with zero errors

---
*Phase: 02-agent-architecture-governance-core*
*Completed: 2026-03-14*
