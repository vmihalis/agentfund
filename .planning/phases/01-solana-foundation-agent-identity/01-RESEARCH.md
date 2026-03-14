# Phase 1: Solana Foundation & Agent Identity - Research

**Researched:** 2026-03-14
**Domain:** Solana blockchain infrastructure, Metaplex Agent Registry, MPL Core NFTs, Umi framework
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire blockchain foundation for AgentFund: 4 agent keypairs with funded wallets, a single MPL Core NFT collection, 4 agent NFTs with registered AgentIdentityV1 PDAs, and cleanly isolated Umi/web3.js modules. This is a greenfield TypeScript project using pnpm, with no existing code.

The critical technology is `@metaplex-foundation/mpl-agent-registry` v0.2.0 (published 2026-03-11, 3 days old). Direct inspection of the npm package type definitions confirms the exact API surface: `registerIdentityV1()` takes an `asset` (PublicKey), optional `collection` (PublicKey), and a required `agentRegistrationUri` (string). The PDA is derived from seeds `["agent_identity", asset_pubkey]`. The Umi framework's type system is distinct from `@solana/web3.js` -- bridging requires `@metaplex-foundation/umi-web3js-adapters` with functions like `fromWeb3JsKeypair()` and `toWeb3JsPublicKey()`.

**Primary recommendation:** Build the key management utility (`src/lib/keys.ts`) first as the foundation for everything else, then create the Umi module, then the web3.js module, then the registration script. Every Metaplex operation should be verified by reading on-chain state afterward.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 4 individual Keypairs (one per agent: Scout, Proposal Analyzer, Treasury Manager, Governance) -- NOT derived from HD path
- Keypairs stored as JSON files in a `keys/` directory (gitignored)
- A shared `src/lib/keys.ts` utility exports both Umi signers and web3.js Keypair from same secret bytes using `@metaplex-foundation/umi-web3js-adapters`
- Pre-fund each wallet with 10+ SOL from devnet faucet
- Pre-create Associated Token Accounts for devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) on all 4 agents
- If devnet USDC mint is not distributable, create a custom "DEMO_USDC" SPL token and distribute to all agents as fallback
- Create ONE MPL Core NFT collection called "AgentFund Agents" for all 4 agents
- Mint 4 Core NFTs (one per agent role) with metadata: name, role description, image URI
- Use `registerIdentityV1()` from `@metaplex-foundation/mpl-agent-registry` to bind AgentIdentityV1 PDA to each asset
- PDA seeds: `["agent_identity", asset_pubkey]` -- verify PDA existence after each registration
- Store agent metadata as static JSON hosted via data URIs or simple HTTPS endpoints (no IPFS needed for hackathon)
- Registration runs as a one-time setup script (`scripts/register-agents.ts`), NOT at runtime
- ALL Metaplex operations go through Umi layer in `src/lib/metaplex/` module
- ALL runtime operations use `@solana/web3.js` v1.x in `src/lib/solana/` module
- Bridge via `@metaplex-foundation/umi-web3js-adapters` -- used ONLY in `src/lib/keys.ts`
- Never import Umi types outside `src/lib/metaplex/`
- Never import web3.js types inside `src/lib/metaplex/` (except through adapter)
- Solana devnet with dedicated RPC endpoint (Helius or QuickNode free tier preferred over public devnet endpoint)
- Fallback to `https://api.devnet.solana.com` if dedicated RPC unavailable
- Single shared Connection instance for all web3.js operations
- Single shared Umi instance for all Metaplex operations
- Environment variables: `SOLANA_RPC_URL`, `SOLANA_CLUSTER=devnet`
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

