# Requirements: AgentFund

**Defined:** 2026-03-14
**Core Value:** Autonomous AI agents that coordinate real funding decisions on Solana -- registered on-chain, paying each other for services, and explaining their reasoning to humans.

## v1 Requirements

Requirements for hackathon submission. Each maps to roadmap phases.

### Agent Identity

- [ ] **IDENT-01**: 4 AI agents registered on-chain via Metaplex Agent Registry (MPL Core NFT + AgentIdentityV1 PDA each)
- [ ] **IDENT-02**: Each agent has its own Solana keypair, funded wallet, and Associated Token Account for devnet USDC
- [ ] **IDENT-03**: Agent identities verifiable by any third party via PDA derivation and AppData plugin inspection
- [ ] **IDENT-04**: MPL Core NFT collection created for AgentFund agent group

### Agent Payments

- [ ] **PAY-01**: x402 micropayment flow between agents using Corbits/Faremeter SDK (402 response -> payment -> content)
- [ ] **PAY-02**: At least one agent-to-agent x402 payment with real on-chain USDC transfer on devnet
- [ ] **PAY-03**: x402 server middleware gating agent service endpoints (returns 402 with payment requirements)
- [ ] **PAY-04**: x402 client wrapper (wrapFetch) enabling agents to automatically pay for peer services

### Scout Agent

- [ ] **SCOUT-01**: Scout agent discovers grant proposals and funding opportunities via Unbrowse intent resolution
- [ ] **SCOUT-02**: Scout calls Unbrowse `/v1/intent/resolve` with natural language intents for grant platform data
- [ ] **SCOUT-03**: Scout returns structured proposal data (title, description, amount, team info) to Governance Agent
- [ ] **SCOUT-04**: Scout exposes x402-gated endpoint for paid data discovery services

### Proposal Analyzer

- [ ] **ANLZ-01**: Proposal Analyzer evaluates proposals using Claude API with structured scoring rubric
- [ ] **ANLZ-02**: Evaluation includes explained reasoning (why fund/reject) visible to humans
- [ ] **ANLZ-03**: Analyzer scores proposals on: team quality, technical feasibility, impact potential, budget reasonableness
- [ ] **ANLZ-04**: Analyzer exposes x402-gated endpoint for paid evaluation services

### Treasury Manager

- [ ] **TREAS-01**: Treasury Manager holds and tracks fund balances on Solana devnet
- [ ] **TREAS-02**: Treasury Manager executes SPL token transfers for approved funding decisions
- [ ] **TREAS-03**: Treasury Manager creates and manages at least one Meteora DLMM LP position for idle treasury yield
- [ ] **TREAS-04**: Treasury Manager can remove liquidity and claim rewards from DLMM positions
- [ ] **TREAS-05**: Treasury Manager reports treasury status (balance, LP positions, yield) on request

### Governance Agent

- [ ] **GOV-01**: Governance Agent coordinates the full funding pipeline: Scout discovers -> Analyzer evaluates -> Treasury funds
- [ ] **GOV-02**: Governance Agent aggregates agent evaluations and makes final allocation decisions
- [ ] **GOV-03**: Governance Agent routes voice commands to appropriate specialist agents
- [ ] **GOV-04**: Governance Agent produces decision summaries with reasoning for each funding action

### Voice Interface

- [ ] **VOICE-01**: ElevenLabs Conversational AI agent configured with custom system prompt for treasury command center
- [ ] **VOICE-02**: Client tools map voice commands to agent actions (findProposals, analyzeProposal, fundProject, checkTreasury)
- [ ] **VOICE-03**: Voice interactions trigger real on-chain agent actions (not just text responses)
- [ ] **VOICE-04**: Text-input fallback for all voice commands (protects demo if audio fails)

### Sybil Resistance

- [ ] **SYBIL-01**: Human Passport Embed component gating proposal submission page
- [ ] **SYBIL-02**: Users must verify humanity (score >= 20) before submitting proposals

### Frontend Dashboard

- [ ] **DASH-01**: Next.js dashboard showing registered agent identities with on-chain verification links
- [ ] **DASH-02**: Dashboard displays treasury balance, LP positions, and yield performance
- [ ] **DASH-03**: Dashboard shows proposal pipeline (submitted, evaluating, approved, funded)
- [ ] **DASH-04**: Dashboard includes voice command center (ElevenLabs widget)
- [ ] **DASH-05**: Dashboard shows x402 payment history between agents

