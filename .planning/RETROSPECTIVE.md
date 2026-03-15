# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-15
**Phases:** 11 | **Plans:** 21 | **Commits:** 122

### What Was Built
- 4 AI agents with on-chain Metaplex identities coordinating grant funding on Solana devnet
- x402 micropayment economy with real USDC transfers between agents
- ElevenLabs voice command center with 4 agent action triggers
- Next.js dashboard with live activity, treasury, proposals, and sybil resistance
- Full E2E demo flow: voice/text → discovery → evaluation → funding → on-chain verification
- Meteora DLMM LP management for treasury yield

### What Worked
- **Fine-grained phase structure:** 11 phases with 1-3 plans each kept scope manageable and provided clear progress signals
- **Parallel phase execution:** Phases 3/4/5 (Scout, Analyzer, Treasury) built in parallel after Phase 2 architecture
- **Server factory pattern:** `create*Server` returning `{ app, start }` made all servers testable with random ports
- **Stub agent pattern:** Stubs from Phase 2 allowed downstream phases to develop without waiting for real implementations
- **Typed event bus:** Compile-time safety for all agent events caught integration issues early
- **Audit-driven gap closure:** Phases 10-11 were created directly from audit findings, systematically closing all gaps

### What Was Inefficient
- **Devnet faucet rate-limiting:** Blocked Phase 1 on-chain verification; required Phase 10 to run bootstrap scripts later
- **REQUIREMENTS.md premature checkboxes:** Marked IDENT requirements complete before on-chain state existed
- **Phase 7 ROADMAP inconsistency:** Showed 1/2 plans despite both being complete; ROADMAP not updated after 07-02
- **Orphaned exports:** createVoiceSession and mapPipelineStage defined but never consumed in initial phases
- **Dashboard static data paths:** PaymentHistory and proposals-store shipped with demo data, requiring Phase 11 to wire live data

### Patterns Established
- **Claude API pattern:** Zod schema → z.toJSONSchema() → forced tool_choice → Zod .parse() validation (used by Governance, Analyzer)
- **3-layer fallback:** Live → cache → stub for external dependencies (Unbrowse, devnet)
- **Dashboard type isolation:** Dashboard types replicate backend shapes independently — no cross-workspace imports
- **Pure utility extraction:** Extract testable pure functions from API routes/components for root vitest
- **Integration test tiers:** skipIf conditions based on available resources (keys only vs funded ATAs)

### Key Lessons
1. **Don't mark requirements complete until verified on-chain** — premature checkboxes in REQUIREMENTS.md masked gaps that the audit later caught
2. **Budget time for external dependency failures** — Solana devnet faucet was rate-limited at the worst time; have transfer fallback ready
3. **Wire live data paths from the start** — static demo data in dashboard components creates integration debt that compounds
4. **Audit before milestone completion** — the v1.0 audit surfaced 8 requirement gaps and 3 broken E2E flows that would have shipped as unknowns
5. **Server factory pattern scales well** — consistent `create*Server` pattern across voice, scout, analyzer servers simplified testing and demo wiring

### Cost Observations
- Model mix: ~80% sonnet (execution), ~15% opus (planning/audit), ~5% haiku (research)
- Sessions: ~15 sessions across 2 days
- Notable: Phase 4 (Analyzer) completed in 2 minutes — fastest plan execution due to established Claude API pattern from Phase 2

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 122 | 11 | Audit-driven gap closure (Phases 10-11 added post-audit) |

### Cumulative Quality

| Milestone | LOC | Files | Tech Debt Items |
|-----------|-----|-------|-----------------|
| v1.0 | 13,807 | 216 | 12 |

### Top Lessons (Verified Across Milestones)

1. Audit milestones before marking complete — catches gaps that individual phase verifications miss
2. External dependencies (devnet, SDKs) need fallback strategies from day one
