---
phase: 5
slug: treasury-manager-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm test -- --run tests/unit/treasury-agent.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- --run tests/unit/treasury-agent.test.ts`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TREAS-01 | unit | `pnpm test -- --run tests/unit/treasury-agent.test.ts -t "balance"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | TREAS-02 | unit + integration | `pnpm test -- --run tests/unit/treasury-agent.test.ts -t "transfer"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | TREAS-05 | unit | `pnpm test -- --run tests/unit/treasury-agent.test.ts -t "status"` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | TREAS-03 | unit + integration | `pnpm test -- --run tests/unit/treasury-dlmm.test.ts -t "create"` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | TREAS-04 | unit + integration | `pnpm test -- --run tests/unit/treasury-dlmm.test.ts -t "remove"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/treasury-agent.test.ts` — stubs for TREAS-01, TREAS-02, TREAS-05
- [ ] `tests/unit/treasury-dlmm.test.ts` — stubs for TREAS-03, TREAS-04
- [ ] `pnpm install @meteora-ag/dlmm @coral-xyz/anchor bn.js decimal.js` — new dependencies for DLMM

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verify tx signature on Solscan | TREAS-02 | Requires visual confirmation on block explorer | Execute transfer, copy tx sig, open on solscan.io?cluster=devnet |
| Confirm DLMM pool on devnet | TREAS-03 | Devnet pool availability may vary | Check Meteora devnet UI for created position |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
