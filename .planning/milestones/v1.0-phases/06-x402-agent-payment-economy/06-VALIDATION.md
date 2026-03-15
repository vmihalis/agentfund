---
phase: 6
slug: x402-agent-payment-economy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm test -- tests/unit/x402` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- tests/unit/x402`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | PAY-01 | unit | `pnpm test -- tests/unit/x402-middleware.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | PAY-03 | unit | `pnpm test -- tests/unit/x402-middleware.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | PAY-04 | unit | `pnpm test -- tests/unit/x402-client.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | SCOUT-04 | unit | `pnpm test -- tests/unit/scout-server.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | ANLZ-04 | unit | `pnpm test -- tests/unit/analyzer-server.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | PAY-02 | integration | `pnpm test -- tests/integration/x402-payment.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/x402-middleware.test.ts` — stubs for PAY-01, PAY-03
- [ ] `tests/unit/x402-client.test.ts` — stubs for PAY-04
- [ ] `tests/unit/scout-server.test.ts` — stubs for SCOUT-04
- [ ] `tests/unit/analyzer-server.test.ts` — stubs for ANLZ-04
- [ ] `tests/integration/x402-payment.test.ts` — stubs for PAY-02
- [ ] `pnpm add express @types/express` — Express is not yet a dependency

*Existing infrastructure covers Vitest framework and config.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| On-chain USDC transfer viewable on Solscan | PAY-02 | Requires checking external block explorer | Run demo, copy tx signature, verify at solscan.io/tx/{sig}?cluster=devnet |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
