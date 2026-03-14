---
phase: 2
slug: agent-architecture-governance-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `pnpm exec vitest run tests/unit/ --reporter=verbose` |
| **Full suite command** | `pnpm exec vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run tests/unit/ --reporter=verbose`
- **After every plan wave:** Run `pnpm exec vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | -- | unit | `pnpm exec vitest run tests/unit/event-bus.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | -- | unit | `pnpm exec vitest run tests/unit/base-agent.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | GOV-01 | unit | `pnpm exec vitest run tests/unit/governance-pipeline.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 0 | GOV-02 | unit | `pnpm exec vitest run tests/unit/governance-decision.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 0 | GOV-04 | unit | `pnpm exec vitest run tests/unit/decision-summary.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-xx-xx | 01 | 1 | -- | unit | `pnpm exec vitest run tests/unit/event-bus.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-xx-xx | 01 | 1 | -- | unit | `pnpm exec vitest run tests/unit/base-agent.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-xx-xx | 02 | 2 | GOV-01 | unit | `pnpm exec vitest run tests/unit/governance-pipeline.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-xx-xx | 02 | 2 | GOV-02 | unit | `pnpm exec vitest run tests/unit/governance-decision.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-xx-xx | 02 | 2 | GOV-04 | unit | `pnpm exec vitest run tests/unit/decision-summary.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/event-bus.test.ts` — typed EventBus emit/on/off behavior
- [ ] `tests/unit/base-agent.test.ts` — BaseAgent lifecycle and keypair access
- [ ] `tests/unit/governance-pipeline.test.ts` — covers GOV-01 (full pipeline with stubs)
- [ ] `tests/unit/governance-decision.test.ts` — covers GOV-02 (decision aggregation with mocked Claude)
- [ ] `tests/unit/decision-summary.test.ts` — covers GOV-04 (summary format and reasoning)
- [ ] `ANTHROPIC_API_KEY` added to `.env.example`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude decision quality | GOV-02 | Requires real API call and human judgment | Run `pnpm exec ts-node scripts/test-governance.ts` with real API key, verify reasoning quality |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
