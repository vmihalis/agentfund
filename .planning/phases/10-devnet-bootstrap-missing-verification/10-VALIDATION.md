---
phase: 10
slug: devnet-bootstrap-missing-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run tests/integration/wallet-setup.test.ts tests/integration/agent-registration.test.ts tests/integration/collection-creation.test.ts tests/integration/x402-payment.test.ts --reporter=verbose` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds (integration tests hit devnet) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/integration/wallet-setup.test.ts tests/integration/agent-registration.test.ts tests/integration/collection-creation.test.ts tests/integration/x402-payment.test.ts --reporter=verbose`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | IDENT-02 | integration | `pnpm vitest run tests/integration/wallet-setup.test.ts --reporter=verbose` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | IDENT-01, IDENT-04 | integration | `pnpm vitest run tests/integration/agent-registration.test.ts tests/integration/collection-creation.test.ts --reporter=verbose` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | IDENT-03 | unit+integration | `pnpm vitest run tests/unit/identity-verification.test.ts tests/integration/agent-registration.test.ts --reporter=verbose` | ✅ | ⬜ pending |
| 10-01-04 | 01 | 1 | PAY-02 | integration | `pnpm vitest run tests/integration/x402-payment.test.ts --reporter=verbose` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 1 | SCOUT-01, SCOUT-02, SCOUT-03 | unit | `pnpm vitest run tests/unit/scout-agent.test.ts tests/unit/unbrowse-parser.test.ts --reporter=verbose` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All test files already exist with `describe.skipIf` guards that auto-run once preconditions (funded wallets, registration.json) are met.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deployer wallet funded via web faucet | IDENT-02 (prereq) | External web service interaction | Visit https://faucet.solana.com, paste deployer address, request 5 SOL, verify with `solana balance <address> --url devnet` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