### Deferred Ideas (OUT OF SCOPE)
- Executive delegation (registerExecutiveV1) -- only needed if agents need to act on behalf of each other, defer to Phase 6 if needed
- Agent reputation tracking (mpl-agent-reputation) -- mentioned in registry repo but not finalized, skip entirely
- On-chain agent metadata updates -- not needed for hackathon demo
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IDENT-01 | 4 AI agents registered on-chain via Metaplex Agent Registry (MPL Core NFT + AgentIdentityV1 PDA each) | Verified: `registerIdentityV1()` API confirmed from npm package inspection. Creates PDA from `["agent_identity", asset_pubkey]` seeds. Requires Core Asset + collection + `agentRegistrationUri` string. |
| IDENT-02 | Each agent has its own Solana keypair, funded wallet, and Associated Token Account for devnet USDC | Supported: `@solana/spl-token` provides `getOrCreateAssociatedTokenAccount()`. Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Fallback to custom SPL token if needed. |
| IDENT-03 | Agent identities verifiable by any third party via PDA derivation and AppData plugin inspection | Verified: `findAgentIdentityV1Pda()` derives PDA from asset pubkey. `fetchAgentIdentityV1()` reads PDA data. AppData external plugin has data_authority = PDA for two-way binding verification. |
| IDENT-04 | MPL Core NFT collection created for AgentFund agent group | Supported: `createCollection()` from `@metaplex-foundation/mpl-core` creates a collection. Assets added via `create()` with `collection` parameter. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@solana/web3.js` | 1.98.x | Solana connection, transactions, keypairs | Required by all runtime ops. Do NOT use v2 -- incompatible with ecosystem. |
| `@metaplex-foundation/umi` | ~1.5.1 | Metaplex transaction framework | Required for ALL Metaplex operations. Own signer/tx/RPC abstraction. |
| `@metaplex-foundation/umi-bundle-defaults` | ~1.5.1 | Umi RPC and signer setup | Wires Umi to Solana RPC with default plugins. |
| `@metaplex-foundation/mpl-core` | ^1.8.0 | MPL Core NFT standard | Each agent is a Core Asset. Foundation for agent registry. |
| `@metaplex-foundation/mpl-agent-registry` | 0.2.0 | On-chain agent identity | THE bounty package. Provides `registerIdentityV1()`, `findAgentIdentityV1Pda()`, `fetchAgentIdentityV1()`. |
| `@metaplex-foundation/mpl-toolbox` | ^0.10.0 | Metaplex utility instructions | Peer dependency of mpl-agent-registry. |
| `@metaplex-foundation/umi-web3js-adapters` | ^1.5.0 | Umi/web3.js type bridging | Converts between `Keypair` and Umi `KeypairSigner`. Critical for dual-layer architecture. |
| `@solana/spl-token` | ^0.4.x | SPL Token operations | Creating Associated Token Accounts for devnet USDC. |
| TypeScript | ~5.4 | Language | All SDKs ship TS types. |
| pnpm | 9.x | Package manager | Handles Metaplex/Solana dependency graph without phantom deps. |
| Node.js | 20 LTS | Runtime | Stable LTS. Do NOT use Node 22+ -- Umi has ESM/CJS interop issues on newer Node. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bs58` | 6.x | Base58 encoding | Keypair import/export if using base58 format |
| `dotenv` | 16.x | Environment variable loading | Loading `.env` for RPC URLs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Individual keypair files | HD wallet derivation | Context says NOT derived from HD path -- locked decision |
| `@solana/web3.js` v2 | v1 | v2 breaks Anchor/Meteora/ecosystem compatibility -- locked to v1 |
| Legacy Metaplex JS SDK | Umi | Deprecated. Umi is required for mpl-agent-registry |

**Installation:**
```bash
# Initialize project
pnpm init

# Core Solana
pnpm add @solana/web3.js@^1.98 @solana/spl-token@^0.4

# Metaplex (Umi + Agent Registry + Core)
pnpm add @metaplex-foundation/umi@^1.5 \
         @metaplex-foundation/umi-bundle-defaults@^1.5 \
         @metaplex-foundation/umi-web3js-adapters \
         @metaplex-foundation/mpl-core@^1.8 \
         @metaplex-foundation/mpl-agent-registry@0.2.0 \
         @metaplex-foundation/mpl-toolbox@^0.10

# Utilities
pnpm add bs58 dotenv

# Dev dependencies
pnpm add -D typescript@~5.4 @types/node tsx
```

