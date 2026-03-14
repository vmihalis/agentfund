---
phase: 3
slug: scout-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run tests/unit/scout-agent.test.ts tests/unit/unbrowse-parser.test.ts --reporter=verbose` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/unit/scout-agent.test.ts tests/unit/unbrowse-parser.test.ts --reporter=verbose`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | SCOUT-01, SCOUT-02, SCOUT-03 | unit | `pnpm vitest run tests/unit/scout-agent.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | PARSER | unit | `pnpm vitest run tests/unit/unbrowse-parser.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | SCOUT-02 | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "intent/resolve" -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | SCOUT-01 | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "calls Unbrowse" -x` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | SCOUT-03 | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "returns Proposal" -x` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 1 | FALLBACK | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "fallback" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/scout-agent.test.ts` — stubs for SCOUT-01, SCOUT-02, SCOUT-03, FALLBACK
- [ ] `tests/unit/unbrowse-parser.test.ts` — stubs for PARSER (response normalization)
- [ ] No new framework install needed — vitest already configured

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Unbrowse live call returns real web data | SCOUT-01 | Requires running Unbrowse daemon | Start Unbrowse, run Scout, verify non-stub data returned |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