### Demo & Integration

- [ ] **DEMO-01**: End-to-end demo flow working: voice command -> Scout -> Analyze -> Fund -> verify on Solscan
- [ ] **DEMO-02**: All agent actions produce real Solana transaction signatures viewable on explorer
- [ ] **DEMO-03**: Multi-agent coordination visible (agents communicating and acting in sequence)

## v2 Requirements

Deferred to post-hackathon. Tracked but not in current roadmap.

### Frontier Tower

- **TOWER-01**: RAG knowledge base with Frontier Tower building data (floors, resources, members)
- **TOWER-02**: Cross-floor resource matching via agent ("Find someone who knows PCB design")
- **TOWER-03**: Floor treasury management on Solana (one wallet per governed floor)
- **TOWER-04**: Governance document viewer ("What's Floor 12's governance mechanism?")

### Advanced Treasury

- **ADVTR-01**: Multi-strategy DLMM portfolio across multiple token pairs
- **ADVTR-02**: Automated yield rebalancing based on market conditions
- **ADVTR-03**: On-chain reasoning trail via Metaplex Core Attributes plugin

### Advanced Coordination

- **ADVCO-01**: Governance voting simulation with weighted agent inputs
- **ADVCO-02**: Real-time agent activity feed via WebSocket
- **ADVCO-03**: Agent payment analytics graph visualization

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full DAO governance (SPL Governance / Realms) | Massive complexity, 20+ hours alone; agent coordination is sufficient |
| Mainnet deployment | Risk of real fund loss; devnet is standard for hackathon demos |
| DBC token launch (Meteora Dynamic Bonding Curve) | Less documented, not core Meteora bounty ask; DLMM LP management is priority |
| Custom token creation ("AGENTFUND" token) | Adds no value for judges; use existing devnet tokens |
| Mobile app or responsive mobile design | Web-first is fine for hackathon demo |
| Multi-language voice support | English-only is sufficient |
| Agent-to-agent natural language chat | Structured API calls are more reliable; NL chat is a time sink |
| Automated rebalancing loops | Demo stability risk; use triggered rebalancing instead |
| Complex RBAC or user authentication | Single admin mode is fine; Passport handles sybil for submitters |
| solana-agent-kit | Too generic, doesn't support mpl-agent-registry; custom orchestrator instead |
| LangChain | Unnecessary abstraction layer for this use case |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IDENT-01 | Phase 1 | Pending |
| IDENT-02 | Phase 1 | Pending |
| IDENT-03 | Phase 1 | Pending |
| IDENT-04 | Phase 1 | Pending |
| GOV-01 | Phase 2 | Pending |
| GOV-02 | Phase 2 | Pending |
| GOV-04 | Phase 2 | Pending |
| SCOUT-01 | Phase 3 | Pending |
| SCOUT-02 | Phase 3 | Pending |
| SCOUT-03 | Phase 3 | Pending |
| ANLZ-01 | Phase 4 | Pending |
| ANLZ-02 | Phase 4 | Pending |
| ANLZ-03 | Phase 4 | Pending |
| TREAS-01 | Phase 5 | Pending |
| TREAS-02 | Phase 5 | Pending |
| TREAS-03 | Phase 5 | Pending |
| TREAS-04 | Phase 5 | Pending |
| TREAS-05 | Phase 5 | Pending |
| PAY-01 | Phase 6 | Pending |
| PAY-02 | Phase 6 | Pending |
| PAY-03 | Phase 6 | Pending |
| PAY-04 | Phase 6 | Pending |
| SCOUT-04 | Phase 6 | Pending |
| ANLZ-04 | Phase 6 | Pending |
| VOICE-01 | Phase 7 | Pending |
| VOICE-02 | Phase 7 | Pending |
| VOICE-03 | Phase 7 | Pending |
| VOICE-04 | Phase 7 | Pending |
| GOV-03 | Phase 7 | Pending |
| DASH-01 | Phase 8 | Pending |
| DASH-02 | Phase 8 | Pending |
| DASH-03 | Phase 8 | Pending |
| DASH-04 | Phase 8 | Pending |
| DASH-05 | Phase 8 | Pending |
| SYBIL-01 | Phase 8 | Pending |
| SYBIL-02 | Phase 8 | Pending |
| DEMO-01 | Phase 9 | Pending |
| DEMO-02 | Phase 9 | Pending |
| DEMO-03 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation (9-phase fine-grained structure)*