## Architecture Patterns

### Recommended Project Structure
```
agentfund/
  keys/                        # Gitignored. 4 JSON keypair files.
  scripts/
    generate-keys.ts           # One-time: generate 4 keypair files
    fund-wallets.ts            # One-time: airdrop SOL + create ATAs
    register-agents.ts         # One-time: collection + NFTs + identities
    verify-agents.ts           # Diagnostic: verify all agents on-chain
  src/
    lib/
      keys.ts                  # THE bridge: exports Umi signers AND web3.js Keypairs
      metaplex/
        umi.ts                 # Shared Umi instance (singleton)
        collection.ts          # createCollection, fetchCollection helpers
        agent-nft.ts           # createAgentAsset, fetchAgentAsset helpers
        identity.ts            # registerIdentity, verifyIdentity, fetchIdentity
        index.ts               # Public API barrel (ONLY Umi types leak through here)
      solana/
        connection.ts          # Shared Connection instance (singleton)
        token-accounts.ts      # ATA creation, balance checks
        index.ts               # Public API barrel (ONLY web3.js types leak through here)
    types/
      agents.ts               # Agent role enum, agent config types
  .env                         # Gitignored
  .env.example                 # Documented placeholders
  .gitignore
  package.json
  tsconfig.json
```

### Pattern 1: Dual-Layer Key Management (THE critical pattern)
**What:** A single `keys.ts` module that loads raw keypair bytes and exports both Umi and web3.js signer objects.
**When to use:** Every time ANY module needs to sign a transaction or reference an agent's identity.
**Example:**
```typescript
// src/lib/keys.ts
// Source: npm package inspection of @metaplex-foundation/umi-web3js-adapters
import { Keypair } from '@solana/web3.js';
import { createSignerFromKeypair } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { getUmi } from './metaplex/umi';
import fs from 'fs';
import path from 'path';

export type AgentRole = 'scout' | 'analyzer' | 'treasury' | 'governance';

// Load raw bytes from JSON file
function loadKeypairBytes(role: AgentRole): Uint8Array {
  const filePath = path.join(process.cwd(), 'keys', `${role}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return new Uint8Array(data);
}

// web3.js layer: returns @solana/web3.js Keypair
export function getWeb3Keypair(role: AgentRole): Keypair {
  return Keypair.fromSecretKey(loadKeypairBytes(role));
}

// Umi layer: returns Umi KeypairSigner
export function getUmiSigner(role: AgentRole) {
  const umi = getUmi();
  const web3Keypair = getWeb3Keypair(role);
  const umiKeypair = fromWeb3JsKeypair(web3Keypair);
  return createSignerFromKeypair(umi, umiKeypair);
}
```

### Pattern 2: Singleton Umi Instance
**What:** One Umi instance shared across all Metaplex operations, initialized once.
**When to use:** Every Metaplex operation.
**Example:**
```typescript
// src/lib/metaplex/umi.ts
// Source: Metaplex Umi Getting Started docs
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { mplAgentIdentity } from '@metaplex-foundation/mpl-agent-registry';
import { signerIdentity } from '@metaplex-foundation/umi';

let _umi: ReturnType<typeof createUmi> | null = null;

export function getUmi() {
  if (!_umi) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    _umi = createUmi(rpcUrl)
      .use(mplCore())
      .use(mplAgentIdentity());
  }
  return _umi;
}

// Set a specific identity for operations (call before each agent's operations)
export function setUmiIdentity(signer: Parameters<typeof signerIdentity>[0]) {
  const umi = getUmi();
  umi.use(signerIdentity(signer));
  return umi;
}
```

### Pattern 3: Singleton Connection Instance
**What:** One `@solana/web3.js` Connection shared across all runtime operations.
**When to use:** Every non-Metaplex Solana operation.
**Example:**
```typescript
// src/lib/solana/connection.ts
import { Connection } from '@solana/web3.js';

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    _connection = new Connection(rpcUrl, 'confirmed');
  }
  return _connection;
}
```

### Pattern 4: Idempotent Registration Script
**What:** The registration script checks if agents are already registered before re-registering.
**When to use:** `scripts/register-agents.ts`.
**Example:**
```typescript
// Source: npm package inspection of mpl-agent-registry types
import { safeFetchAgentIdentityV1, findAgentIdentityV1Pda } from '@metaplex-foundation/mpl-agent-registry';

