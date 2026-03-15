# Roadmap: AgentFund

## Overview

AgentFund delivers an autonomous multi-agent AI treasury system on Solana in 9 phases. The roadmap moves from blockchain foundation (agent identities on-chain) through individual agent capabilities (Scout, Analyzer, Treasury) to coordination layers (x402 payments, voice, dashboard) and culminates in a polished end-to-end demo. Phases 3-5 are parallelizable once the coordination architecture exists. The structure targets 7 bounties totaling $11,400+ at Funding the Commons SF.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Solana Foundation & Agent Identity** - Keypairs, wallets, token accounts, and 4 Metaplex on-chain agent registrations (completed 2026-03-14)
- [x] **Phase 2: Agent Architecture & Governance Core** - BaseAgent class, event bus, and Governance Agent coordination logic (completed 2026-03-14)
- [x] **Phase 3: Scout Agent** - Web data discovery via Unbrowse intent resolution (completed 2026-03-14)
- [x] **Phase 4: Proposal Analyzer Agent** - Claude-powered proposal evaluation with scored reasoning (completed 2026-03-14)
- [x] **Phase 5: Treasury Manager Agent** - Fund management and Meteora DLMM LP positions (completed 2026-03-14)
- [x] **Phase 6: x402 Agent Payment Economy** - Micropayment flows gating agent service endpoints (completed 2026-03-14)
- [ ] **Phase 7: Voice Command Interface** - ElevenLabs conversational AI with agent action triggers
- [x] **Phase 8: Frontend Dashboard & Sybil Resistance** - Next.js monitoring dashboard and Human Passport gate (completed 2026-03-15)
- [x] **Phase 9: End-to-End Demo Integration** - Full pipeline verification and demo rehearsal (completed 2026-03-15)
- [x] **Phase 10: Devnet Bootstrap & Missing Verification** - Fund deployer, execute on-chain scripts, verify Scout Agent (completed 2026-03-15)
- [x] **Phase 11: Live Dashboard Wiring** - Wire voice clientTools, x402 payment signatures, and live proposal pipeline (completed 2026-03-15)

## Phase Details

### Phase 1: Solana Foundation & Agent Identity
**Goal**: Every agent has a funded Solana wallet and a verifiable on-chain identity via Metaplex Agent Registry
**Depends on**: Nothing (first phase)
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04
**Success Criteria** (what must be TRUE):
  1. Running a registration script produces 4 MPL Core NFTs in a single collection on Solana devnet, each with an AgentIdentityV1 PDA
  2. Each agent wallet holds SOL and devnet USDC with pre-created Associated Token Accounts
  3. Any third party can derive a PDA from an agent's public key and verify its AgentIdentityV1 registration on-chain
  4. The Umi layer (Metaplex operations) and web3.js layer (everything else) are isolated in separate modules with adapter bridging
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Project init, key management, Metaplex/Solana library modules, test scaffold
- [x] 01-02-PLAN.md — Wallet funding, agent registration, verification script, integration tests

### Phase 2: Agent Architecture & Governance Core
**Goal**: A typed coordination framework exists where the Governance Agent can route tasks to specialist agents and produce decision summaries
**Depends on**: Phase 1
**Requirements**: GOV-01, GOV-02, GOV-04
**Success Criteria** (what must be TRUE):
  1. A BaseAgent abstract class exists that all agents implement, providing keypair, event bus connection, and standard lifecycle
  2. The Governance Agent can receive a "fund this project" request and orchestrate the full pipeline: discover proposals, evaluate them, and execute funding
  3. Governance Agent produces a human-readable decision summary with reasoning for each funding action
  4. A typed event bus broadcasts agent events, enabling downstream consumers (dashboard, logs) to observe all agent activity
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Type definitions, TypedEventBus, BaseAgent, agent interfaces, stub implementations
- [x] 02-02-PLAN.md — GovernanceAgent with Claude API pipeline orchestration and decision summaries

### Phase 3: Scout Agent
**Goal**: The Scout agent discovers real grant proposals from the web and delivers structured data to the Governance Agent
**Depends on**: Phase 2
**Requirements**: SCOUT-01, SCOUT-02, SCOUT-03
**Success Criteria** (what must be TRUE):
  1. Issuing a "find grant proposals" command to Scout triggers an Unbrowse intent resolution call to localhost:6969 and returns real web data
  2. Scout returns structured proposal objects (title, description, amount, team info) to the Governance Agent via the event bus
  3. Scout handles Unbrowse unavailability gracefully with stub/cached data so the demo pipeline never breaks
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — Unbrowse client library, response parser, ScoutAgent with 3-layer fallback

