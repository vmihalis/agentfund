# AgentFund

## What This Is

AgentFund is an autonomous multi-agent AI treasury system on Solana for the "Intelligence at the Frontier" hackathon (March 14-15, 2026). Four AI agents -- Scout, Proposal Analyzer, Treasury Manager, and Governance -- coordinate grant funding decisions on Solana. Each agent is registered on-chain via Metaplex Agent Registry with x402 micropayments between agents. The system includes voice command via ElevenLabs, sybil resistance via Human Passport, yield optimization on Meteora, web data via Unbrowse, and deployment as Frontier Tower's building coordinator agent.

## Core Value

Autonomous AI agents that coordinate real funding decisions on Solana -- registered on-chain, paying each other for services, and explaining their reasoning to humans.

## Requirements

### Validated

(None yet -- ship to validate)

### Active

- [ ] 4 AI agents registered on-chain via Metaplex Agent Registry (Scout, Proposal Analyzer, Treasury Manager, Governance)
- [ ] Agent-to-agent micropayments via x402/Corbits SDK
- [ ] Scout agent discovers grant proposals and web data via Unbrowse
- [ ] Proposal Analyzer evaluates proposals using Claude with explained reasoning
- [ ] Treasury Manager manages funds on Solana and LP positions on Meteora DLMM
- [ ] Governance Agent coordinates decisions across all agents
- [ ] ElevenLabs voice command center interface for conversational interaction
- [ ] Human Passport Embed for sybil-resistant proposal submission
- [ ] Frontier Tower deployment context (community RAG, floor treasuries, resource matching)
- [ ] Next.js frontend dashboard showing agent activity, treasury, and proposals
- [ ] Working demo with real on-chain actions (not just dashboards)

### Out of Scope

- Production mainnet deployment -- devnet for hackathon demo
- Mobile app -- web-first only
- Full DAO governance (SPL Governance / Realms) -- simplified agent coordination
- DBC token launch integration -- focus on DLMM LP management for Meteora
- Real money / mainnet USDC -- devnet tokens only
- Multi-language voice support -- English only for demo

## Context

**Hackathon:** Intelligence at the Frontier / Funding the Commons SF (March 14-15, 2026) at Frontier Tower, 995 Market Street, San Francisco.

**Target bounties (7 total, $11,400+ potential):**

| Bounty | Prize | Integration |
|--------|-------|-------------|
| Metaplex Onchain Agent | $5,000 | CORE -- all agents registered via mpl-agent-registry |
| Solana Main Track | $1,200 | CORE -- everything runs on Solana |
| Unbrowse Challenge | $1,500 | DEEP -- Scout agent's primary capability |
| Meteora Challenge | $1,000 | DEEP -- Treasury Manager's yield strategy |
| Frontier Tower Agent | $500 | MEDIUM -- deployment as building coordinator |
| human.tech BONUS | $1,200 | EASY -- Passport Embed for sybil resistance |
| ElevenLabs BONUS | credits | MEDIUM -- voice command center |

**Architecture:**
- 4 agents each with Metaplex on-chain identity (MPL Core NFT + AgentIdentityV1 PDA)
- Inter-agent communication and payment via x402 protocol
- Scout uses Unbrowse (localhost:6969) to discover web data
- Proposal Analyzer uses Claude API for evaluation with explained reasoning
- Treasury Manager uses Meteora DLMM SDK for LP positions and yield
- Governance Agent coordinates decisions and interfaces with humans via ElevenLabs voice
- Human Passport Embed gates proposal submission (sybil resistance)
- Frontier Tower context: RAG knowledge base of building data, floor treasuries, member matching

**Solo developer with parallel Claude Code agents building different modules simultaneously.**

**Judging criteria:** Innovation, Technical Execution, Impact, Completeness, UX. Judges want agents that take real actions, explain reasoning, and demonstrate multi-agent coordination.

**Demo flow (5 minutes):**
1. Show 4 agents registered on Solana via Metaplex (on-chain identities)
2. Voice: "Scout, find new grant proposals" -> Unbrowse web data
3. Voice: "Analyze this proposal" -> Claude evaluation with reasoning
4. Voice: "Fund this project" -> Governance coordinates, Treasury executes on-chain
5. Show Meteora LP positions earning yield on idle treasury
6. Show x402 agent-to-agent payments
7. Frontier Tower context: building coordinator
8. Human Passport: sybil-resistant access

## Constraints

- **Timeline**: ~20 hours total build time, demo by Sunday 1PM PT March 15
- **Solo dev**: One person orchestrating parallel Claude Code agents
- **Network**: Solana devnet (not mainnet)
- **Tech stack**: TypeScript, Node.js, Next.js -- all modules must be TypeScript-compatible
- **Dependencies**: Metaplex Agent Registry (`@metaplex-foundation/mpl-agent-registry`), Corbits x402 SDK (`@faremeter/payment-solana`), Unbrowse (localhost:6969), Meteora DLMM (`@meteora-ag/dlmm`), Claude API (`@anthropic-ai/sdk`), ElevenLabs (`@elevenlabs/react`, `@elevenlabs/client`), Human Passport (`@human.tech/passport-embed`), Solana Agent Kit (`solana-agent-kit`)
- **Umi framework**: Required for Metaplex (not regular @solana/web3.js for registry ops)
- **Demo quality**: Must show agents taking real actions -- not just dashboards

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over Python | All SDKs have TS support; Next.js frontend; Solana Agent Kit TS is primary | -- Pending |
| Solana devnet | Hackathon demo, no real funds needed, faucets available | -- Pending |
| Corbits SDK for x402 | Most mature Solana x402 implementation, wrapped fetch pattern | -- Pending |
| ElevenLabs Agents Platform (not raw TTS) | Judges want agentic depth, not just TTS wrappers; full conversation orchestration | -- Pending |
| Passport Embed (not full WaaP) | 15-min integration vs 45-min; sybil resistance is the requirement | -- Pending |
| Coarse parallelization (2-3 parallel agents per phase) | Solo dev managing multiple Claude Code sessions; too many = integration hell | -- Pending |
| DLMM focus for Meteora (not DBC) | DLMM is better documented, LP management is the core ask; DBC is stretch | -- Pending |

---
*Last updated: 2026-03-14 after initialization*
