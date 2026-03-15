# Phase 1: Solana Foundation & Agent Identity - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up Solana devnet infrastructure and register 4 AI agents on-chain via Metaplex Agent Registry. Delivers: funded wallets, token accounts, MPL Core NFT collection, AgentIdentityV1 PDAs, and isolated Umi/web3.js modules. This is the $5,000 Metaplex bounty foundation and prerequisite for every subsequent phase.

</domain>

<decisions>
## Implementation Decisions

### Wallet & Key Management
- 4 individual Keypairs (one per agent: Scout, Proposal Analyzer, Treasury Manager, Governance) -- NOT derived from HD path
- Keypairs stored as JSON files in a `keys/` directory (gitignored)
- A shared `src/lib/keys.ts` utility exports both Umi signers and web3.js Keypair from same secret bytes using `@metaplex-foundation/umi-web3js-adapters`
- Pre-fund each wallet with 10+ SOL from devnet faucet
- Pre-create Associated Token Accounts for devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) on all 4 agents
- If devnet USDC mint is not distributable, create a custom "DEMO_USDC" SPL token and distribute to all agents as fallback

### Metaplex Agent Registration
- Create ONE MPL Core NFT collection called "AgentFund Agents" for all 4 agents
- Mint 4 Core NFTs (one per agent role) with metadata: name, role description, image URI
- Use `registerIdentityV1()` from `@metaplex-foundation/mpl-agent-registry` to bind AgentIdentityV1 PDA to each asset
- PDA seeds: `["agent_identity", asset_pubkey]` -- verify PDA existence after each registration
- Store agent metadata as static JSON hosted via data URIs or simple HTTPS endpoints (no IPFS needed for hackathon)
- Registration runs as a one-time setup script (`scripts/register-agents.ts`), NOT at runtime

### Umi/web3.js Isolation
- ALL Metaplex operations (Core NFT minting, agent registration, identity verification) go through Umi layer in `src/lib/metaplex/` module
- ALL runtime operations (SPL transfers, Meteora DLMM, x402 payments) use `@solana/web3.js` v1.x in `src/lib/solana/` module
- Bridge via `@metaplex-foundation/umi-web3js-adapters` -- used ONLY in `src/lib/keys.ts`
- Never import Umi types outside `src/lib/metaplex/`
- Never import web3.js types inside `src/lib/metaplex/` (except through adapter)

### RPC & Network Configuration
- Solana devnet with dedicated RPC endpoint (Helius or QuickNode free tier preferred over public devnet endpoint)
- Fallback to `https://api.devnet.solana.com` if dedicated RPC unavailable
- Single shared Connection instance for all web3.js operations
- Single shared Umi instance for all Metaplex operations
- Environment variables: `SOLANA_RPC_URL`, `SOLANA_CLUSTER=devnet`

### Project Initialization
- TypeScript project with pnpm as package manager
- `tsconfig.json` with strict mode
- Key dependencies pinned: `@solana/web3.js` v1.x (NOT v2), `@metaplex-foundation/umi` ~v1.5, `@metaplex-foundation/mpl-agent-registry` v0.2.0
- `.env` file for API keys and RPC URLs (gitignored)
- `.env.example` with placeholder values for documentation

### Claude's Discretion
- Exact directory structure layout within src/
- NFT image/metadata content (can use placeholder images)
- Error handling patterns for failed registrations
- Whether to use a monorepo or single package structure
- Exact tsconfig settings beyond strict mode

</decisions>

<specifics>
## Specific Ideas

- Research found `mpl-agent-registry` v0.2.0 published 2026-03-11 (3 days ago) -- read npm source directly, docs may be incomplete
- The registration script should be idempotent -- check if agents already registered before re-registering
- Research recommends using `fetchAsset()` to verify on-chain state after every Metaplex operation
- The 4 agents are: Scout (web data), Proposal Analyzer (Claude evaluation), Treasury Manager (DeFi), Governance (coordination)
- Each agent NFT should have distinct metadata reflecting its role for demo purposes

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None -- greenfield project, no existing code

### Established Patterns
- None -- patterns will be established in this phase for all subsequent phases to follow

### Integration Points
- `src/lib/keys.ts` will be imported by every agent module in subsequent phases
- `src/lib/metaplex/` module will be used by Phase 6 (x402) for agent identity verification
- `src/lib/solana/connection.ts` will be the shared connection for all Solana operations
- `scripts/register-agents.ts` will be the setup script run before any demo

</code_context>

<deferred>
## Deferred Ideas

- Executive delegation (registerExecutiveV1) -- only needed if agents need to act on behalf of each other, defer to Phase 6 if needed
- Agent reputation tracking (mpl-agent-reputation) -- mentioned in registry repo but not finalized, skip entirely
- On-chain agent metadata updates -- not needed for hackathon demo

</deferred>

---

*Phase: 01-solana-foundation-agent-identity*
*Context gathered: 2026-03-14*
