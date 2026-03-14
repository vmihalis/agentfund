# Project Research Summary

**Project:** AgentFund — Autonomous Multi-Agent AI Treasury on Solana
**Domain:** Multi-agent AI system for autonomous grant funding coordination on Solana blockchain
**Researched:** 2026-03-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

AgentFund is a hackathon project targeting 7 bounties ($11,400+ total) at Funding the Commons SF (March 14-15, 2026). The recommended approach is a coordinator-pattern multi-agent system with 4 specialized AI agents (Scout, Proposal Analyzer, Treasury Manager, Governance) operating on Solana devnet, each with a verifiable on-chain identity via Metaplex Agent Registry. The highest-value bounty ($5,000) requires all 4 agents to be registered as MPL Core NFTs with AgentIdentityV1 PDAs — this is the mandatory foundation everything else builds on. The architecture uses a shared in-process event bus for coordination, x402 HTTP micropayments for the agent economy layer, and ElevenLabs Conversational AI as the human interface via voice commands.

The recommended stack is deliberately conservative: Node.js 20 LTS, Next.js 15 (not 16), React 18 (not 19), and @solana/web3.js v1.x (not v2). The Solana ecosystem is version-fragmented — Meteora DLMM and Anchor still require web3.js v1.x, which conflicts with the newer v2 API. A critical architectural seam exists between Umi (required by Metaplex operations) and web3.js (required by everything else): these two Solana interaction frameworks must be kept strictly isolated in separate modules with adapters bridging them. Skipping this isolation is the single fastest way to lose multiple hours to TypeScript type errors.

The dominant risk for a 20-hour solo build is integration sprawl: 7 SDKs each with their own setup ceremony, auth model, and devnet quirks. The mitigation is strict prioritization — Metaplex agent registration must be working end-to-end before touching any bonus bounty. Time-box every secondary integration to 90 minutes and have stub fallbacks ready. A demo with 5 real on-chain actions beats a demo with 7 half-broken integrations. Pre-fund all wallets, pre-warm Unbrowse, and feature-freeze at hour 14 to protect demo rehearsal time.

## Key Findings

### Recommended Stack

The stack is a full-stack TypeScript monorepo using Next.js 15 for both frontend and API routes, eliminating the need for a separate backend process. Two Solana interaction layers run in parallel and must stay separate: the Umi layer (for all Metaplex/agent registry operations) and the web3.js v1.x layer (for Meteora DLMM, x402 payments, SPL token ops). The `@metaplex-foundation/umi-web3js-adapters` package is the bridge and must be used consistently. The newly published `@metaplex-foundation/mpl-agent-registry` v0.2.0 (published 2026-03-11, 3 days before this hackathon) is the core bounty package — it provides 4 Umi plugins and exposes `registerIdentityV1()` plus PDA derivation helpers.

