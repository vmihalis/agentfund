# Roadmap: AgentFund

## Overview

AgentFund delivers an autonomous multi-agent AI treasury system on Solana in 9 phases. The roadmap moves from blockchain foundation (agent identities on-chain) through individual agent capabilities (Scout, Analyzer, Treasury) to coordination layers (x402 payments, voice, dashboard) and culminates in a polished end-to-end demo. Phases 3-5 are parallelizable once the coordination architecture exists. The structure targets 7 bounties totaling $11,400+ at Funding the Commons SF.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Solana Foundation & Agent Identity** - Keypairs, wallets, token accounts, and 4 Metaplex on-chain agent registrations (completed 2026-03-14)
- [ ] **Phase 2: Agent Architecture & Governance Core** - BaseAgent class, event bus, and Governance Agent coordination logic
- [ ] **Phase 3: Scout Agent** - Web data discovery via Unbrowse intent resolution
- [ ] **Phase 4: Proposal Analyzer Agent** - Claude-powered proposal evaluation with scored reasoning
- [ ] **Phase 5: Treasury Manager Agent** - Fund management and Meteora DLMM LP positions
- [ ] **Phase 6: x402 Agent Payment Economy** - Micropayment flows gating agent service endpoints
- [ ] **Phase 7: Voice Command Interface** - ElevenLabs conversational AI with agent action triggers
- [ ] **Phase 8: Frontend Dashboard & Sybil Resistance** - Next.js monitoring dashboard and Human Passport gate
- [ ] **Phase 9: End-to-End Demo Integration** - Full pipeline verification and demo rehearsal

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
- [ ] 02-01-PLAN.md — Type definitions, TypedEventBus, BaseAgent, agent interfaces, stub implementations
- [ ] 02-02-PLAN.md — GovernanceAgent with Claude API pipeline orchestration and decision summaries

### Phase 3: Scout Agent
**Goal**: The Scout agent discovers real grant proposals from the web and delivers structured data to the Governance Agent
**Depends on**: Phase 2
**Requirements**: SCOUT-01, SCOUT-02, SCOUT-03
**Success Criteria** (what must be TRUE):
  1. Issuing a "find grant proposals" command to Scout triggers an Unbrowse intent resolution call to localhost:6969 and returns real web data
  2. Scout returns structured proposal objects (title, description, amount, team info) to the Governance Agent via the event bus
  3. Scout handles Unbrowse unavailability gracefully with stub/cached data so the demo pipeline never breaks
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Proposal Analyzer Agent
**Goal**: The Proposal Analyzer evaluates any proposal with Claude and returns a scored, explained assessment visible to humans
**Depends on**: Phase 2
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03
**Success Criteria** (what must be TRUE):
  1. Given a proposal, the Analyzer calls Claude API and returns a structured evaluation with scores for team quality, technical feasibility, impact potential, and budget reasonableness
  2. Every evaluation includes human-readable explained reasoning (why fund or reject) that can be displayed in the dashboard
  3. The Analyzer communicates results back to the Governance Agent via the event bus for aggregation into funding decisions
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

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
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: x402 Agent Payment Economy
**Goal**: Agents pay each other for services using x402 micropayments with real on-chain USDC transfers on devnet
**Depends on**: Phase 3, Phase 4
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, SCOUT-04, ANLZ-04
**Success Criteria** (what must be TRUE):
  1. Scout and Analyzer each expose HTTP endpoints gated by x402 middleware that returns a 402 response with payment requirements to unauthenticated callers
  2. An agent using wrapFetch can call a peer's x402-gated endpoint, automatically pay the required amount, and receive the service response
  3. At least one agent-to-agent x402 payment produces a real on-chain devnet USDC transfer viewable on Solscan
  4. The full x402 cycle is demonstrable: 402 response with price, client pays, server verifies payment, server delivers content
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Voice Command Interface
**Goal**: Users can speak commands to the system and trigger real on-chain agent actions through ElevenLabs conversational AI
**Depends on**: Phase 2
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04, GOV-03
**Success Criteria** (what must be TRUE):
  1. An ElevenLabs Conversational AI agent is configured with a custom system prompt for the treasury command center role
  2. Speaking "find new grant proposals" or "analyze this proposal" or "fund this project" or "check treasury" triggers the corresponding real agent action through Governance routing
  3. Voice-triggered actions produce real on-chain transactions (not just text responses) -- the same actions that work via API also work via voice
  4. Every voice command has a text-input fallback that produces identical results, protecting the demo if audio fails at the venue
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: End-to-End Demo Integration
**Goal**: The complete demo flow works reliably from voice command through all agents to on-chain verification, rehearsed and ready for judges
**Depends on**: Phase 6, Phase 7, Phase 8
**Requirements**: DEMO-01, DEMO-02, DEMO-03
**Success Criteria** (what must be TRUE):
  1. The full demo flow executes end-to-end: voice command triggers Scout discovery via Unbrowse, Analyzer evaluates with Claude, Governance decides, Treasury funds on-chain, and the result is verifiable on Solscan
  2. Every agent action in the demo produces a real Solana transaction signature that can be clicked through to a block explorer
  3. Multi-agent coordination is visible during the demo -- observers can see agents communicating, making decisions, and acting in sequence through the dashboard activity feed
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3/4/5 (parallel) -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Solana Foundation & Agent Identity | 2/2 | Complete   | 2026-03-14 |
| 2. Agent Architecture & Governance Core | 0/2 | Not started | - |
| 3. Scout Agent | 0/1 | Not started | - |
| 4. Proposal Analyzer Agent | 0/1 | Not started | - |
| 5. Treasury Manager Agent | 0/2 | Not started | - |
| 6. x402 Agent Payment Economy | 0/2 | Not started | - |
| 7. Voice Command Interface | 0/2 | Not started | - |
| 8. Frontend Dashboard & Sybil Resistance | 0/3 | Not started | - |
| 9. End-to-End Demo Integration | 0/1 | Not started | - |