async function isAgentRegistered(umi: Umi, assetPublicKey: PublicKey): Promise<boolean> {
  const pda = findAgentIdentityV1Pda(umi, { asset: assetPublicKey });
  const identity = await safeFetchAgentIdentityV1(umi, pda);
  return identity !== null;
}
```

### Anti-Patterns to Avoid
- **Mixing Umi and web3.js types in the same module:** Never import `PublicKey` from both `@solana/web3.js` and `@metaplex-foundation/umi` in the same file. One module, one layer.
- **Using `generateSigner(umi)` for agent keypairs:** `generateSigner` creates ephemeral keypairs. Agent keypairs must be loaded from persisted files so they survive across script runs.
- **Batching collection creation + asset minting + identity registration in one transaction:** Each should be a separate transaction to avoid the 1,232 byte Solana transaction size limit.
- **Using `fetchAgentIdentityV1` without error handling:** If the PDA does not exist, it throws. Use `safeFetchAgentIdentityV1` which returns `null` instead.
- **Importing Umi signers outside `src/lib/metaplex/` or `src/lib/keys.ts`:** This breaks the isolation boundary. If a module needs to reference an agent, it should use the web3.js `PublicKey` from `keys.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keypair format conversion | Manual byte array slicing between Umi/web3.js | `fromWeb3JsKeypair()` / `toWeb3JsKeypair()` from `umi-web3js-adapters` | Handles all format differences including endianness |
| PDA derivation for agent identity | Manual `PublicKey.findProgramAddress()` | `findAgentIdentityV1Pda(umi, { asset })` | Seeds are baked into the generated code, guaranteed correct |
| Associated Token Account creation | Manual account creation + rent calculation | `getOrCreateAssociatedTokenAccount()` from `@solana/spl-token` | Handles idempotency, rent exemption, and ATA program invocation |
| Solana airdrop with retry | Single `requestAirdrop()` call | Retry loop with exponential backoff OR use web faucet for pre-funding | Devnet faucet rate-limits to 1 airdrop/day programmatically |
| MPL Core NFT metadata serialization | Manual Borsh serialization | `create()` / `createCollection()` from `@metaplex-foundation/mpl-core` | Handles all account sizing, discriminators, and plugin attachment |
| Agent identity verification | Manual PDA derivation + account deserialization | `fetchAgentIdentityV1()` / `safeFetchAgentIdentityV1()` from mpl-agent-registry | Handles deserialization, account validation, and type safety |

**Key insight:** The Metaplex ecosystem auto-generates all client code via Kinobi from the on-chain IDL. Every helper function handles edge cases (padding, discriminators, default accounts) that are easy to get wrong manually. Always use the generated helpers.

## Common Pitfalls

### Pitfall 1: Umi vs web3.js Type Confusion
**What goes wrong:** `PublicKey` from `@metaplex-foundation/umi` and `PublicKey` from `@solana/web3.js` are different types with the same name. Passing one where the other is expected causes silent failures or cryptic type errors.
**Why it happens:** Umi wraps all Solana primitives in its own type system. The types look identical but are not interchangeable.
**How to avoid:** Enforce module boundary: `src/lib/metaplex/` ONLY uses Umi types. `src/lib/solana/` ONLY uses web3.js types. `src/lib/keys.ts` is the ONLY file that imports from both (via the adapter). If TypeScript complains about `PublicKey` types, you have crossed the boundary.
**Warning signs:** TypeScript errors mentioning two different `PublicKey` types, or runtime errors like "invalid signer" or "could not deserialize account."

