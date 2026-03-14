---
phase: 4
slug: proposal-analyzer-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run tests/unit/analyzer-agent.test.ts --reporter=verbose` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/unit/analyzer-agent.test.ts --reporter=verbose`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | ANLZ-01, ANLZ-02, ANLZ-03 | unit (stubs) | `pnpm vitest run tests/unit/analyzer-agent.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | ANLZ-01 | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "calls Claude" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | ANLZ-02 | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "reasoning" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | ANLZ-03 | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "scores" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | FALLBACK | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "fallback" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-01-06 | 01 | 1 | EVENTS | unit | `pnpm vitest run tests/unit/analyzer-agent.test.ts -t "status" --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/analyzer-agent.test.ts` — stubs for ANLZ-01, ANLZ-02, ANLZ-03, FALLBACK, INTERFACE, EVENTS
- No new framework install needed — vitest already configured

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