### Phase 4: Proposal Analyzer Agent
**Goal**: The Proposal Analyzer evaluates any proposal with Claude and returns a scored, explained assessment visible to humans
**Depends on**: Phase 2
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03
**Success Criteria** (what must be TRUE):
  1. Given a proposal, the Analyzer calls Claude API and returns a structured evaluation with scores for team quality, technical feasibility, impact potential, and budget reasonableness
  2. Every evaluation includes human-readable explained reasoning (why fund or reject) that can be displayed in the dashboard
  3. The Analyzer communicates results back to the Governance Agent via the event bus for aggregation into funding decisions
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — AnalyzerAgent with Claude API evaluation, fallback scoring, and unit tests

### Phase 5: Treasury Manager Agent
**Goal**: The Treasury Manager holds real funds on Solana devnet, executes token transfers for approved grants, and earns yield via Meteora DLMM
**Depends on**: Phase 2
**Requirements**: TREAS-01, TREAS-02, TREAS-03, TREAS-04, TREAS-05
**Success Criteria** (what must be TRUE):
  1. Treasury Manager tracks its fund balances on Solana devnet and reports current status (SOL, USDC, LP positions) on request
  2. When Governance approves a funding decision, Treasury Manager executes an SPL token transfer that produces a real Solana transaction signature viewable on Solscan
  3. Treasury Manager can create at least one Meteora DLMM LP position using idle treasury funds (SpotBalanced strategy)
  4. Treasury Manager can remove liquidity and claim rewards from DLMM positions
  5. All treasury operations (transfers, LP create, LP remove) produce verifiable on-chain transactions
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — TreasuryAgent with balance tracking, SPL token transfers, and status reporting
- [x] 05-02-PLAN.md — Meteora DLMM LP position creation, removal, and reward claiming

### Phase 6: x402 Agent Payment Economy
**Goal**: Agents pay each other for services using x402 micropayments with real on-chain USDC transfers on devnet
**Depends on**: Phase 3, Phase 4
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, SCOUT-04, ANLZ-04
**Success Criteria** (what must be TRUE):
  1. Scout and Analyzer each expose HTTP endpoints gated by x402 middleware that returns a 402 response with payment requirements to unauthenticated callers
  2. An agent using wrapFetch can call a peer's x402-gated endpoint, automatically pay the required amount, and receive the service response
  3. At least one agent-to-agent x402 payment produces a real on-chain devnet USDC transfer viewable on Solscan
  4. The full x402 cycle is demonstrable: 402 response with price, client pays, server verifies payment, server delivers content
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — x402 protocol library: types, Express middleware, wrapFetch client, transaction verification
- [x] 06-02-PLAN.md — Scout and Analyzer x402-gated HTTP servers, integration test with on-chain payment

### Phase 7: Voice Command Interface
**Goal**: Users can speak commands to the system and trigger real on-chain agent actions through ElevenLabs conversational AI
**Depends on**: Phase 2
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04, GOV-03
**Success Criteria** (what must be TRUE):
  1. An ElevenLabs Conversational AI agent is configured with a custom system prompt for the treasury command center role
  2. Speaking "find new grant proposals" or "analyze this proposal" or "fund this project" or "check treasury" triggers the corresponding real agent action through Governance routing
  3. Voice-triggered actions produce real on-chain transactions (not just text responses) -- the same actions that work via API also work via voice
  4. Every voice command has a text-input fallback that produces identical results, protecting the demo if audio fails at the venue
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — VoiceCommandRouter core, text parser, Express voice server with text fallback and signed-URL endpoints
- [ ] 07-02-PLAN.md — ElevenLabs client tools integration, voice session helper, full pipeline integration test

### Phase 8: Frontend Dashboard & Sybil Resistance
**Goal**: A Next.js dashboard visualizes all agent activity, treasury state, and proposals, with Human Passport gating proposal submission
**Depends on**: Phase 5, Phase 6, Phase 7
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, SYBIL-01, SYBIL-02
**Success Criteria** (what must be TRUE):
  1. Dashboard displays all 4 registered agent identities with links to their on-chain Metaplex verification (Solscan/explorer)
  2. Dashboard shows real-time treasury balance, active Meteora LP positions, and yield performance from Treasury Manager data
  3. Dashboard renders the proposal pipeline with status progression: submitted, evaluating, approved, funded
  4. Dashboard includes the ElevenLabs voice command widget and shows x402 payment history between agents
  5. Proposal submission page requires Human Passport verification (humanity score >= 20) before a user can submit -- unverified users are blocked
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md — Next.js workspace scaffold, API routes, agent cards, treasury panel, payment history
- [x] 08-02-PLAN.md — Voice command widget (ElevenLabs) and proposal pipeline visualization
- [x] 08-03-PLAN.md — Human Passport sybil resistance gating proposal submission