### Pitfall 2: `registerIdentityV1` Requires `agentRegistrationUri` String
**What goes wrong:** The CONTEXT.md and some documentation examples omit the `agentRegistrationUri` parameter, showing only `asset` and `collection`. But the actual npm package type definitions (verified via direct inspection) show `agentRegistrationUri: string` as a REQUIRED field in `RegisterIdentityV1InstructionDataArgs`.
**Why it happens:** Documentation examples were written against an earlier version or simplified for clarity.
**How to avoid:** Always pass `agentRegistrationUri` when calling `registerIdentityV1()`. This can be a data URI (`data:application/json,...`) or any HTTPS URL pointing to agent metadata JSON. For the hackathon, a simple JSON blob encoded as a data URI is sufficient.
**Warning signs:** Transaction fails with "Invalid instruction data" error.

### Pitfall 3: Devnet Faucet Rate Limits
**What goes wrong:** `connection.requestAirdrop()` fails with 429 errors. Each wallet is limited to 1 programmatic airdrop per day, and the web faucet allows 5 SOL per request, 2 requests per hour.
**Why it happens:** Hundreds of developers share the devnet faucet. Rate limits are aggressive.
**How to avoid:** Pre-fund ALL wallets (4 agents + 1 deployer = 5 wallets x 10+ SOL each) well before demo time. Use the Solana CLI (`solana airdrop 5 <pubkey> --url devnet`) or the web faucet at faucet.solana.com. Alternatively, use a single funded deployer wallet and SOL transfer instructions to distribute to agent wallets.
**Warning signs:** `requestAirdrop()` returning 429, or wallet balances showing 0 SOL.

### Pitfall 4: Separate Transactions for Each Phase of Registration
**What goes wrong:** Attempting to create a collection, mint 4 NFTs, and register 4 identities in a single transaction exceeds the 1,232 byte Solana transaction size limit.
**Why it happens:** Each instruction adds accounts (32 bytes each) plus instruction data. A Metaplex Core asset creation alone uses 7+ accounts.
**How to avoid:** Use separate transactions for: (1) create collection, (2) create each asset (4 transactions), (3) register each identity (4 transactions). Total: 9 sequential transactions. Confirm each with `sendAndConfirm()` before proceeding to the next.
**Warning signs:** "Transaction too large" errors, or serialization failures.

### Pitfall 5: Collection Authority for Asset Creation
**What goes wrong:** Creating an asset within a collection requires the collection's update authority to sign. If the Umi identity is not set to the collection authority, asset creation fails with an authority error.
**Why it happens:** MPL Core enforces that only the collection authority can add assets to a collection.
**How to avoid:** Use a single deployer keypair as the collection authority. Set this as the Umi identity before all collection and asset operations. The agent keypairs can be asset owners (via `owner` field), but the deployer signs the creation.
**Warning signs:** "Authority mismatch" or "Invalid authority" errors during `create()`.

### Pitfall 6: Devnet USDC Mint May Not Be Distributable
**What goes wrong:** The devnet USDC mint (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) exists but you cannot mint tokens from it because you are not the mint authority.
**Why it happens:** Devnet USDC is a real Circle-controlled mint on devnet. Only Circle's mint authority can issue new tokens.
**How to avoid:** Check if a devnet USDC faucet exists. If not, create a custom "DEMO_USDC" SPL token using `@solana/spl-token`'s `createMint()` with your deployer as mint authority. Then mint tokens to each agent's ATA. This is the fallback path explicitly authorized in CONTEXT.md.
**Warning signs:** `mintTo()` fails with "mint authority mismatch" on the official devnet USDC mint.

## Code Examples

Verified patterns from official sources and npm package inspection:

