---
phase: 11-live-dashboard-wiring
plan: 02
subsystem: api, payments, dashboard
tags: [x402, eventbus, proxy, payments, proposals, pipeline]

# Dependency graph
requires:
  - phase: 08-dashboard-ui
    provides: dashboard payments.ts, proposals-store.ts, pipeline.ts
  - phase: 09-e2e-demo
    provides: demo.ts with EventBus, activity log, voice server endpoints
provides:
  - addLivePayment + getAllPayments in payments.ts (live + demo combined)
  - updateProposalStage + mapPipelineStage re-export in proposals-store.ts
  - Voice server GET /api/payments endpoint (live x402 payment records)
  - Voice server GET /api/proposals/live endpoint (live pipeline proposal state)
  - Dashboard /api/payments proxy (merges live + demo payments)
  - Dashboard /api/proposals proxy (fetches live state, merges via updateProposalStage)
affects: [dashboard-ui, e2e-demo, live-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Voice server proxy pattern for dashboard routes (same as /api/activity)
    - EventBus-driven payment and proposal state tracking in demo.ts
    - Graceful degradation: dashboard falls back to demo/store data when voice server unavailable

key-files:
  created:
    - tests/unit/proposals-store-update.test.ts
  modified:
    - dashboard/src/lib/payments.ts
    - dashboard/src/lib/proposals-store.ts
    - dashboard/src/app/api/payments/route.ts
    - dashboard/src/app/api/proposals/route.ts
    - scripts/demo.ts
    - tests/unit/dashboard-payments.test.ts

key-decisions:
  - "Synthetic tx signatures for x402 discovery/evaluation payments since adapters don't expose lastTxSignature"
  - "VOICE_SERVER_URL env var + localhost:4003 fallback for both payment and proposal proxy routes"
  - "Live proposal tracking uses pipeline:step, pipeline:decision, and pipeline:funded events combined"

patterns-established:
  - "Voice server endpoint + dashboard proxy pattern: demo.ts adds Express route, dashboard fetches + merges"
  - "Graceful degradation: try voice server, catch error, return local data as fallback"

requirements-completed: [DASH-03, DASH-05, PAY-02]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 11 Plan 02: Live Dashboard Wiring Summary

**Live x402 payment history and governance pipeline stage tracking wired through EventBus to voice server endpoints to dashboard proxy routes with graceful fallback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T15:00:59Z
- **Completed:** 2026-03-15T15:05:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Live payment records flow from EventBus pipeline:funded and pipeline:step events to voice server /api/payments to dashboard proxy
- Proposals-store gained updateProposalStage() with mapPipelineStage wiring (previously orphaned function)
- Dashboard /api/proposals GET now fetches live proposal state from voice server and merges via updateProposalStage, closing the cross-process gap
- Both dashboard proxy routes degrade gracefully when voice server is unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Add live payment log and proposals-store stage updates (TDD RED)** - `0dd7654` (test)
2. **Task 1: Add live payment log and proposals-store stage updates (TDD GREEN)** - `f7087fe` (feat)
3. **Task 2: Wire voice server endpoints and dashboard proxies** - `990d38d` (feat)

**Plan metadata:** _pending_ (docs: complete plan)

_Note: Task 1 used TDD with RED (failing tests) then GREEN (implementation) commits._

## Files Created/Modified
- `dashboard/src/lib/payments.ts` - Added addLivePayment + getAllPayments (live + demo combined)
- `dashboard/src/lib/proposals-store.ts` - Added updateProposalStage, imported and re-exported mapPipelineStage
- `dashboard/src/app/api/payments/route.ts` - Proxy to voice server /api/payments, merges live + demo
- `dashboard/src/app/api/proposals/route.ts` - Proxy to voice server /api/proposals/live, merges into store
- `scripts/demo.ts` - Added payment log, live proposals state, /api/payments and /api/proposals/live endpoints
- `tests/unit/dashboard-payments.test.ts` - Added addLivePayment and getAllPayments tests
- `tests/unit/proposals-store-update.test.ts` - New test file for updateProposalStage + mapPipelineStage

## Decisions Made
- Synthetic tx signatures for x402 discovery/evaluation payments: adapters don't expose lastTxSignature, so pipeline:step completed events generate deterministic demo signatures (x402-discover-{timestamp}, x402-evaluate-{timestamp})
- Used VOICE_SERVER_URL env var with localhost:4003 fallback for both payment and proposal proxy routes, matching existing /api/activity pattern
- Live proposal tracking combines pipeline:step (stage transitions), pipeline:decision (evaluation data), and pipeline:funded (funding completion) events for comprehensive state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted x402 payment tracking for missing adapter.lastTxSignature**
- **Found during:** Task 2 (voice server endpoint wiring)
- **Issue:** Plan referenced scoutAdapter.lastTxSignature and analyzerAdapter.lastTxSignature, but X402ScoutAdapter and X402AnalyzerAdapter classes don't expose a lastTxSignature property
- **Fix:** Instead of reading adapter signatures, subscribed to pipeline:step completed events and generated synthetic demo signatures for discovery/evaluation payments. Treasury funding payments use real signatures from pipeline:funded events.
- **Files modified:** scripts/demo.ts
- **Verification:** grep confirms payment log population from pipeline events
- **Committed in:** 990d38d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- synthetic signatures serve the same purpose for demo/dashboard display. Real txSignatures flow correctly for treasury funding via pipeline:funded events.

## Issues Encountered
None beyond the adapter deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All dashboard live data paths are wired: activity feed (plan 01), payments, and proposals
- Phase 11 is complete once plan 01 summary is also finalized
- Dashboard shows real-time data when voice server is running, static demo data otherwise

## Self-Check: PASSED

All 7 files verified present. All 3 task commits verified in git log.

---
*Phase: 11-live-dashboard-wiring*
*Completed: 2026-03-15*
