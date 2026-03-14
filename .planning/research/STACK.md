# Technology Stack

**Project:** AgentFund -- Autonomous Multi-Agent AI Treasury on Solana
**Researched:** 2026-03-14
**Overall Confidence:** MEDIUM-HIGH (core stack verified via npm/docs; some hackathon-era SDKs are v0.x with limited documentation)

---

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 20 LTS | Runtime | Stable LTS, all SDKs tested against it. Do NOT use Node 22+ -- the Umi framework and some Solana libs have ESM/CJS interop issues on newer Node | HIGH |
| TypeScript | ~5.4 | Language | All SDKs ship TS types. Required by Umi, Solana Agent Kit, and Anthropic SDK. Project constraint from PROJECT.md | HIGH |
| pnpm | 9.x | Package manager | Handles the monorepo-style dependency graph better than npm. Avoids phantom dependencies between Metaplex/Solana packages that npm hoists incorrectly | MEDIUM |

### Frontend Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 15.x (use 15, NOT 16) | Frontend + API routes | 16.1.6 is latest but includes breaking changes to middleware and server actions. 15.x is battle-tested for hackathon speed. API routes serve as agent orchestration endpoints | HIGH |
| React | 18.x (via Next.js 15) | UI | Peer dependency for `@elevenlabs/react` and `@human.tech/passport-embed`. React 19 with Next 16 is too bleeding-edge for a hackathon | HIGH |
| Tailwind CSS | 3.x | Styling | Fast iteration, no design system needed for hackathon demo | HIGH |

### Solana Core

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@solana/web3.js` | 1.98.4 | Solana connection, transactions, keypairs | Required by Meteora DLMM SDK and general Solana ops. Do NOT use v2.x -- DLMM and Anchor still depend on v1.x | HIGH |
| `@coral-xyz/anchor` | 0.32.1 | Anchor program interaction | Required peer dep for Meteora DLMM. Used for interacting with any Anchor-based programs on devnet | HIGH |
| `@metaplex-foundation/umi` | 1.5.1 | Metaplex transaction framework | Required for ALL Metaplex operations. Replaces direct web3.js for Metaplex interactions. Provides its own signer/transaction/RPC abstraction | HIGH |
| `@metaplex-foundation/umi-bundle-defaults` | 1.5.1 | Umi RPC and signer setup | Convenience bundle that wires Umi to a Solana RPC endpoint with default plugins | HIGH |

### Agent Identity -- Metaplex Agent Registry (CORE BOUNTY: $5,000)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@metaplex-foundation/mpl-agent-registry` | 0.2.0 | On-chain agent identity, reputation, tools, validation | THE hackathon bounty package. Provides 4 Umi plugins: `mplAgentIdentity()`, `mplAgentReputation()`, `mplAgentValidation()`, `mplAgentTools()`. Published 2026-03-11 (3 days ago). Very new, limited docs | MEDIUM |
| `@metaplex-foundation/mpl-core` | 1.8.0 | MPL Core NFT standard | Each agent is a Core Asset (NFT). Agent identity PDA is derived from the asset address. Required foundation for agent registry | HIGH |
| `@metaplex-foundation/mpl-toolbox` | ^0.10.0 | Utility instructions | Peer dep of mpl-agent-registry. Provides createSignerFromKeypair, sol airdrop helpers | HIGH |

**Architecture Detail -- How Agent Identity Works:**

The mpl-agent-registry package is built on 4 on-chain programs:

1. **Identity Program** (`1DREGFgysWYxLnRnKQnwrxnJQeSMk2HmGaC6whw2B2p`):
   - `registerIdentityV1(context, { asset, agentRegistrationUri })` -- Creates AgentIdentityV1 PDA derived from a Core Asset
   - PDA stores: `key`, `bump`, `asset` (PublicKey back-reference)
   - Requires a Core Asset (NFT) + optional Collection, plus a `agentRegistrationUri` (metadata URL)

2. **Reputation Program**: `registerReputationV1()` -- Attaches reputation PDA to an agent asset

3. **Validation Program**: `registerValidationV1()` -- Attaches validation PDA to an agent asset

4. **Tools Program**: `registerExecutiveV1()` + `delegateExecutionV1()` -- Registers execution profiles and delegates authority