### Phase 9: End-to-End Demo Integration
**Goal**: The complete demo flow works reliably from voice command through all agents to on-chain verification, rehearsed and ready for judges
**Depends on**: Phase 6, Phase 7, Phase 8
**Requirements**: DEMO-01, DEMO-02, DEMO-03
**Success Criteria** (what must be TRUE):
  1. The full demo flow executes end-to-end: voice command triggers Scout discovery via Unbrowse, Analyzer evaluates with Claude, Governance decides, Treasury funds on-chain, and the result is verifiable on Solscan
  2. Every agent action in the demo produces a real Solana transaction signature that can be clicked through to a block explorer
  3. Multi-agent coordination is visible during the demo -- observers can see agents communicating, making decisions, and acting in sequence through the dashboard activity feed
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md — x402 HTTP adapters for Scout/Analyzer, activity log module, unit tests
- [x] 09-02-PLAN.md — Demo startup script, dashboard activity feed, end-to-end integration test

### Phase 10: Devnet Bootstrap & Missing Verification
**Goal**: All on-chain agent state exists on devnet and all Phase 3 requirements are formally verified
**Depends on**: Phase 1, Phase 3, Phase 6
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, SCOUT-01, SCOUT-02, SCOUT-03, PAY-02
**Gap Closure:** Closes requirement gaps from v1.0 audit (devnet faucet + missing verification)
**Success Criteria** (what must be TRUE):
  1. Deployer wallet is funded and fund-wallets.ts completes successfully for all 4 agent wallets
  2. register-agents.ts creates 4 MPL Core NFTs in a collection on Solana devnet with AgentIdentityV1 PDAs
  3. verify-agents.ts confirms all 4 agents are registered and verifiable via PDA derivation
  4. Phase 3 VERIFICATION.md exists and confirms SCOUT-01, SCOUT-02, SCOUT-03 are satisfied
  5. PAY-02 integration test runs without skip (funded ATAs available)
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md — Fund deployer wallet, run devnet bootstrap scripts, verify on-chain state and x402 payment
- [ ] 10-02-PLAN.md — Create formal Phase 3 Scout Agent VERIFICATION.md with requirement evidence

### Phase 11: Live Dashboard Wiring
**Goal**: Voice commands, x402 payments, and governance pipeline outcomes flow through to the dashboard in real-time
**Depends on**: Phase 7, Phase 8, Phase 9
**Requirements**: VOICE-02, VOICE-03, GOV-03, PAY-02, DASH-03, DASH-05
**Gap Closure:** Closes integration and flow gaps from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. VoiceWidget.tsx passes clientTools to useConversation/startSession — ElevenLabs voice tool calls trigger real agent actions
  2. X402ScoutAdapter and X402AnalyzerAdapter preserve txSignature from x402 payment responses
  3. Dashboard /api/payments returns live x402 payment data (not just static demo data)
  4. Governance pipeline outcomes update proposals-store stages; mapPipelineStage() is wired and consumed
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md — VoiceWidget clientTools wiring, x402 adapter txSignature preservation
- [ ] 11-02-PLAN.md — Live payment endpoint, proposals-store pipeline stage updates, dashboard proxy wiring

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3/4/5 (parallel) -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Solana Foundation & Agent Identity | 2/2 | Complete   | 2026-03-14 |
| 2. Agent Architecture & Governance Core | 2/2 | Complete   | 2026-03-14 |
| 3. Scout Agent | 1/1 | Complete   | 2026-03-14 |
| 4. Proposal Analyzer Agent | 1/1 | Complete   | 2026-03-14 |
| 5. Treasury Manager Agent | 2/2 | Complete   | 2026-03-14 |
| 6. x402 Agent Payment Economy | 2/2 | Complete   | 2026-03-14 |
| 7. Voice Command Interface | 1/2 | In progress | - |
| 8. Frontend Dashboard & Sybil Resistance | 3/3 | Complete   | 2026-03-15 |
| 9. End-to-End Demo Integration | 2/2 | Complete   | 2026-03-15 |
| 10. Devnet Bootstrap & Missing Verification | 2/2 | Complete    | 2026-03-15 |
| 11. Live Dashboard Wiring | 2/2 | Complete   | 2026-03-15 |