### Creating the Agent Collection
```typescript
// Source: Metaplex Core JS SDK docs (verified)
import { createCollection, fetchCollection } from '@metaplex-foundation/mpl-core';
import { generateSigner } from '@metaplex-foundation/umi';

const collectionSigner = generateSigner(umi);
await createCollection(umi, {
  collection: collectionSigner,
  name: 'AgentFund Agents',
  uri: 'data:application/json,{"name":"AgentFund Agents","description":"On-chain AI agent identities for AgentFund"}',
}).sendAndConfirm(umi);

// Save collectionSigner.publicKey for later use
console.log('Collection:', collectionSigner.publicKey);
```

### Creating an Agent Core Asset
```typescript
// Source: Metaplex Core JS SDK docs (verified)
import { create, fetchAsset } from '@metaplex-foundation/mpl-core';
import { generateSigner, publicKey } from '@metaplex-foundation/umi';

const assetSigner = generateSigner(umi);
const collectionPubkey = publicKey('COLLECTION_ADDRESS_FROM_PREVIOUS_STEP');

await create(umi, {
  asset: assetSigner,
  collection: await fetchCollection(umi, collectionPubkey),
  name: 'Scout Agent',
  uri: 'data:application/json,{"name":"Scout Agent","role":"Web data discovery","description":"Discovers grant proposals via Unbrowse"}',
  owner: publicKey('AGENT_WALLET_PUBKEY'),  // The agent's own wallet owns the NFT
}).sendAndConfirm(umi);

// Verify
const asset = await fetchAsset(umi, assetSigner.publicKey);
console.log('Asset created:', asset.publicKey, 'Owner:', asset.owner);
```

### Registering Agent Identity (PDA creation)
```typescript
// Source: npm package type definitions (directly verified from tarball)
import {
  registerIdentityV1,
  findAgentIdentityV1Pda,
  fetchAgentIdentityV1,
  safeFetchAgentIdentityV1,
} from '@metaplex-foundation/mpl-agent-registry';

// Note: agentRegistrationUri is REQUIRED (verified from type defs)
await registerIdentityV1(umi, {
  asset: assetSigner.publicKey,
  collection: collectionPubkey,
  agentRegistrationUri: 'data:application/json,{"name":"Scout Agent","role":"discovery","version":"1.0.0"}',
}).sendAndConfirm(umi);

// Verify PDA exists
const pda = findAgentIdentityV1Pda(umi, { asset: assetSigner.publicKey });
const identity = await fetchAgentIdentityV1(umi, pda);
console.log('Identity PDA:', pda);
console.log('Bound asset:', identity.asset);
// identity.asset should equal assetSigner.publicKey
```

### Third-Party Verification
```typescript
// Source: docs/metaplex-agent-registry.md + npm package types
import { findAgentIdentityV1Pda, safeFetchAgentIdentityV1 } from '@metaplex-foundation/mpl-agent-registry';
import { fetchAsset } from '@metaplex-foundation/mpl-core';
import { publicKey } from '@metaplex-foundation/umi';

async function verifyAgentIdentity(umi: Umi, assetAddress: string): Promise<boolean> {
  const asset = publicKey(assetAddress);

  // Step 1: Derive PDA
  const pda = findAgentIdentityV1Pda(umi, { asset });

  // Step 2: Fetch PDA account (returns null if not registered)
  const identity = await safeFetchAgentIdentityV1(umi, pda);
  if (!identity) return false;

  // Step 3: Verify the PDA's asset field points back to our asset
  if (identity.asset !== asset) return false;

  // Step 4: Fetch the Core Asset and check for AppData plugin with PDA authority
  const coreAsset = await fetchAsset(umi, asset);
  // The AppData plugin should have dataAuthority pointing to the PDA
  // This completes the two-way binding verification

  return true;
}
```

### Creating Associated Token Accounts
```typescript
// Source: @solana/spl-token standard pattern
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

async function createAgentTokenAccount(
  connection: Connection,
  payer: Keypair,
  agentKeypair: Keypair
) {
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,          // fee payer
    USDC_MINT,      // token mint
    agentKeypair.publicKey  // ATA owner
  );
  console.log('ATA:', ata.address.toBase58());
  return ata;
}
```