**Implementation pattern:**
```typescript
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore, createV1, createCollectionV1 } from '@metaplex-foundation/mpl-core';
import { mplAgentIdentity, registerIdentityV1, findAgentIdentityV1Pda } from '@metaplex-foundation/mpl-agent-registry';

const umi = createUmi('https://api.devnet.solana.com')
  .use(mplCore())
  .use(mplAgentIdentity());

// 1. Create a Collection for all agents
const collection = generateSigner(umi);
await createCollectionV1(umi, { collection, name: 'AgentFund Agents', uri: '...' }).sendAndConfirm(umi);

// 2. Create a Core Asset (NFT) for each agent
const agentAsset = generateSigner(umi);
await createV1(umi, { asset: agentAsset, collection: collection.publicKey, name: 'Scout Agent', uri: '...' }).sendAndConfirm(umi);

// 3. Register agent identity (creates PDA)
await registerIdentityV1(umi, { asset: agentAsset.publicKey, agentRegistrationUri: 'https://...' }).sendAndConfirm(umi);

// 4. Read back identity
const identityPda = findAgentIdentityV1Pda(umi, { asset: agentAsset.publicKey });
```

### Agent-to-Agent Payments -- x402 Protocol (BOUNTY INTEGRATION)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@faremeter/payment-solana` | 0.17.1 | x402 payment scheme for Solana | Corbits SDK. Provides exact payment verification and settlement for x402 flows. Handles SPL token transfer instructions, simulation, and on-chain confirmation | MEDIUM |
| `x402-solana` | 2.0.4 | Alternative x402 implementation | Simpler API if Faremeter proves too complex. Consider as fallback | LOW |

**Implementation pattern:**
```typescript
// Server: Protect an endpoint with x402
// 1. Return HTTP 402 with payment requirements on unauthenticated request
// 2. Client sends signed transaction via X-Payment header (base64 JSON)
// 3. Server verifies, simulates, submits transaction
// 4. Returns 200 with content on success

// Payment proof format:
const paymentProof = {
  x402Version: 1,
  scheme: "exact",
  network: "solana-devnet",
  payload: { serializedTransaction: base64Tx }
};
// Sent as: X-Payment: base64(JSON.stringify(paymentProof))
```

**Key consideration:** For the hackathon demo, x402 payments between agents should use devnet USDC (mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). Each agent needs its own keypair and associated token account.

### Web Data Access -- Unbrowse (BOUNTY: $1,500)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `unbrowse` (CLI) | latest (npm -g) | Reverse-engineers website APIs for agent consumption | Runs locally on `localhost:6969`. Scout agent hits `/v1/intent/resolve` with natural language intents. 100x faster than headless browser automation, 80% cheaper on tokens | MEDIUM |

**Key endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/intent/resolve` | Primary: search marketplace, capture if needed, execute |
| POST | `/v1/search` | Semantic search across known domains |
| POST | `/v1/auth/login` | Interactive browser login for authenticated sites |
| GET | `/health` | Health check |

**Setup:**
```bash
npm install -g unbrowse
unbrowse setup  # Downloads browser assets, registers agent
# Server auto-starts on http://localhost:6969
```

**Agent integration:**
```typescript
const response = await fetch('http://localhost:6969/v1/intent/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    intent: 'find open grant proposals for public goods on Solana',
    url: 'https://grants.gitcoin.co',
    dry_run: false
  })
});
```

**Caveat:** First-time site capture takes 20-80 seconds. Subsequent requests use cached skills and are near-instant. For the demo, pre-warm target sites during setup.

### DeFi -- Meteora DLMM (BOUNTY: $1,000)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@meteora-ag/dlmm` | 1.9.4 | DLMM concentrated liquidity positions | Treasury Manager uses this to manage LP positions for yield on idle treasury funds. Provides pool creation, position management, fee collection | HIGH |

**Setup:**
```typescript
import DLMM from '@meteora-ag/dlmm';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const pool = await DLMM.create(connection, poolAddress);

// Create position, add liquidity, collect fees
```

**Peer dependencies:** Requires `@solana/web3.js` v1.x and `@coral-xyz/anchor` v0.32.x.

**Devnet consideration:** Need to find or create DLMM pools on devnet. Use Meteora's devnet faucet or create a test pool with devnet tokens.

