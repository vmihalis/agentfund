---
phase: 9
slug: end-to-end-demo-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm test -- --reporter=verbose tests/integration/e2e-demo.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- tests/unit/x402-adapters.test.ts tests/unit/activity-log.test.ts -x`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | DEMO-01 | unit | `pnpm test -- tests/unit/x402-adapters.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | DEMO-03 | unit | `pnpm test -- tests/unit/activity-log.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | DEMO-01, DEMO-02 | integration | `pnpm test -- tests/integration/e2e-demo.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/x402-adapters.test.ts` — stubs for x402 Scout/Analyzer adapter wiring (DEMO-01, DEMO-02)
- [ ] `tests/unit/activity-log.test.ts` — stubs for activity log EventBus -> entries (DEMO-03)
- [ ] `tests/integration/e2e-demo.test.ts` — stubs for full pipeline with stub agents (DEMO-01)

*Existing infrastructure covers framework — vitest is already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Solscan link clickable in UI | DEMO-02 | Requires browser + Solana devnet | Open dashboard, run demo, click tx link in activity feed |
| Voice command triggers pipeline | DEMO-01 | Requires microphone/audio | Speak "Find promising Solana projects" and verify pipeline starts |
| Multi-agent coordination visible to observers | DEMO-03 | Requires visual inspection | Watch dashboard activity feed during demo for agent communication |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
