---
phase: 7
slug: voice-command-interface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run tests/unit/voice-command-router.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/unit/voice-command-router.test.ts`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | VOICE-02, GOV-03 | unit | `pnpm vitest run tests/unit/voice-command-router.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | VOICE-04 | unit | `pnpm vitest run tests/unit/text-command-fallback.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | VOICE-01 | manual-only | N/A — dashboard config | N/A | ⬜ pending |
| 07-02-02 | 02 | 2 | VOICE-03 | integration | `pnpm vitest run tests/integration/voice-pipeline.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/voice-command-router.test.ts` — stubs for VOICE-02, GOV-03
- [ ] `tests/unit/text-command-fallback.test.ts` — stubs for VOICE-04
- [ ] `tests/integration/voice-pipeline.test.ts` — stubs for VOICE-03 (skipIf missing env vars)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ElevenLabs agent configured with system prompt and tools | VOICE-01 | Dashboard-based configuration, not code | 1. Log into ElevenLabs dashboard 2. Verify agent "AgentFund Treasury Command Center" exists 3. Verify system prompt matches spec 4. Verify all 4 tools have "Wait for response" enabled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
