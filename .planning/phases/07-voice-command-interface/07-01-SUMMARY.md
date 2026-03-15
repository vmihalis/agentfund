---
phase: 07-voice-command-interface
plan: 01
subsystem: api
tags: [voice, express, text-parser, command-routing, elevenlabs]

# Dependency graph
requires:
  - phase: 02-governance-pipeline
    provides: GovernanceAgent orchestration and agent interfaces
  - phase: 03-scout-agent-real
    provides: IScoutAgent interface with discoverProposals
  - phase: 04-analyzer-agent-real
    provides: IAnalyzerAgent interface with evaluateProposal
  - phase: 05-treasury-agent-solana
    provides: ITreasuryAgent interface with getBalance and executeFunding
provides:
  - VoiceCommandRouter mapping 4 intents to agent actions
  - parseTextCommand for natural language text-to-intent parsing
  - Express voice server with /api/voice/command and /api/voice/signed-url
  - VoiceIntent, VoiceCommand, VoiceResult type definitions
affects: [07-02-elevenlabs-client-tools, 09-end-to-end-demo]

# Tech tracking
tech-stack:
  added: []
  patterns: [voice-command-routing, text-intent-parsing, keyword-chain-extraction]

key-files:
  created:
    - src/voice/voice-types.ts
    - src/voice/voice-command-router.ts
    - src/voice/text-parser.ts
    - src/voice/voice-server.ts
    - src/voice/index.ts
    - tests/unit/voice-command-router.test.ts
    - tests/unit/text-command-fallback.test.ts
  modified: []

key-decisions:
  - "VoiceRouterDeps takes single options object { governance, scout, analyzer, treasury } for clean dependency injection"
  - "extractId skips keyword chains (analyze->proposal->ID) instead of naive next-word extraction"
  - "Text parser uses first-match-wins keyword priority: fund > analyze > treasury > find > default"
  - "Voice server follows Phase 6 server factory pattern (createVoiceServer returns { app, start })"

patterns-established:
  - "Voice intent routing: switch-based dispatch with per-intent try/catch wrapping"
  - "Text-to-intent parsing: keyword regex matching with skipWords for ID extraction"
  - "Voice server factory: createVoiceServer({ port, router }) -> { app, start }"

requirements-completed: [VOICE-02, VOICE-04, GOV-03]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 7 Plan 01: Voice Command Router Summary

**VoiceCommandRouter with 4-intent dispatch, keyword-based text parser, and Express server with text fallback and ElevenLabs signed-URL proxy**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-15T00:09:03Z
- **Completed:** 2026-03-15T00:14:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- VoiceCommandRouter maps findProposals, analyzeProposal, fundProject, checkTreasury intents to real agent methods
- parseTextCommand converts natural language to VoiceCommand with keyword-chain-aware ID extraction
- Express voice server provides POST /api/voice/command (text fallback) and GET /api/voice/signed-url (ElevenLabs proxy)
- 30 unit tests covering all intents, error handling, text parsing edge cases, and server endpoints

## Task Commits

Each task was committed atomically:

1. **Task 1: Voice types, VoiceCommandRouter, and unit tests (TDD)**
   - `ff04649` (test) - Failing tests for VoiceCommandRouter intent routing
   - `fe179d4` (feat) - Implement VoiceCommandRouter with 4 intent handlers

2. **Task 2: Text parser, voice server, and text fallback tests (TDD)**
   - `2250a70` (test) - Failing tests for text parser and voice server
   - `1248fa9` (feat) - Implement text parser and voice server with all endpoints

_Note: TDD tasks have RED (test) and GREEN (feat) commits_

## Files Created/Modified
- `src/voice/voice-types.ts` - VoiceIntent, VoiceCommand, VoiceResult type definitions
- `src/voice/voice-command-router.ts` - VoiceCommandRouter class with 4 intent handlers and error wrapping
- `src/voice/text-parser.ts` - parseTextCommand with keyword matching, extractId, extractAmount helpers
- `src/voice/voice-server.ts` - Express server factory with /api/voice/command, /api/voice/signed-url, /api/voice/health
- `src/voice/index.ts` - Barrel exports for voice module
- `tests/unit/voice-command-router.test.ts` - 11 tests for router intent dispatch and error handling
- `tests/unit/text-command-fallback.test.ts` - 19 tests for text parsing and server endpoints

## Decisions Made
- VoiceRouterDeps takes single options object { governance, scout, analyzer, treasury } for clean dependency injection
- extractId skips keyword chains (analyze->proposal->ID) instead of naive next-word extraction -- fixes "analyze proposal XYZ" returning "proposal" instead of "XYZ"
- Text parser uses first-match-wins keyword priority: fund > analyze > treasury > find > default
- Voice server follows Phase 6 server factory pattern (createVoiceServer returns { app, start })

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed extractId keyword chain skipping**
- **Found during:** Task 2 (text parser GREEN phase)
- **Issue:** extractId matched the word right after "analyze" keyword, returning "proposal" instead of the actual ID "XYZ" in "analyze proposal XYZ"
- **Fix:** Changed extractId to iterate tokens, track when a keyword is seen, and skip all known keywords/skip-words before returning the first non-keyword token
- **Files modified:** src/voice/text-parser.ts
- **Verification:** "analyze proposal XYZ" correctly returns proposalId: "XYZ"
- **Committed in:** 1248fa9 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correct ID extraction. No scope creep.

## Issues Encountered
- Vitest v4 does not support the `-x` (bail on first failure) flag from v3; used `--bail 1` instead

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VoiceCommandRouter is ready for ElevenLabs client tool integration (Plan 07-02)
- parseTextCommand provides text fallback path independent of voice
- Voice server can be started alongside existing Scout/Analyzer servers
- ElevenLabs signed-url endpoint requires ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID env vars (graceful 500 when missing)

## Self-Check: PASSED

- All 8 files verified on disk
- All 4 commits verified in git history
- 30/30 tests passing
- Full test suite: 175 passed, 33 skipped (integration), 0 failed

---
*Phase: 07-voice-command-interface*
*Completed: 2026-03-14*
