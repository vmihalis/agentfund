# AgentFund

**Autonomous AI agents coordinating real funding on Solana**

A multi-agent treasury system where four Claude-powered AI agents discover, evaluate, and fund projects entirely on-chain. Agents pay each other for services via x402 micropayments, hold verified identities on the Metaplex Agent Registry, and execute real SOL/USDC transfers on Solana devnet — no human in the loop.

## How It Works

```
  Voice / Text Command
        │
        ▼
  ┌─────────────┐     x402 payment      ┌─────────────┐
  │  Governance  │ ──────────────────▶   │    Scout     │
  │    Agent     │   "discover projects" │    Agent     │
  │              │                       │  (Unbrowse)  │
  │  Orchestrates│   x402 payment        └──────┬───────┘
  │  pipeline &  │ ──────────────────▶          │
  │  decisions   │   "evaluate these"    ┌──────▼───────┐
  │   (Claude)   │                       │   Analyzer   │
  │              │                       │    Agent     │
  │              │                       │   (Claude)   │
  │              │                       └──────┬───────┘
  │              │                              │
  │              │   funding decision           │
  │              │◀─────────────────────────────┘
  │              │
  │              │   SOL/USDC transfer   ┌─────────────┐
  │              │ ──────────────────▶   │  Treasury   │
  │              │   "fund approved"     │    Agent    │
  └─────────────┘                       │  (Solana)   │
                                        └─────────────┘
        All 4 agents registered on Metaplex Agent Registry
        with verified on-chain identities (Core NFTs + PDAs)
```

### The Four Agents

| Agent | Role | Key Tech |
|-------|------|----------|
| **Scout** | Discovers grant proposals from the web | Unbrowse API for web scraping, Claude for structuring raw data into typed proposals |
| **Analyzer** | Evaluates proposal quality and viability | Claude API with structured output (Zod schemas), multi-criteria scoring |
| **Treasury** | Manages funds and executes on-chain transfers | Solana web3.js, SPL tokens, Meteora DLMM liquidity pools |
| **Governance** | Orchestrates the pipeline, makes funding decisions | Claude API for decision-making with detailed reasoning, x402 for paying other agents |

### The Pipeline

1. **Discover** — Governance pays Scout (via x402) to find projects matching a query. Scout scrapes real web data through Unbrowse and uses Claude to structure it into typed proposals.
2. **Evaluate** — Governance pays Analyzer (via x402) to score each proposal on technical merit, team strength, feasibility, and impact.
3. **Decide** — Governance feeds evaluations to Claude with the available budget. Claude returns structured funding decisions with per-proposal reasoning.
4. **Fund** — Treasury executes approved allocations as real SPL token transfers on Solana devnet, with transaction signatures linking to Solscan.

## Architecture

```
src/
├── agents/
│   ├── scout-agent.ts          # Web discovery via Unbrowse + Claude
│   ├── analyzer-agent.ts       # AI evaluation with structured scoring
│   ├── treasury-agent.ts       # On-chain SOL/USDC transfers + Meteora LP
│   ├── governance-agent.ts     # Pipeline orchestration + Claude decisions
│   └── adapters/
│       ├── x402-scout-adapter.ts    # x402 payment wrapper for Scout
│       └── x402-analyzer-adapter.ts # x402 payment wrapper for Analyzer
├── events/
│   ├── event-bus.ts            # Typed EventEmitter for agent coordination
│   ├── event-types.ts          # AgentStatus, PipelineStep, Decision events
│   └── activity-log.ts         # Ordered activity feed from all events
├── lib/
│   ├── metaplex/               # Agent Registry (Core NFTs + AgentIdentityV1 PDAs)
│   ├── meteora/                # DLMM liquidity pool management
│   ├── solana/                 # Connection, token accounts, transfers
│   ├── unbrowse/               # Web data discovery client
│   └── x402/                   # HTTP 402 payment protocol (auto-pay on 402)
├── servers/
│   ├── scout-server.ts         # Express server with x402-gated /discover
│   └── analyzer-server.ts      # Express server with x402-gated /evaluate
├── voice/
│   ├── voice-command-router.ts # Maps intents to agent actions
│   ├── voice-server.ts         # ElevenLabs voice + text REST API
│   └── voice-tools.ts          # ElevenLabs clientTools definitions
└── types/
    ├── agents.ts               # AgentRole enum (scout, analyzer, treasury, governance)
    └── proposals.ts            # Proposal, Evaluation, Decision, Transaction types

dashboard/                      # Next.js real-time dashboard
```

## On-Chain Identity

All four agents are registered on the **Metaplex Agent Registry** with verified on-chain identities:

| Agent | Wallet | Verified |
|-------|--------|----------|
| Scout | `EMKv...Rcej` | Yes |
| Analyzer | `DeUf...FMfu` | Yes |
| Treasury | `7vmy...st9L` | Yes |
| Governance | `2pVL...b2PB` | Yes |

Each agent has a Core NFT asset and an AgentIdentityV1 PDA, all under a shared collection (`GiFv...5UTT`). Registration and verification scripts: `pnpm register-agents` / `pnpm verify-agents`.

## Tech Stack

- **Solana** — On-chain transfers (SOL + SPL tokens) on devnet
- **Metaplex Agent Registry** — Verified agent identities via Core NFTs + PDAs
- **Meteora DLMM** — Liquidity pool management for treasury diversification
- **x402** — HTTP 402 micropayment protocol for inter-agent payments
- **Unbrowse** — Web data discovery without headless browsers
- **Claude API** — Proposal evaluation, funding decisions, web data structuring
- **ElevenLabs** — Voice command interface with clientTools
- **Human Passport** — Sybil-resistant identity verification
- **Next.js** — Real-time dashboard with activity feed

## Quickstart

```bash
# Install dependencies
pnpm install

# Generate agent wallets, fund them, register on Metaplex
pnpm setup

# Start all servers (Scout :4001, Analyzer :4002, Voice :4003)
npx tsx scripts/demo.ts

# In a separate terminal, start the dashboard
cd dashboard && pnpm dev
# Open http://localhost:3000
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API for evaluation and decisions |
| `SOLANA_RPC_URL` | No | Defaults to devnet |
| `UNBROWSE_URL` | No | Defaults to `http://localhost:6969` |
| `ELEVENLABS_API_KEY` | No | Voice interface (text fallback available) |

## Demo

Run the full pipeline with a voice or text command:

```bash
# Text command via REST API
curl -X POST http://localhost:4003/api/voice/command \
  -H "Content-Type: application/json" \
  -d '{"text": "find promising solana projects and fund the best ones with 5 SOL"}'
```

The system will:
1. Scout discovers projects via Unbrowse (paying via x402)
2. Analyzer evaluates each proposal with Claude (paying via x402)
3. Governance makes funding decisions with detailed reasoning
4. Treasury executes on-chain transfers with Solscan-linked signatures

## License

MIT