### AI Reasoning -- Anthropic Claude

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@anthropic-ai/sdk` | 0.78.0 | Claude API for proposal analysis and agent reasoning | Proposal Analyzer agent uses Claude to evaluate grant proposals with explained reasoning. Also powers Governance Agent decision coordination. Well-documented, stable SDK | HIGH |

**Usage:**
```typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic(); // uses ANTHROPIC_API_KEY env var
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Analyze this grant proposal...' }]
});
```

### Voice Interface -- ElevenLabs (BOUNTY: Credits)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@elevenlabs/react` | 0.14.2 | React hook for conversational AI | `useConversation` hook manages WebSocket/WebRTC connection + microphone. Supports `clientTools` for triggering agent actions from voice commands | HIGH |
| `@elevenlabs/client` | 0.15.1 | Server-side ElevenLabs client | For generating signed URLs, managing agents programmatically. Use when the React hook needs server-side auth | HIGH |

**Implementation:**
```typescript
import { useConversation } from '@elevenlabs/react';

const conversation = useConversation({
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected'),
});

await conversation.startSession({
  agentId: '<your-agent-id>',
  connectionType: 'webrtc',
  clientTools: {
    findProposals: async ({ query }) => {
      // Trigger Scout agent via Unbrowse
      const result = await fetch('/api/agents/scout', { ... });
      return result.json();
    },
    analyzeProposal: async ({ proposalId }) => {
      // Trigger Proposal Analyzer
      const result = await fetch('/api/agents/analyzer', { ... });
      return result.json();
    },
    fundProject: async ({ proposalId, amount }) => {
      // Trigger Treasury Manager
      const result = await fetch('/api/agents/treasury', { ... });
      return result.json();
    }
  }
});
```

**Setup:** Create an agent in the ElevenLabs dashboard. Configure it with tools that map to your agent API endpoints. The React hook handles all audio/streaming.

### Sybil Resistance -- Human Passport (BOUNTY: $1,200)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@human.tech/passport-embed` | 0.3.4 | Embeddable proof-of-humanity widget | Drop-in React component for sybil-resistant proposal submission. Checks Stamps-based verification score. 15-min integration | MEDIUM |

**Implementation:**
```typescript
import { PassportScoreWidget, DarkTheme, usePassportScore } from '@human.tech/passport-embed';

// Widget approach (visual)
<PassportScoreWidget
  apiKey={process.env.PASSPORT_API_KEY}
  scorerId={process.env.PASSPORT_SCORER_ID}
  address={walletAddress}
  generateSignatureCallback={signMessage}
  theme={DarkTheme}
  collapseMode="overlay"
/>

// Hook approach (programmatic gating)
const { score, isPassing, loading } = usePassportScore({
  apiKey: process.env.PASSPORT_API_KEY,
  scorerId: process.env.PASSPORT_SCORER_ID,
  address: walletAddress
});
if (!isPassing) { /* block proposal submission */ }
```

**Requirements:** Need API key and Scorer ID from the Human Passport dashboard. Register at passport.human.tech.

**Security note:** Frontend scores can be spoofed. For real gating, verify server-side via Stamps API. For a hackathon demo, client-side check is sufficient.

### Agent Orchestration (OPTIONAL -- Evaluate Need)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `solana-agent-kit` | 2.0.10 | Pre-built Solana agent actions | v2 has modular plugin architecture (TokenPlugin, NFTPlugin, DefiPlugin). Could accelerate DeFi ops. BUT adds a heavy dependency and may conflict with direct Metaplex/Meteora usage | MEDIUM |

**Recommendation:** Do NOT use solana-agent-kit for this project. Reasons:
1. You need precise control over Metaplex agent registry ops -- solana-agent-kit wraps Metaplex generically, not the new mpl-agent-registry
2. The DefiPlugin may not have Meteora DLMM support (it focuses on Jupiter, Raydium, Orca)
3. It adds significant bundle size and dependency complexity
4. For a 4-agent hackathon system, direct SDK usage gives cleaner demos and deeper bounty integration