### Fallback: Create Custom DEMO_USDC Token
```typescript
// Source: @solana/spl-token createMint pattern
import { createMint, mintTo, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';

async function createDemoUSDC(connection: Connection, deployer: Keypair) {
  // Create mint with deployer as authority
  const mint = await createMint(
    connection,
    deployer,           // payer
    deployer.publicKey, // mint authority
    null,               // freeze authority
    6                   // decimals (USDC standard)
  );

  // For each agent, create ATA and mint tokens
  for (const role of ['scout', 'analyzer', 'treasury', 'governance'] as const) {
    const agentKeypair = getWeb3Keypair(role);
    const ata = await getOrCreateAssociatedTokenAccount(
      connection, deployer, mint, agentKeypair.publicKey
    );
    await mintTo(
      connection, deployer, mint, ata.address,
      deployer,  // mint authority
      1_000_000_000  // 1000 USDC (6 decimals)
    );
  }

  return mint;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@metaplex-foundation/js` (legacy) | Umi framework | 2024 | Legacy SDK fully deprecated. mpl-agent-registry only works with Umi. |
| Token Metadata NFTs | MPL Core Assets | 2024 | Core is lighter (fewer accounts, lower rent). Agent Registry is built on Core. |
| `@solana/web3.js` v2 | Stay on v1.x | 2025-2026 | v2 breaks Anchor, Meteora, and most ecosystem. v1.x is standard for production. |
| `createV1()` for Core assets | `create()` wrapper | MPL Core JS SDK v1.0 | Simplified API. `create()` is the current recommended function name. |
| `createCollectionV1()` | `createCollection()` wrapper | MPL Core JS SDK v1.0 | Simplified API. Same underlying instruction. |

**Deprecated/outdated:**
- `@metaplex-foundation/js`: Fully deprecated. Do not install.
- `createV1()` / `createCollectionV1()`: Still work but `create()` / `createCollection()` are the current recommended wrappers in mpl-core.

## Open Questions

1. **Devnet USDC Availability**
   - What we know: The mint address `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` exists on devnet. We cannot mint from it (Circle controls mint authority).
   - What's unclear: Whether a devnet USDC faucet exists, or whether Circle has a testnet distribution mechanism.
   - Recommendation: Attempt to use the official devnet USDC. If tokens cannot be obtained, immediately fall back to creating DEMO_USDC. Budget 15 minutes for this decision.

2. **`agentRegistrationUri` Format**
   - What we know: The field is a required string. It's labeled "URI" suggesting a URL pointing to metadata.
   - What's unclear: Whether data URIs are accepted, or if it must be an HTTP(S) URL. Whether there's a schema the metadata must follow.
   - Recommendation: Use data URIs (`data:application/json,...`) for simplicity. If that fails on-chain, switch to hosting JSON blobs as simple Next.js API routes. The string is stored on-chain as-is, so any valid URI should work.

3. **Asset Owner vs Deployer Authority**
   - What we know: The deployer creates the collection and must be collection authority to add assets. Each agent should "own" its own NFT.
   - What's unclear: Whether `registerIdentityV1()` requires the asset owner or the collection authority to sign.
   - Recommendation: The type definitions show `authority` defaults to `payer` (the Umi identity). Keep the deployer as the Umi identity for all registration operations. Set each agent's wallet as the `owner` of their respective Core Asset during `create()`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (recommended for TS-first projects; fast, native ESM) |