Do NOT use: `@metaplex-foundation/js` (deprecated), `@solana/web3.js` v2.x (breaks DLMM and Anchor), `solana-agent-kit` (too generic, doesn't know about mpl-agent-registry), or LangChain (unnecessary abstraction). Skip database ORMs, IPFS, and Realms governance entirely.

**Core technologies:**
- `@metaplex-foundation/mpl-agent-registry` v0.2.0: On-chain agent identity — the $5K bounty package, Umi-based, very new
- `@metaplex-foundation/umi` + `umi-bundle-defaults` v1.5.1: Metaplex transaction framework — required by all mpl-* packages
- `@solana/web3.js` v1.98.4: Solana connection and raw transactions — pinned to v1.x for compatibility
- `@coral-xyz/anchor` v0.32.1: Anchor program interaction — required peer dep for Meteora DLMM
- `@meteora-ag/dlmm` v1.9.4: DLMM LP position management — $1K Meteora bounty
- `@faremeter/payment-solana` v0.17.1: x402 agent-to-agent micropayments — Corbits/Solana bounty integration
- `@anthropic-ai/sdk` v0.78.0: Claude API for proposal evaluation — core reasoning layer
- `@elevenlabs/react` v0.14.2 + `@elevenlabs/client` v0.15.1: Voice-driven agent interaction — ElevenLabs credits bounty
- `@human.tech/passport-embed` v0.3.4: Sybil-resistant proposal submission gate — $1,200 human.tech bounty
- `unbrowse` (CLI): Web data discovery at localhost:6969 — $1,500 Unbrowse bounty
- Node.js 20 LTS, TypeScript ~5.4, pnpm 9.x, Next.js 15, Tailwind CSS 3.x: Runtime and build tools

### Expected Features

All 7 bounties map to discrete, implementable features. The feature dependency chain is linear: agent registration must come first, then individual agents, then coordination, then UI. Human Passport is the easiest integration (15-30 min) and should be deferred to near the end to protect time for critical path items.

**Must have (table stakes / bounty-qualifying):**
- 4 on-chain Metaplex agent identities (Core NFT + AgentIdentityV1 PDA) — $5K Metaplex bounty, everything depends on this
- Scout agent using Unbrowse `/v1/intent/resolve` for real web grant discovery — $1.5K Unbrowse bounty
- Treasury Manager creating/managing a Meteora DLMM LP position on devnet — $1K Meteora bounty
- x402 agent-to-agent payment flow (at least Scout -> Analyzer with USDC) — Solana bounty qualifier
- Human Passport Embed gating proposal submission — $1.2K human.tech bounty
- ElevenLabs voice command interface with client tools triggering agent actions — ElevenLabs credits bounty
- Working end-to-end demo with real Solana transactions (Solscan links) — required by all judges

**Should have (competitive advantage):**
- Live agent activity feed via WebSocket (makes demo feel autonomous and alive)
- Agent payment analytics graph (makes x402 economy tangible to judges)
- Text-input fallback for all voice commands (protects demo if microphone fails at venue)
- Frontier Tower building coordinator context — $500 RAG bounty, low effort

**Defer (nice to have, skip if pressed for time):**
- On-chain reasoning trail via Core Attributes plugin — impressive but adds complexity
- Autonomous yield rebalancing loops — demo stability risk, use triggered rebalancing instead
- Multi-strategy DLMM portfolio across multiple pairs — single pair is sufficient for bounty
- Full DAO governance — out of scope, don't build

### Architecture Approach

The system is a coordinator-pattern multi-agent architecture where the Governance Agent is the sole orchestrator. Scout, Proposal Analyzer, and Treasury Manager are specialist workers that respond only to Governance — never to each other directly. Inter-agent communication uses two channels: a typed in-process Node.js EventEmitter (free coordination, dashboard broadcast) and x402-gated HTTP endpoints (paid service calls, bounty demonstration). The frontend is a Next.js dashboard with real-time WebSocket updates, voice command center via ElevenLabs, and proposal submission gated by Human Passport. All agents share a single Solana devnet connection but have individual keypairs and token accounts.

**Major components:**
1. Governance Agent — coordinator/orchestrator, receives ElevenLabs voice commands, routes tasks, synthesizes decisions
2. Scout Agent — web data discovery via Unbrowse, reports proposal findings to Governance via event bus
3. Proposal Analyzer Agent — evaluates proposals with Claude, returns scored analysis via x402-gated endpoint
4. Treasury Manager Agent — executes SPL token transfers and manages Meteora DLMM LP positions
5. Event Bus — typed in-process EventEmitter, provides wildcard `*` emit for WebSocket dashboard forwarding
6. Metaplex Registration Module — isolated Umi-only module that runs at startup; creates Core NFT + registers AgentIdentityV1 PDA for each agent
7. x402 Payment Layer — Corbits `wrapFetch` client + Express middleware for payment verification and gating
8. Next.js Dashboard — proposal pipeline, treasury state, agent activity feed, voice command center, Passport Embed gate

Build order follows a strict dependency graph: Layer 0 (Solana connection, keypairs, event bus, Metaplex registration) → Layer 1 (BaseAgent class, x402 wrappers) → Layer 2 (individual agents, parallelizable) → Layer 3 (inter-agent integration, x402 flows) → Layer 4 (frontend dashboard, ElevenLabs, Passport) → Layer 5 (polish, demo rehearsal).

### Critical Pitfalls

1. **Integration sprawl** — 7 SDKs in 20 hours; time-box each bonus integration to 90 min, stub with mock data if needed, build demo happy path with hardcoded data first and progressively replace stubs
2. **Umi vs web3.js keypair incompatibility** — use `@metaplex-foundation/umi-web3js-adapters` (`fromWeb3JsKeypair`/`toWeb3JsKeypair`), create a `keys.ts` utility that exports both types from the same secret key bytes, and isolate ALL Umi operations to a single `registration/` module
3. **Solana devnet unreliability** — pre-fund all 4 agent wallets with 10+ SOL the night before demo, use a dedicated RPC (Helius/QuickNode free tier), pre-create all Associated Token Accounts, have pre-recorded Solscan links as backup
4. **Multi-agent coordination collapse** — enforce hub-and-spoke: Governance is the sole orchestrator, other agents never call each other directly; use hard 10-second timeouts; script the happy path deterministically; limit LLM-driven decisions to Proposal Analyzer only
5. **Metaplex Agent Registry is new and sparsely documented** — read the actual npm package source code in `node_modules/`, use `fetchAsset()` to verify on-chain state after every operation, join the Metaplex Discord for hackathon-era examples

## Implications for Roadmap

Based on combined research, the dependency structure mandates a 5-phase approach. Phases 1-3 are critical path; Phases 4-5 can be partially parallelized.

### Phase 1: Foundation — Solana Infrastructure and Agent Identity

**Rationale:** Everything in this project depends on Solana connectivity, funded wallets, and on-chain agent identities. The $5,000 Metaplex bounty is both the highest-value and the most foundational. No agent can operate without a keypair, token account, and AgentIdentityV1 PDA. Umi/web3.js isolation must be established here or it poisons every subsequent phase.

**Delivers:** 4 funded agent wallets; 4 Metaplex Core NFTs + AgentIdentityV1 PDAs on devnet; isolated `registration/` module; `keys.ts` utility with dual signer types; verified RPC endpoint; all Associated Token Accounts pre-created; devnet USDC distributed to all agents

**Addresses:** Metaplex $5K bounty (agent identity), Solana bounty prerequisite (wallet setup)

**Avoids:** Pitfall 2 (Umi/web3.js incompatibility), Pitfall 3 (devnet unreliability), Pitfall 5 (sparse agent registry docs), Pitfall 10 (transaction size limits)

**Research flag:** Needs deep validation — `mpl-agent-registry` v0.2.0 is 3 days old with minimal documentation. Read npm source code directly. Budget 3-4 hours.

### Phase 2: Agent Shells and Event Bus

**Rationale:** The coordinator pattern and typed event bus must exist before any individual agent can be tested end-to-end. BaseAgent class defines the interface all 4 agents implement. Getting Governance routing working with one stub agent validates the entire coordination architecture before it's built out.

**Delivers:** `AgentEventBus` class with typed events and wildcard emit; `BaseAgent` abstract class with keypair, event bus, connection; Governance Agent with routing logic; one stub agent proving the coordination loop; x402 server middleware and `wrapFetch` client wrapper

**Addresses:** Multi-agent coordination requirement (all bounties depend on showing agents working together)

**Avoids:** Pitfall 4 (bag-of-agents collapse), Pitfall 12 (parallel Claude Code merge conflicts — shared types defined here)

**Research flag:** Standard patterns, skip deep research. EventEmitter coordinator architecture is well-documented.

### Phase 3: Individual Agents — Scout, Analyzer, Treasury Manager

**Rationale:** Once BaseAgent and event bus exist, the 3 specialist agents can be built in parallel (or with fast sequential iteration). Each has a clear external dependency: Unbrowse (Scout), Claude (Analyzer), Meteora DLMM (Treasury). These are the most independently buildable components.

**Delivers:** Scout Agent with Unbrowse `/v1/intent/resolve` integration (pre-warmed skills); Proposal Analyzer with Claude evaluation and scored output; Treasury Manager with Meteora DLMM position creation (SpotBalanced strategy); each agent as x402-gated HTTP endpoint; devnet pool availability verified

**Addresses:** Unbrowse $1.5K bounty, Meteora $1K bounty, Claude reasoning requirement

**Avoids:** Pitfall 7 (Unbrowse first-run latency — pre-warm during setup), Pitfall 9 (Meteora devnet pool availability — verify early), Pitfall 14 (Unbrowse mutation blocking — GET-only during demo)

**Research flag:** Meteora DLMM devnet pool availability is uncertain — verify in first 30 minutes of this phase and have fallback (basic SOL transfers as "treasury management") ready. Unbrowse well-documented for GET operations.

### Phase 4: Integration — x402 Payment Flows and End-to-End Coordination

**Rationale:** With individual agents working, connecting them via the full x402 payment cycle and wiring Governance to orchestrate the complete funding pipeline (Scout → Analyze → Fund) is the integration layer. This is where the "real system" claim becomes demonstrable. Cannot be parallelized.

**Delivers:** Full x402 payment flow between Scout and Analyzer (402 response → payment → content delivery with on-chain USDC transfer); Governance orchestrating a complete proposal discovery-to-funding cycle; all agent actions producing real transaction signatures; Solscan links displayable

**Addresses:** Solana x402 bounty, multi-agent coordination narrative, "real on-chain actions" requirement

**Avoids:** Pitfall 6 (x402 token account prerequisites — setup script from Phase 1), Pitfall 15 (no real on-chain proof), Pitfall 1 (integration sprawl — core is done before bonus integrations)

**Research flag:** x402/Corbits `wrapFetch` pattern is well-documented. Test full payment cycle (both sides) early in this phase before building multi-step workflows.

### Phase 5: Frontend, Voice, and Bonus Bounties

**Rationale:** The demo surface (dashboard, voice, Passport) is built last because it consumes backend APIs that weren't stable earlier. ElevenLabs requires dashboard configuration before code. Human Passport is the easiest integration and intentionally deferred to protect time for critical path. Feature freeze after this phase.

**Delivers:** Next.js dashboard with agent activity feed, treasury state, x402 payment graph, Solscan transaction links; ElevenLabs Conversational AI with client tools (findProposals, analyzeProposal, fundProject) triggering real agent actions; text-input fallback for all voice commands; Human Passport Embed gating proposal submission; optional Frontier Tower RAG context

**Addresses:** ElevenLabs credits bounty, human.tech $1.2K bounty, Frontier Tower $500 bounty, demo polish

**Avoids:** Pitfall 8 (ElevenLabs dashboard config before code), Pitfall 11 (Passport API access — must be pre-requested), Pitfall 13 (venue audio failure — text fallback), "works on my machine" meta-pitfall

**Research flag:** ElevenLabs agent configuration in dashboard is partially undocumented (blocking vs non-blocking tool behavior). Test in ElevenLabs playground before React integration. Human Passport: standard component embed, no research needed.

### Phase Ordering Rationale

- **Foundation first** because Metaplex agent registration is both the highest-value bounty and a prerequisite for every other agent operation. Umi/web3.js isolation must be solved once, correctly, before it proliferates.
- **Coordination layer before individual agents** because the BaseAgent interface and typed event schema prevents the merge conflict pitfall when building agents in parallel. Shared types must precede parallel implementation.
- **Individual agents before integration** because x402 payment flows require working endpoints on both sides; you can't test the economy layer without functioning buyers and sellers.
- **Frontend last** because it is a consumer, not a producer. Building it before the API layer solidifies leads to constant rework.
- **Bonus integrations (ElevenLabs, Passport) in final phase** because their 15-60 minute effort-to-reward ratios make them efficient last-mile additions, not first-mile investments.

### Research Flags

Phases likely needing deeper research or validation during execution:
- **Phase 1:** `mpl-agent-registry` v0.2.0 is 3 days old — read npm source, verify PDA derivation against on-chain state, join Metaplex Discord for contemporaneous examples
- **Phase 3 (Treasury):** Meteora DLMM devnet pool availability is unverified — must check in first 30 minutes; have basic SPL transfer fallback scripted
- **Phase 5 (Voice):** ElevenLabs "blocking" tool behavior requires dashboard configuration that isn't fully documented in public docs — test in ElevenLabs playground before React integration

Phases with standard patterns (skip additional research):
- **Phase 2:** EventEmitter coordinator pattern is well-established; typed event bus design is a standard Node.js pattern
- **Phase 4 (x402):** Corbits wrapFetch pattern is documented with official examples; test early but no research blocker
- **Phase 5 (Passport):** Human Passport Embed is a drop-in React component with clear docs; 15-minute integration, no research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via npm registry. Version compatibility matrix is definitive — the v1.x vs v2.x web3.js pinning is critical and well-understood. mpl-agent-registry is new but inspected from npm tarball directly. |
| Features | HIGH | Bounty requirements are concrete and explicit. Feature dependency chain maps directly to bounty deliverables. Time estimates are realistic for a 20-hour solo build. |
| Architecture | HIGH | Coordinator pattern with EventEmitter is well-documented. Component boundaries, data flows, and communication protocols are fully specified. Build order rationale is sound and grounded in dependency analysis. |
| Pitfalls | MEDIUM | Critical pitfalls are well-evidenced (Umi/web3.js incompatibility is documented, devnet reliability is known, multi-agent coordination failures are academically researched). Meteora DLMM devnet pool availability is the largest unresolved uncertainty. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Meteora DLMM devnet pool availability:** Unverified. Must be the first check in Phase 3. If no suitable devnet pools exist, budget 1-2 hours to create a test pool, or prepare the fallback narrative (basic treasury transfers with DLMM as "roadmap"). Do not assume pools exist.
- **Devnet USDC mint:** Standard USDC mint (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) may not be distributed on devnet. If x402 USDC payments fail, create a custom SPL mint ("DEMO_USDC") during Phase 1 setup and distribute to all agents.
- **mpl-agent-registry registration URI requirement:** The `registerIdentityV1()` call takes an `agentRegistrationUri` parameter (metadata URL). For devnet demo, a static JSON endpoint or even a data URI may work, but this hasn't been tested against the actual v0.2.0 on-chain program behavior. Validate early in Phase 1.
- **ElevenLabs dashboard blocking tool behavior:** Whether client tools block agent speech pending tool completion is controlled by a dashboard setting that isn't consistently documented. Test in playground before integrating into the demo script.

## Sources

### Primary (HIGH confidence)
- npm registry (tarball inspection) — `mpl-agent-registry` v0.2.0 type definitions, program IDs, exported functions
- [Metaplex Core SDK](https://developers.metaplex.com/smart-contracts/core) — NFT standard, plugin system
- [Solana x402 Guide](https://solana.com/developers/guides/getstarted/intro-to-x402) — x402 payment flow, Corbits SDK
- [Meteora DLMM TypeScript SDK](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started) — SDK functions, strategy types
- [Faremeter/Corbits Docs](https://docs.corbits.dev/faremeter/overview) — wrapFetch pattern, exact payment flow
- [ElevenLabs React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react) — useConversation, client tools, session management
- [Human Passport Embed](https://docs.passport.xyz/building-with-passport/embed/component-reference) — PassportScoreWidget, usePassportScore
- [Solana Transaction Fundamentals](https://developers.metaplex.com/solana/solana-transaction-fundamentals) — 1,232-byte limit, CU budgeting

### Secondary (MEDIUM confidence)
- [Chainstack x402 Architecture](https://chainstack.com/x402-protocol-for-ai-agents/) — three-party model: client, resource server, facilitator
- [Alchemy: Build Solana AI Agents 2026](https://www.alchemy.com/blog/how-to-build-solana-ai-agents-in-2026) — three-layer architecture, dual-key wallets
- [Why Multi-Agent Systems Fail (Towards Data Science)](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) — 15x token consumption, bag-of-agents anti-pattern
- [DEV.to Multi-Agent Systems Guide](https://dev.to/eira-wexford/how-to-build-multi-agent-systems-complete-2026-guide-1io6) — coordinator pattern, 3-7 agents per workflow
- [Unbrowse GitHub](https://github.com/unbrowse-ai/unbrowse) — intent resolve API, mutation safety flags, skill caching
- [Meteora DLMM SDK GitHub Issue #234](https://github.com/MeteoraAg/dlmm-sdk/issues/234) — transaction returns signature but balances unchanged (known bug)

### Tertiary (LOW confidence)
- [arXiv: Autonomous Agents on Blockchains](https://arxiv.org/html/2601.04583v1) — execution models, trust boundaries (academic, may not reflect hackathon-scale systems)
- [Robot Money](https://www.robotmoney.net/) — autonomous treasury reference (competitor analysis, limited public detail)

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
