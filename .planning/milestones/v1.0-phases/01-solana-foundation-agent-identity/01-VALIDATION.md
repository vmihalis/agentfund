---
phase: 1
slug: solana-foundation-agent-identity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TS-first, native ESM, fast) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `pnpm exec vitest run --reporter=verbose` |
| **Full suite command** | `pnpm exec vitest run` |
| **Estimated runtime** | ~15 seconds (unit), ~45 seconds (integration with devnet) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | IDENT-02 | integration | `pnpm exec vitest run tests/integration/wallet-setup.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | IDENT-03 | unit | `pnpm exec vitest run tests/unit/identity-verification.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | IDENT-04 | integration | `pnpm exec vitest run tests/integration/collection-creation.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | IDENT-01 | integration | `pnpm exec vitest run tests/integration/agent-registration.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@types/node` dev dependency installation
- [ ] `vitest.config.ts` configuration file with TypeScript support and dotenv loading
- [ ] `tests/unit/identity-verification.test.ts` — PDA derivation and verification (IDENT-03, offline)
- [ ] `tests/integration/wallet-setup.test.ts` — devnet balance and ATA checks (IDENT-02)
- [ ] `tests/integration/collection-creation.test.ts` — devnet collection verification (IDENT-04)
- [ ] `tests/integration/agent-registration.test.ts` — devnet PDA state verification (IDENT-01)
- [ ] `tests/helpers/setup.ts` — shared Umi/Connection setup for integration tests

*Note: Integration tests require live devnet connection and pre-funded wallets. Registration script itself is the primary integration test.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Umi/web3.js module isolation | IDENT-03 | Architecture constraint, not runtime behavior | Verify no Umi imports in `src/lib/solana/`, no web3.js imports in `src/lib/metaplex/` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