Instead, build a thin agent orchestrator:
```typescript
// /src/agents/base-agent.ts
interface Agent {
  name: string;
  assetPublicKey: PublicKey;  // Metaplex Core Asset
  keypair: Keypair;           // Agent's Solana wallet
  execute(task: AgentTask): Promise<AgentResult>;
}
```

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bs58` | 6.x | Base58 encoding for Solana addresses | Keypair import/export |
| `dotenv` | 16.x | Environment variable loading | API keys, RPC URLs |
| `@solana/spl-token` | 0.4.x | SPL Token operations | Creating token accounts for x402 payments |
| `uuid` | 10.x | Unique identifiers | Agent task IDs, proposal IDs |
| `zod` | 3.x | Runtime validation | Agent message schemas, API inputs |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Agent Framework | Custom thin orchestrator | solana-agent-kit 2.0 | Too heavy, wraps Metaplex generically, doesn't know about mpl-agent-registry |
| Agent Framework | Custom thin orchestrator | ElizaOS | Designed for social media bots, not multi-agent treasury coordination |
| x402 Implementation | @faremeter/payment-solana | x402-solana 2.0 | Faremeter has Corbits team support and is specifically called out in hackathon context |
| x402 Implementation | @faremeter/payment-solana | Manual x402 (raw web3.js) | Reinventing verification logic is risky in 20 hours |
| Metaplex Framework | Umi | @metaplex-foundation/js (legacy) | Deprecated. Umi is the current standard. mpl-agent-registry requires Umi |
| Solana SDK | @solana/web3.js v1.x | @solana/web3.js v2.x | v2 is incompatible with Anchor 0.32, Meteora DLMM, and most current ecosystem |
| Frontend | Next.js 15 | Next.js 16 | 16 has breaking middleware changes. 15 is stable and proven |
| Frontend | Next.js 15 | Vite + React | Need API routes for agent endpoints. Next.js gives full-stack in one project |
| Voice | ElevenLabs Agents Platform | Raw TTS/STT | Hackathon judges want agentic depth. ElevenLabs clientTools enable voice-to-action |
| Sybil Resistance | Passport Embed widget | Full WaaP (Wallet as a Pass) | 15-min vs 45-min integration. Widget achieves the bounty requirement |
| AI Model | Claude (Anthropic SDK) | OpenAI GPT-4o | Claude's reasoning explanations are stronger for "explain your analysis" demo. Also, you're building with Claude Code, so SDK familiarity is higher |
| DeFi | Meteora DLMM direct | Jupiter aggregator | Meteora bounty is for DLMM specifically. Jupiter is for swaps, not LP management |

---

## Version Compatibility Matrix

This is critical. The Solana ecosystem has version fragmentation issues.

| Package | Requires | Conflicts With |
|---------|----------|----------------|
| `@meteora-ag/dlmm` 1.9.4 | `@solana/web3.js` ^1.73, `@coral-xyz/anchor` ^0.29 | `@solana/web3.js` 2.x |
| `@metaplex-foundation/mpl-agent-registry` 0.2.0 | `@metaplex-foundation/umi` ^1.0 | Direct `@solana/web3.js` usage (must use Umi adapters) |
| `@metaplex-foundation/mpl-core` 1.8.0 | `@metaplex-foundation/umi` ^1.0 | N/A |
| `@faremeter/payment-solana` 0.17.1 | `@solana/web3.js` (internally) | May need adapter for Umi context |
| `@human.tech/passport-embed` 0.3.4 | React 18+ | N/A (client-side only) |
| `@elevenlabs/react` 0.14.2 | React 18+ | N/A (client-side only) |

**Key compatibility insight:** You will run two Solana interaction layers:
1. **Umi layer** -- For all Metaplex operations (agent registry, Core NFTs). Uses Umi signers and Umi RPC.
2. **web3.js layer** -- For Meteora DLMM, x402 payments, and raw SPL token ops. Uses Keypairs and Connection.

Bridge between them using `@metaplex-foundation/umi-web3js-adapters` to convert between Umi and web3.js keypair/signer formats.

---

## Installation

```bash
# Initialize project
npx create-next-app@15 agentfund --typescript --tailwind --eslint --app --src-dir

# Core Solana
pnpm add @solana/web3.js@^1.98 @coral-xyz/anchor@^0.32 @solana/spl-token@^0.4

# Metaplex (Umi + Agent Registry + Core)
pnpm add @metaplex-foundation/umi@^1.5 \
         @metaplex-foundation/umi-bundle-defaults@^1.5 \
         @metaplex-foundation/umi-web3js-adapters \
         @metaplex-foundation/mpl-core@^1.8 \
         @metaplex-foundation/mpl-agent-registry@^0.2 \
         @metaplex-foundation/mpl-toolbox@^0.10

# x402 Agent Payments (Corbits/Faremeter)
pnpm add @faremeter/payment-solana@^0.17

# DeFi - Meteora DLMM
pnpm add @meteora-ag/dlmm@^1.9

# AI Reasoning
pnpm add @anthropic-ai/sdk@^0.78

# Voice Interface
pnpm add @elevenlabs/react@^0.14 @elevenlabs/client@^0.15

# Sybil Resistance
pnpm add @human.tech/passport-embed@^0.3

# Utilities
pnpm add bs58 dotenv zod uuid

