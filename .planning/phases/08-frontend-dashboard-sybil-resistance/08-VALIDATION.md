---
phase: 8
slug: frontend-dashboard-sybil-resistance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts (root) — dashboard may need separate config |
| **Quick run command** | `pnpm test --filter dashboard` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --filter dashboard`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | DASH-01 | unit | `pnpm vitest run tests/unit/dashboard-agents-api.test.ts -x` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | DASH-02 | unit | `pnpm vitest run tests/unit/dashboard-treasury-api.test.ts -x` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | DASH-03 | unit | `pnpm vitest run tests/unit/dashboard-proposals.test.ts -x` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | DASH-04 | manual-only | Manual: start voice server, open dashboard, click Start Voice | N/A | ⬜ pending |
| 08-01-03 | 01 | 1 | DASH-05 | unit | `pnpm vitest run tests/unit/dashboard-payments.test.ts -x` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | SYBIL-01 | manual-only | Manual: load /submit, verify widget renders | N/A | ⬜ pending |
| 08-03-02 | 03 | 2 | SYBIL-02 | unit | `pnpm vitest run tests/unit/passport-gate.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `dashboard/` workspace setup with vitest configuration
- [ ] `tests/unit/dashboard-agents-api.test.ts` — API route returns 4 agents with correct Solscan links
- [ ] `tests/unit/dashboard-treasury-api.test.ts` — Treasury proxy returns TreasuryBalance shape
- [ ] `tests/unit/dashboard-proposals.test.ts` — Pipeline stage mapping logic
- [ ] `tests/unit/dashboard-payments.test.ts` — Payment history data shape
- [ ] `tests/unit/passport-gate.test.ts` — Gate blocks when isPassing is false, allows when true

*Note: DASH-04 (voice widget) and SYBIL-01 (Passport widget rendering) are manual-only because they depend on external services (ElevenLabs WebSocket, Human Passport API) and browser audio/wallet capabilities.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Voice widget connects and streams audio | DASH-04 | Requires ElevenLabs WebSocket and browser mic access | 1. Start voice server (`pnpm dev:voice`) 2. Open dashboard 3. Click Start Voice 4. Speak command 5. Verify response plays |
| Passport widget renders verification UI | SYBIL-01 | Requires Human Passport API key and browser wallet | 1. Open /submit page 2. Verify PassportScoreWidget renders 3. Verify submission form is hidden until verified |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