| Config file | none -- Wave 0 gap |
| Quick run command | `pnpm exec vitest run --reporter=verbose` |
| Full suite command | `pnpm exec vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDENT-01 | 4 agents registered with AgentIdentityV1 PDAs | integration (devnet) | `pnpm exec vitest run tests/integration/agent-registration.test.ts -x` | No -- Wave 0 |
| IDENT-02 | Each agent has keypair, funded wallet, and USDC ATA | integration (devnet) | `pnpm exec vitest run tests/integration/wallet-setup.test.ts -x` | No -- Wave 0 |
| IDENT-03 | Third-party PDA derivation and verification | unit | `pnpm exec vitest run tests/unit/identity-verification.test.ts -x` | No -- Wave 0 |
| IDENT-04 | MPL Core NFT collection created | integration (devnet) | `pnpm exec vitest run tests/integration/collection-creation.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run --reporter=verbose`
- **Per wave merge:** `pnpm exec vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest` + `@types/node` dev dependency installation
- [ ] `vitest.config.ts` configuration file with TypeScript support and dotenv loading
- [ ] `tests/unit/identity-verification.test.ts` -- covers IDENT-03 (pure PDA derivation, no network)
- [ ] `tests/integration/wallet-setup.test.ts` -- covers IDENT-02 (reads devnet balances)
- [ ] `tests/integration/agent-registration.test.ts` -- covers IDENT-01 (reads devnet PDA state)
- [ ] `tests/integration/collection-creation.test.ts` -- covers IDENT-04 (reads devnet collection)
- [ ] `tests/helpers/setup.ts` -- shared Umi/Connection setup for integration tests

**Note:** Integration tests for this phase require a live devnet connection and pre-funded wallets. Unit tests for PDA derivation and verification logic can run offline. The registration script itself (`scripts/register-agents.ts`) IS the primary integration test -- if it succeeds, IDENT-01 and IDENT-04 are verified. Additional test files provide regression safety.

## Sources

### Primary (HIGH confidence)
- `@metaplex-foundation/mpl-agent-registry` v0.2.0 npm package -- direct tarball inspection of type definitions for `registerIdentityV1`, `findAgentIdentityV1Pda`, `fetchAgentIdentityV1`, `AgentIdentityV1` account structure, error types
- `@metaplex-foundation/mpl-core` -- official Metaplex Core JS SDK docs at [metaplex.com/docs/smart-contracts/core/sdk/javascript](https://metaplex.com/docs/smart-contracts/core/sdk/javascript) for `create()`, `createCollection()`, `fetchAsset()`, `fetchCollection()` APIs
- [Metaplex Core Collections docs](https://metaplex.com/docs/smart-contracts/core/collections) -- collection authority requirements
- [Metaplex Umi Getting Started](https://metaplex.com/docs/dev-tools/umi/getting-started) -- Umi initialization, `createSignerFromKeypair`, identity/payer setup
- [Umi web3js adapters API reference](https://umi-docs.vercel.app/modules/umi-web3js-adapters.html) -- `fromWeb3JsKeypair`, `toWeb3JsKeypair`, `fromWeb3JsPublicKey`, `toWeb3JsPublicKey`
- `/Users/memehalis/hack/projects/agentfund/docs/metaplex-agent-registry.md` -- project SDK documentation with full API reference
- `/Users/memehalis/hack/challenges/04-agentic-funding-metaplex/RESEARCH-solana-metaplex.md` -- implementation patterns and architecture

### Secondary (MEDIUM confidence)
- [Quicknode: What is Metaplex Core and How to Mint Your First Core NFT](https://www.quicknode.com/guides/solana-development/nfts/metaplex-core) -- createCollection + create patterns
- [Quicknode: SPL Token Transfers on Solana](https://www.quicknode.com/guides/solana-development/spl-tokens/how-to-transfer-spl-tokens-on-solana) -- getOrCreateAssociatedTokenAccount patterns
- `.planning/research/STACK.md` -- project stack research (version compatibility matrix, what NOT to use)
- `.planning/research/PITFALLS.md` -- domain pitfalls (Umi/web3.js confusion, devnet unreliability, transaction size limits)

### Tertiary (LOW confidence)
- None -- all findings verified from primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified via npm registry and official docs
- Architecture: HIGH - patterns derived from Metaplex official docs + npm package type inspection
- Pitfalls: HIGH - pitfalls verified via type definition inspection (e.g., `agentRegistrationUri` requirement) and prior stack research
- Code examples: HIGH - all examples verified against current mpl-core SDK docs (using `create()` not `createV1()`) and npm package types

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- mpl-agent-registry is new but API is auto-generated from IDL, unlikely to change within a minor version)
