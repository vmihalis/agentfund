# AgentFund

## What This Is

AgentFund is an autonomous multi-agent AI treasury system on Solana, built for the "Intelligence at the Frontier" hackathon (March 14-15, 2026). Four AI agents -- Scout, Proposal Analyzer, Treasury Manager, and Governance -- coordinate grant funding decisions on Solana with real on-chain transactions. Each agent is registered via Metaplex Agent Registry, agents pay each other for services via x402 micropayments, and humans interact through ElevenLabs voice commands and a Next.js monitoring dashboard with Human Passport sybil resistance.

## Core Value

Autonomous AI agents that coordinate real funding decisions on Solana -- registered on-chain, paying each other for services, and explaining their reasoning to humans.

## Requirements

### Validated

- ✓ 4 AI agents registered on-chain via Metaplex Agent Registry (MPL Core NFT + AgentIdentityV1 PDA) — v1.0
- ✓ Each agent has funded Solana wallet and Associated Token Account for devnet USDC — v1.0
- ✓ Agent identities verifiable by third parties via PDA derivation — v1.0
- ✓ MPL Core NFT collection for AgentFund agent group — v1.0
- ✓ Agent-to-agent micropayments via x402 protocol with real on-chain USDC transfers — v1.0
- ✓ x402 server middleware gating agent service endpoints — v1.0
- ✓ x402 client wrapper (wrapFetch) for automatic paid service access — v1.0
- ✓ Scout agent discovers grant proposals via Unbrowse intent resolution — v1.0
- ✓ Scout returns structured proposal data to Governance Agent — v1.0
- ✓ Scout exposes x402-gated endpoint for paid discovery services — v1.0
- ✓ Proposal Analyzer evaluates proposals using Claude API with structured scoring — v1.0
- ✓ Analyzer provides human-readable explained reasoning — v1.0
- ✓ Analyzer exposes x402-gated endpoint for paid evaluation services — v1.0
- ✓ Treasury Manager tracks fund balances on Solana devnet — v1.0
- ✓ Treasury Manager executes SPL token transfers for approved grants — v1.0
- ✓ Treasury Manager creates and manages Meteora DLMM LP positions — v1.0
- ✓ Treasury Manager removes liquidity and claims rewards — v1.0
- ✓ Treasury Manager reports status (balance, LP, yield) on request — v1.0
- ✓ Governance Agent coordinates full funding pipeline — v1.0
- ✓ Governance Agent aggregates evaluations and makes allocation decisions — v1.0
- ✓ Governance Agent routes voice commands to specialist agents — v1.0
- ✓ Governance Agent produces decision summaries with reasoning — v1.0
- ✓ ElevenLabs Conversational AI with custom system prompt — v1.0
- ✓ Client tools map voice commands to agent actions — v1.0
- ✓ Voice interactions trigger real on-chain agent actions — v1.0
- ✓ Text-input fallback for all voice commands — v1.0
- ✓ Human Passport gating proposal submission (score >= 20) — v1.0
- ✓ Next.js dashboard showing agent identities with on-chain verification — v1.0
- ✓ Dashboard displays treasury balance, LP positions, yield — v1.0
- ✓ Dashboard shows proposal pipeline with stage progression — v1.0
- ✓ Dashboard includes voice command center — v1.0
- ✓ Dashboard shows x402 payment history between agents — v1.0
- ✓ E2E demo flow: voice → Scout → Analyze → Fund → Solscan verification — v1.0
- ✓ All agent actions produce real Solana transaction signatures — v1.0
- ✓ Multi-agent coordination visible through dashboard activity feed — v1.0

### Active

(None — all v1.0 requirements validated. Next milestone will define new requirements.)

### Out of Scope

- Production mainnet deployment — devnet for hackathon demo
- Mobile app — web-first only
- Full DAO governance (SPL Governance / Realms) — simplified agent coordination sufficient
- DBC token launch — focus on DLMM LP management for Meteora bounty
- Real money / mainnet USDC — devnet tokens only
- Multi-language voice support — English only for demo
- Agent-to-agent natural language chat — structured API calls more reliable
- Automated rebalancing loops — demo stability risk
- solana-agent-kit — too generic, doesn't support mpl-agent-registry

## Context

**Shipped v1.0 MVP** with 13,807 LOC TypeScript across 216 files in 2 days.

**Tech stack:** TypeScript, Node.js, Next.js, Solana (web3.js + Umi), Metaplex Agent Registry, x402 protocol, Claude API, ElevenLabs, Human Passport, Meteora DLMM, Unbrowse.

**Architecture:** 4 agents (Scout, Analyzer, Treasury, Governance) with typed event bus coordination, x402 HTTP payment layer, Express voice server, and Next.js dashboard.

**Target bounties (7 total, $11,400+):** Metaplex Onchain Agent ($5k), Solana Main Track ($1.2k), Unbrowse ($1.5k), Meteora ($1k), Frontier Tower ($500), human.tech ($1.2k), ElevenLabs (credits).

**Known tech debt (12 items):**
- Meteora DLMM tokenX/tokenY empty strings in LP queries
- 6 TypeScript errors in dlmm-client.ts (Meteora SDK type mismatch)
- PassportGate production mode wallet stub
- Orphaned exports (createVoiceSession, mapPipelineStage)
- TREAS-03/TREAS-04 not in cross-phase demo path

## Constraints

- **Network**: Solana devnet (not mainnet)
- **Tech stack**: TypeScript, Node.js, Next.js -- all modules TypeScript-compatible
- **Demo quality**: Must show agents taking real actions -- not just dashboards
- **Dependencies**: Metaplex Agent Registry, x402/Corbits, Unbrowse, Meteora DLMM, Claude API, ElevenLabs, Human Passport

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over Python | All SDKs have TS support; Next.js frontend | ✓ Good |
| Solana devnet | Hackathon demo, no real funds needed | ✓ Good |
| Native x402 over Corbits SDK | SDK requires @solana/kit v2 (conflict with web3.js v1) | ✓ Good |
| ElevenLabs Agents Platform | Judges want agentic depth, not just TTS | ✓ Good |
| Passport Embed over full WaaP | 15-min integration; sybil resistance is the requirement | ✓ Good |
| DLMM focus for Meteora | Better documented, core bounty ask | ✓ Good |
| Express 5 (latest) | API compatible with Express 4, already stable | ✓ Good |
| Zod v4 native toJSONSchema | zod-to-json-schema produces empty schemas with Zod v4 | ✓ Good |
| 2-second polling for activity feed | Demo simplicity over WebSocket complexity | ✓ Good |
| DEMO_USDC over official devnet USDC | Official exists but cannot be minted for tests | ✓ Good |
| SOL transfer fallback for funding | Faucet rate-limits; deployer distributes directly | ✓ Good |

---
*Last updated: 2026-03-15 after v1.0 milestone*
