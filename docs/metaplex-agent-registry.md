# Metaplex Agent Registry (mpl-agent-identity) Documentation

> Source: [github.com/metaplex-foundation/mpl-agent](https://github.com/metaplex-foundation/mpl-agent)
> Program ID: `1DREGFgysWYxLnRnKQnwrxnJQeSMk2HmGaC6whw2B2p`

## Overview

The MPL Agent Identity Registry is a Solana program for registering verifiable agent identities on MPL Core assets. It creates a bidirectional connection: the PDA points to the asset, and the asset carries plugin data whose authority is the PDA, forming tamper-evident on-chain identity binding.

## Installation

### TypeScript / JavaScript

```bash
npm install @metaplex-foundation/mpl-agent-registry
```

### Rust

```toml
[dependencies]
mpl-agent-identity = "0.1.0"
```

## TypeScript SDK Setup

```typescript
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplAgentIdentity } from '@metaplex-foundation/mpl-agent-registry';

const umi = createUmi('https://api.mainnet-beta.solana.com')
  .use(mplAgentIdentity());
```

## Key API Functions

### Register an Agent Identity

```typescript
import {
  registerIdentityV1,
  findAgentIdentityV1Pda,
  fetchAgentIdentityV1,
} from '@metaplex-foundation/mpl-agent-registry';

// Register identity on an MPL Core asset
await registerIdentityV1(umi, {
  asset: assetPublicKey,
  collection: collectionPublicKey,
}).sendAndConfirm(umi);
```

### Find Agent Identity PDA

```typescript
const pda = findAgentIdentityV1Pda(umi, { asset: assetPublicKey });
```

PDA seeds: `["agent_identity", <asset_pubkey>]`

### Fetch Agent Identity

```typescript
const identity = await fetchAgentIdentityV1(umi, pda);
// identity.asset => the bound MPL Core asset reference
// identity.bump => PDA bump seed
```

## Registration Process

1. Submit `RegisterIdentityV1` instruction with target asset and collection
2. Program derives `AgentIdentityV1` PDA using seeds: `["agent_identity", <asset_pubkey>]`
3. CPI into MPL Core adds `AppData` external plugin with PDA as data authority

## Verification

Anyone can verify identity by:
1. Deriving the PDA from the asset's public key and confirming account existence
2. Inspecting the asset's `AppData` plugin to validate data authority matches the PDA

## Account Structure: AgentIdentityV1 PDA (40 bytes)

| Field | Type | Description |
|-------|------|-------------|
| `key` | `u8` | Account discriminator |
| `bump` | `u8` | PDA bump seed |
| `_padding` | `[u8; 6]` | Alignment padding |
| `asset` | `Pubkey` | Bound MPL Core asset reference |

## RegisterIdentityV1 Instruction Accounts

| # | Account | Writable | Signer | Purpose |
|---|---------|----------|--------|---------|
| 0 | agentIdentity | Yes | No | PDA creation (derived from asset) |
| 1 | asset | Yes | No | Target MPL Core asset |
| 2 | collection | Yes | No | Asset's collection (optional) |
| 3 | payer | Yes | Yes | Transaction fee coverage |
| 4 | authority | No | Yes | Collection authority (optional; payer default) |
| 5 | mplCoreProgram | No | No | MPL Core program reference |
| 6 | systemProgram | No | No | System program reference |

## Additional Programs (Not Yet Finalized)

The repository also includes:
- `mpl-agent-reputation` - Agent reputation tracking
- `mpl-agent-validation` - Agent validation

These follow the same architectural patterns but are not yet finalized.

## Development Setup

### Requirements
- pnpm 8.9.0
- Rust 1.83.0
- Solana CLI 2.2.1

### Build & Test Commands

```bash
pnpm programs:build          # Compile programs
pnpm programs:test           # Run program tests
pnpm clients:js:test         # TypeScript client tests
pnpm clients:rust:test       # Rust client tests
pnpm generate                # Regenerate IDL & clients (Shank + Kinobi)
```

## Repository Structure

```
programs/mpl-agent-identity/src/
  lib.rs              # Program ID
  entrypoint.rs       # Routing logic
  instruction.rs      # Shank-annotated enum (IDL generation)
  error.rs            # Error definitions
  processor/
    mod.rs            # Dispatch logic
    register.rs       # Registration implementation
  state/
    mod.rs            # Discriminator enum
    agent_identity.rs # AgentIdentityV1 account

clients/js/           # TypeScript (@metaplex-foundation/mpl-agent-registry)
clients/rust-identity/# Rust crate (mpl-agent-identity)
configs/              # Shank/Kinobi configuration
idls/                 # Generated IDL
```

## Dependencies

- `@metaplex-foundation/umi` (Solana framework)
- `@metaplex-foundation/umi-bundle-defaults`
- `@metaplex-foundation/mpl-core` (MPL Core program)

## License

Metaplex NFT Open Source License