# Dev dependencies
pnpm add -D @types/node @types/uuid typescript
```

---

## Environment Variables

```bash
# .env.local (DO NOT COMMIT)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# Agent keypairs (base58 encoded private keys)
SCOUT_PRIVATE_KEY=
ANALYZER_PRIVATE_KEY=
TREASURY_PRIVATE_KEY=
GOVERNANCE_PRIVATE_KEY=

# APIs
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
PASSPORT_API_KEY=
PASSPORT_SCORER_ID=

# Unbrowse (auto-starts on this address)
UNBROWSE_URL=http://localhost:6969

# Devnet USDC mint for x402 payments
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

---

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| `@metaplex-foundation/js` (legacy Metaplex SDK) | Deprecated. Use Umi instead. Will not work with mpl-agent-registry |
| `@solana/web3.js` v2.x | Breaking changes, incompatible with Anchor 0.32 and Meteora DLMM |
| `solana-agent-kit` | Too generic, adds complexity, doesn't support mpl-agent-registry |
| ElizaOS | Designed for social media personality bots, not multi-agent treasury systems |
| LangChain | Unnecessary abstraction layer for 4 agents. Direct Claude SDK calls are simpler and faster |
| Prisma / Drizzle (database ORMs) | No database needed. All state is on-chain (Solana) or in-memory. Hackathon scope |
| IPFS / Arweave for metadata | Use static JSON files or a simple API endpoint for agent metadata URIs. Storage infra is out of scope |
| Realms / SPL Governance | Out of scope per PROJECT.md. Agent coordination is custom, not DAO governance |
| React 19 / Next.js 16 | Bleeding edge. Passport Embed and ElevenLabs tested against React 18 |

---

## Sources

### Verified via npm registry (HIGH confidence)
- `@metaplex-foundation/mpl-agent-registry` v0.2.0 -- Published 2026-03-11, Apache-2.0, repository: github.com/metaplex-foundation/mpl-agent-identity
- `@metaplex-foundation/mpl-core` v1.8.0
- `@metaplex-foundation/umi` v1.5.1
- `@meteora-ag/dlmm` v1.9.4
- `@anthropic-ai/sdk` v0.78.0
- `@elevenlabs/react` v0.14.2 / `@elevenlabs/client` v0.15.1
- `@human.tech/passport-embed` v0.3.4
- `@faremeter/payment-solana` v0.17.1
- `solana-agent-kit` v2.0.10
- `@solana/web3.js` v1.98.4
- `@coral-xyz/anchor` v0.32.1

### Verified via official documentation (HIGH confidence)
- [Solana x402 Getting Started Guide](https://solana.com/developers/guides/getstarted/intro-to-x402)
- [Meteora DLMM TypeScript SDK](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started)
- [Metaplex Core SDK](https://developers.metaplex.com/smart-contracts/core)
- [Faremeter/Corbits Overview](https://docs.corbits.dev/faremeter/overview)
- [Human Passport Embed Component Reference](https://docs.passport.xyz/building-with-passport/embed/component-reference)
- [ElevenLabs Agents SDK GitHub](https://github.com/elevenlabs/packages)

### Verified via web research (MEDIUM confidence)
- [How to Build a Solana AI Agent in 2026 - Alchemy](https://www.alchemy.com/blog/how-to-build-solana-ai-agents-in-2026)
- [x402 Protocol Architecture - Chainstack](https://chainstack.com/x402-protocol-for-ai-agents/)
- [Solana x402 Overview](https://solana.com/x402)
- [Unbrowse GitHub Repository](https://github.com/unbrowse-ai/unbrowse)
- [Unbrowse.ai Homepage](https://www.unbrowse.ai)
- [SendAI Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit)
- [Metaplex February 2025 Roundup](https://www.metaplex.com/blog/articles/metaplex-february-round-up-2025)

### Verified via package inspection (HIGH confidence)
- mpl-agent-registry type definitions inspected directly from npm tarball
- Program ID: `1DREGFgysWYxLnRnKQnwrxnJQeSMk2HmGaC6whw2B2p` (Identity program)
- 4 Umi plugins exported: `mplAgentIdentity()`, `mplAgentReputation()`, `mplAgentValidation()`, `mplAgentTools()`
- Key instructions: `registerIdentityV1`, `registerReputationV1`, `registerValidationV1`, `registerExecutiveV1`, `delegateExecutionV1`
- PDA derivation: `findAgentIdentityV1Pda(umi, { asset: PublicKey })` -- derived from Core Asset address
