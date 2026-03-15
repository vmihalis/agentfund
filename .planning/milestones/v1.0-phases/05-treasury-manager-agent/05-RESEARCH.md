# Phase 5: Treasury Manager Agent - Research

**Researched:** 2026-03-14
**Domain:** Solana SPL token transfers, Meteora DLMM liquidity management, treasury balance tracking
**Confidence:** MEDIUM

## Summary

Phase 5 replaces the `StubTreasuryAgent` with a real `TreasuryAgent` that performs three core operations on Solana devnet: (1) tracking balances (SOL + USDC + LP positions), (2) executing SPL token transfers for governance-approved grants, and (3) creating/removing Meteora DLMM liquidity positions for idle treasury yield. The SPL transfer functionality is well-supported by the existing `@solana/spl-token` library already in the project. The Meteora DLMM integration requires adding the `@meteora-ag/dlmm` package plus its peer dependency `@coral-xyz/anchor`.

The primary risk is **Meteora DLMM devnet pool availability**. Meteora's docs confirm their programs are deployed on devnet, and the SDK supports `{ cluster: "devnet" }`. However, finding existing pools on devnet is uncertain. The mitigation strategy is to create our own DLMM pool on devnet using `DLMM.createCustomizablePermissionlessLbPair()` with our DEMO_USDC and a SOL-wrapped token pair. The SPL transfer portion (TREAS-01, TREAS-02, TREAS-05) is straightforward and should be implemented first as the high-certainty path, with DLMM (TREAS-03, TREAS-04) as the second plan.

**Primary recommendation:** Split into two plans -- Plan 1: TreasuryAgent with balance tracking + SPL transfers (HIGH confidence). Plan 2: Meteora DLMM LP position management (MEDIUM confidence, may need own pool creation on devnet).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TREAS-01 | Treasury Manager holds and tracks fund balances on Solana devnet | Existing `@solana/spl-token` getAccount + connection.getBalance; extend TreasuryBalance type to include LP positions |
| TREAS-02 | Treasury Manager executes SPL token transfers for approved funding decisions | `transfer()` from `@solana/spl-token` with `getOrCreateAssociatedTokenAccount()` for recipient ATAs |
| TREAS-03 | Treasury Manager creates and manages at least one Meteora DLMM LP position for idle treasury yield | `@meteora-ag/dlmm` SDK `initializePositionAndAddLiquidityByStrategy` with StrategyType.Spot |
| TREAS-04 | Treasury Manager can remove liquidity and claim rewards from DLMM positions | `removeLiquidity` with `shouldClaimAndClose` + `claimAllRewards` from DLMM SDK |
| TREAS-05 | Treasury Manager reports treasury status (balance, LP positions, yield) on request | Combine SOL balance, USDC balance, and DLMM position data via `getPositionsByUserAndLbPair` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @solana/spl-token | 0.4.14 (already installed) | SPL token transfers, ATA management, balance queries | Official Solana SPL token library, already in project |
| @solana/web3.js | 1.98.4 (already installed) | Connection, transactions, SOL balance | Core Solana JS SDK, already in project |
| @meteora-ag/dlmm | 1.9.3 | Meteora DLMM pool creation, LP position management | Official Meteora DLMM SDK; only way to interact with DLMM program |
| @coral-xyz/anchor | 0.31.0 | Anchor framework (peer dep of @meteora-ag/dlmm) | Required by Meteora DLMM SDK for IDL-driven account interaction |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| bn.js | ^5.2.1 | Arbitrary precision integers for DLMM amounts | Peer dependency of Meteora SDK; used for amounts in LP operations |
| decimal.js | ^10.4.2 | High-precision decimal calculations for prices/fees | Peer dependency of Meteora SDK; used for price calculations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @meteora-ag/dlmm | Direct Anchor program calls | SDK handles IDL, bin math, transaction building -- hand-rolling would take 10x longer |
| Creating own devnet pool | Finding existing devnet pool | Own pool guarantees availability; existing may not exist on devnet |
| bn.js | Native BigInt | Meteora SDK API surface uses BN type -- fighting it adds complexity |

**Installation:**
```bash
pnpm install @meteora-ag/dlmm @coral-xyz/anchor bn.js decimal.js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  agents/
    treasury-agent.ts          # TreasuryAgent class replacing StubTreasuryAgent
  lib/
    solana/
      token-accounts.ts        # Existing ATA + balance helpers (extend)
      connection.ts             # Existing singleton connection
    meteora/
      dlmm-client.ts           # DLMM pool interaction wrapper
      types.ts                  # LP position types
  types/
    proposals.ts               # Extend TreasuryBalance with LP position data
```

### Pattern 1: TreasuryAgent extends BaseAgent + implements ITreasuryAgent
**What:** Follow the exact pattern used by ScoutAgent, AnalyzerAgent -- extend BaseAgent, implement ITreasuryAgent interface, emit status events
**When to use:** Always -- this is the established project pattern
**Example:**
```typescript
// Source: Existing project patterns (base-agent.ts, governance-agent.ts)
export class TreasuryAgent extends BaseAgent implements ITreasuryAgent {
  constructor(bus: AgentEventBus) {
    super('treasury', bus);
  }

  async initialize(): Promise<void> {
    this.emitStatus('initialized', 'TreasuryAgent ready');
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'TreasuryAgent stopped');
  }

  async executeFunding(allocation: FundingAllocation): Promise<TransactionResult> {
    this.emitStatus('funding', `Executing: ${allocation.proposalTitle}`);
    // Real SPL token transfer here
    const signature = await this.transferUSDC(recipientPubkey, allocation.amount);
    return { success: true, signature };
  }

  async getBalance(): Promise<TreasuryBalance> {
    // Real on-chain balance query
  }
}
```

### Pattern 2: SPL Token Transfer with ATA Resolution
**What:** Transfer USDC from treasury wallet to recipient, creating recipient ATA if needed
**When to use:** Every grant funding execution (TREAS-02)
**Example:**
```typescript
// Source: @solana/spl-token official docs, existing token-accounts.ts
import { transfer, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';

async transferUSDC(
  recipient: PublicKey,
  amount: number,
): Promise<string> {
  const connection = this.connection;

  // Resolve the USDC mint from addresses.json or env
  const usdcMint = this.getUsdcMint();

  // Get or create sender ATA
  const senderAta = await getOrCreateAssociatedTokenAccount(
    connection, this.keypair, usdcMint, this.publicKey,
  );

  // Get or create recipient ATA (treasury pays rent if new)
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection, this.keypair, usdcMint, recipient,
  );

  // Transfer with 6 decimals (USDC standard)
  const amountLamports = amount * 1_000_000;
  const signature = await transfer(
    connection,
    this.keypair,        // payer for tx fees
    senderAta.address,   // source ATA
    recipientAta.address,// destination ATA
    this.keypair,        // owner of source
    amountLamports,
  );

  return signature;
}
```

### Pattern 3: Meteora DLMM Pool Interaction
**What:** Create LP position with SpotBalanced strategy around active bin
**When to use:** TREAS-03 (idle treasury yield)
**Example:**
```typescript
// Source: Meteora DLMM SDK docs (docs.meteora.ag)
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import { Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import BN from 'bn.js';

// Load or create pool
const dlmmPool = await DLMM.create(connection, poolAddress, {
  cluster: 'devnet',
});

// Get active bin to center the position
const activeBin = await dlmmPool.getActiveBin();
const BINS_EACH_SIDE = 10;

const positionKeypair = Keypair.generate();
const strategy = {
  strategyType: StrategyType.Spot,  // "SpotBalanced"
  minBinId: activeBin.binId - BINS_EACH_SIDE,
  maxBinId: activeBin.binId + BINS_EACH_SIDE,
};

const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
  positionPubKey: positionKeypair.publicKey,
  totalXAmount: new BN(xAmount),
  totalYAmount: new BN(yAmount),
  strategy,
  user: treasuryKeypair.publicKey,
  slippage: 1,
});

// Sign and send
const signature = await sendAndConfirmTransaction(connection, tx, [
  treasuryKeypair,
  positionKeypair,
]);
```

### Pattern 4: Extended TreasuryBalance Type
**What:** Extend the existing TreasuryBalance interface to include LP position data
**When to use:** TREAS-05 reporting
**Example:**
```typescript
// Extend existing types/proposals.ts
export interface LPPosition {
  poolAddress: string;
  positionAddress: string;
  tokenX: string;
  tokenY: string;
  liquidityShare: number;  // In basis points
  unclaimedFees: number;
}

export interface TreasuryBalance {
  solBalance: number;
  usdcBalance: number;
  totalValueUsd: number;
  lpPositions?: LPPosition[];  // New field for DLMM positions
}
```

### Anti-Patterns to Avoid
- **Using web3.js 2.0 APIs:** The project is locked to @solana/web3.js 1.x; Meteora SDK requires 1.x as well. Do NOT upgrade.
- **Hardcoding pool addresses:** Devnet pools may not persist. Always check pool existence before interacting. Use pool creation as fallback.
- **Ignoring ATA creation:** The recipient wallet may not have a USDC ATA. Always use `getOrCreateAssociatedTokenAccount` (treasury pays rent).
- **Raw amount math:** USDC has 6 decimals. Always multiply human amounts by 1_000_000. The project already has this pattern in token-accounts.ts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DLMM bin math/price calculation | Custom bin ID calculation | `dlmmPool.getActiveBin()` + relative offsets | Bin math is complex with logarithmic price curves |
| Transaction building for DLMM | Raw instruction construction | `dlmmPool.initializePositionAndAddLiquidityByStrategy()` | 5+ accounts, proper PDA derivation, bin array handling |
| SPL token transfer | Manual instruction building | `transfer()` from @solana/spl-token | Handles authority checks, ATA validation |
| ATA address derivation | Manual PDA derivation | `getOrCreateAssociatedTokenAccount()` | Handles creation + idempotent |
| Pool creation on devnet | Manual Anchor calls | `DLMM.createCustomizablePermissionlessLbPair()` | Handles preset params, activation config |

**Key insight:** Both SPL transfers and DLMM operations have well-tested SDK wrappers. The complexity is in devnet environment setup (funding, ATA creation, pool availability), not in the code logic.

## Common Pitfalls

### Pitfall 1: Devnet DLMM Pool Availability
**What goes wrong:** No pre-existing DLMM pools on devnet for the tokens we hold (DEMO_USDC/SOL)
**Why it happens:** Meteora's mainnet has thousands of pools, but devnet is sparse. The project uses DEMO_USDC (custom mint) which will have zero existing pools.
**How to avoid:** Create our own DLMM pool on devnet using `DLMM.createCustomizablePermissionlessLbPair()` with our DEMO_USDC mint and SOL (or wrapped SOL). This guarantees pool availability.
**Warning signs:** `DLMM.create()` throws "Account not found" or similar when pool address is invalid.

### Pitfall 2: Insufficient SOL for Transaction Fees
**What goes wrong:** Treasury agent keypair runs out of SOL for transaction fees and ATA rent
**Why it happens:** Each ATA creation costs ~0.002 SOL rent. Each transaction costs ~0.000005 SOL. Multiple operations drain the devnet airdrop.
**How to avoid:** Check SOL balance before operations. Use existing `airdropSol()` helper from `src/lib/solana/airdrop.ts` to top up. The `ensureMinBalance()` function already exists.
**Warning signs:** "Transaction simulation failed: Attempt to debit an account but found no record of a prior credit" error.

### Pitfall 3: DEMO_USDC vs Devnet USDC Confusion
**What goes wrong:** Code assumes official devnet USDC mint but the project falls back to DEMO_USDC (custom mint with deployer as mint authority)
**Why it happens:** The `fund-wallets.ts` script creates DEMO_USDC when official devnet USDC is unavailable. The mint address is saved in `keys/demo-usdc-mint.json`.
**How to avoid:** Always load the USDC mint from `keys/addresses.json` which tracks whether it's DEMO_USDC. The `isDemoUSDC` flag tells you. When creating DLMM pools, use the ACTUAL mint from addresses.json.
**Warning signs:** "Token account not found" when using hardcoded USDC mint address.

### Pitfall 4: Position Keypair Not Saved
**What goes wrong:** DLMM position keypair is generated but not persisted, making it impossible to manage the position later
**Why it happens:** The position keypair is created with `Keypair.generate()` for the transaction, but if not saved, you cannot reference the position later.
**How to avoid:** Save position keypairs to disk (e.g., `keys/dlmm-positions/`) or track position public keys in a JSON state file. The `getPositionsByUserAndLbPair()` method can also rediscover positions by owner.
**Warning signs:** Cannot find position to remove liquidity or claim rewards.

### Pitfall 5: Anchor Version Conflicts
**What goes wrong:** Installing `@coral-xyz/anchor` introduces version conflicts with existing Solana dependencies
**Why it happens:** Anchor has its own @solana/web3.js dependency. If versions mismatch, you get type incompatibilities.
**How to avoid:** Install `@coral-xyz/anchor@0.31.0` which is compatible with `@solana/web3.js ^1.91.6` (project has 1.98.4, which is fine). Use `pnpm` strict mode to catch conflicts.
**Warning signs:** TypeScript errors about incompatible PublicKey or Connection types between modules.

### Pitfall 6: Transaction Size Limits with DLMM
**What goes wrong:** DLMM operations with many bins can exceed Solana's 1232-byte transaction size limit
**Why it happens:** Each bin adds instructions. `addLiquidityByStrategyChunkable` returns multiple transactions for wide ranges.
**How to avoid:** Use a narrow bin range (10 bins each side = 20 total). Use `initializePositionAndAddLiquidityByStrategy` for initial creation (single tx). Check if returned value is array of transactions and send sequentially.
**Warning signs:** "Transaction too large" error.

## Code Examples

Verified patterns from official sources:

### Balance Tracking (TREAS-01, TREAS-05)
```typescript
// Source: Existing project patterns + @solana/spl-token docs
import { getAccount } from '@solana/spl-token';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

async function getTreasuryStatus(
  connection: Connection,
  treasuryPubkey: PublicKey,
  usdcMint: PublicKey,
  usdcAta: PublicKey,
): Promise<TreasuryBalance> {
  // SOL balance
  const solLamports = await connection.getBalance(treasuryPubkey);
  const solBalance = solLamports / LAMPORTS_PER_SOL;

  // USDC balance (6 decimals)
  let usdcBalance = 0;
  try {
    const account = await getAccount(connection, usdcAta);
    usdcBalance = Number(account.amount) / 1_000_000;
  } catch {
    // ATA may not exist yet
  }

  return {
    solBalance,
    usdcBalance,
    totalValueUsd: usdcBalance + (solBalance * 150), // rough SOL price for display
  };
}
```

### SPL Token Transfer (TREAS-02)
```typescript
// Source: @solana/spl-token official docs + Solana official transfer example
import {
  transfer,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';

async function executeSplTransfer(
  connection: Connection,
  payer: Keypair,
  usdcMint: PublicKey,
  recipientWallet: PublicKey,
  amountUsdc: number,
): Promise<string> {
  // Source ATA (treasury's USDC account)
  const sourceAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, usdcMint, payer.publicKey,
  );

  // Destination ATA (create if needed, treasury pays rent)
  const destAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, usdcMint, recipientWallet,
  );

  // Transfer (amount in smallest unit -- 6 decimals for USDC)
  const signature = await transfer(
    connection,
    payer,
    sourceAta.address,
    destAta.address,
    payer,
    amountUsdc * 1_000_000,
  );

  return signature;
}
```

### DLMM Pool Creation on Devnet (TREAS-03 setup)
```typescript
// Source: Meteora DLMM SDK docs (docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions)
import DLMM, { ActivationType } from '@meteora-ag/dlmm';
import BN from 'bn.js';

async function createDevnetDlmmPool(
  connection: Connection,
  tokenX: PublicKey,  // e.g., SOL (native mint)
  tokenY: PublicKey,  // e.g., DEMO_USDC
  creator: Keypair,
): Promise<string> {
  const binStep = new BN(10);        // 0.10% per bin
  const activeId = new BN(8388608);  // Center bin ID
  const feeBps = new BN(25);         // 0.25% fee
  const activationPoint = new BN(0); // Immediate activation

  const tx = await DLMM.createCustomizablePermissionlessLbPair(
    connection,
    binStep,
    tokenX,
    tokenY,
    activeId,
    feeBps,
    ActivationType.Timestamp,
    false,  // no alpha vault
    creator.publicKey,
    activationPoint,
    false,  // no creator control
    { cluster: 'devnet' },
  );

  const signature = await sendAndConfirmTransaction(
    connection, tx, [creator],
  );
  return signature;
}
```

### Remove Liquidity and Claim Rewards (TREAS-04)
```typescript
// Source: Meteora DLMM SDK docs
import DLMM from '@meteora-ag/dlmm';
import BN from 'bn.js';

async function removeLiquidityAndClaim(
  dlmmPool: InstanceType<typeof DLMM>,
  connection: Connection,
  owner: Keypair,
  positionPubkey: PublicKey,
  fromBinId: number,
  toBinId: number,
): Promise<string[]> {
  // Remove 100% of liquidity and claim all rewards
  const txs = await dlmmPool.removeLiquidity({
    user: owner.publicKey,
    position: positionPubkey,
    fromBinId,
    toBinId,
    bps: new BN(10000), // 100%
    shouldClaimAndClose: true,
  });

  const signatures: string[] = [];
  for (const tx of txs) {
    const sig = await sendAndConfirmTransaction(connection, tx, [owner]);
    signatures.push(sig);
  }
  return signatures;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @mercurial-finance/dlmm-sdk | @meteora-ag/dlmm | Meteora rebranding | Use @meteora-ag/dlmm -- old package name is deprecated |
| @solana/web3.js 2.x with BigInt | @solana/web3.js 1.x with BN.js | 2024-2025 | Project uses 1.x; Meteora SDK requires 1.x; do NOT upgrade |
| Manual DLMM program calls | DLMM SDK class methods | Ongoing | SDK v1.9.3 is current, well-maintained |
| transfer() with raw instructions | transfer() helper from @solana/spl-token | Stable | Helper handles all boilerplate; already in project deps |

**Deprecated/outdated:**
- `@mercurial-finance/dlmm-sdk`: Old package name, replaced by `@meteora-ag/dlmm`
- `@solana/web3.js` 2.0: Not compatible with current Meteora SDK; do not upgrade

## Open Questions

1. **Devnet DLMM Program Availability**
   - What we know: Meteora docs say "Our programs are deployed on devnet as well at https://devnet.meteora.ag". The SDK supports `{ cluster: "devnet" }`.
   - What's unclear: Whether the same program ID (`LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`) works on devnet, or if there's a separate devnet program ID.
   - Recommendation: Verify at runtime by checking `connection.getAccountInfo(programId)` on devnet. If program exists, proceed. If not, the DLMM features gracefully degrade (treasury still does SPL transfers).

2. **SOL Wrapping for DLMM Pools**
   - What we know: DLMM pools require SPL tokens (not native SOL). SOL must be wrapped as wSOL (native mint: `So11111111111111111111111111111111111111112`).
   - What's unclear: Whether the DLMM SDK handles SOL wrapping automatically or if we need to wrap manually.
   - Recommendation: Use DEMO_USDC + another custom token pair to avoid SOL wrapping complexity. Or handle wrapping explicitly with `createWrappedNativeAccount()` from @solana/spl-token.

3. **Pool Discovery After Creation**
   - What we know: `DLMM.createCustomizablePermissionlessLbPair()` returns a Transaction, not a pool address. `DLMM.getCustomizablePermissionlessLbPairIfExists()` can find it after.
   - What's unclear: How to derive the pool address from the creation params without querying.
   - Recommendation: After creating the pool, use `DLMM.getCustomizablePermissionlessLbPairIfExists(connection, tokenX, tokenY, { cluster: "devnet" })` to find it. Persist the pool address to a JSON file.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test -- --run tests/unit/treasury-agent.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREAS-01 | Treasury tracks SOL + USDC balances | unit | `pnpm test -- --run tests/unit/treasury-agent.test.ts -t "balance"` | No -- Wave 0 |
| TREAS-02 | Treasury executes SPL token transfer producing real signature | unit + integration | `pnpm test -- --run tests/unit/treasury-agent.test.ts -t "transfer"` | No -- Wave 0 |
| TREAS-03 | Treasury creates DLMM LP position | unit + integration | `pnpm test -- --run tests/unit/treasury-dlmm.test.ts -t "create"` | No -- Wave 0 |
| TREAS-04 | Treasury removes liquidity and claims rewards | unit + integration | `pnpm test -- --run tests/unit/treasury-dlmm.test.ts -t "remove"` | No -- Wave 0 |
| TREAS-05 | Treasury reports full status with LP positions | unit | `pnpm test -- --run tests/unit/treasury-agent.test.ts -t "status"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- --run tests/unit/treasury-agent.test.ts`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/treasury-agent.test.ts` -- covers TREAS-01, TREAS-02, TREAS-05
- [ ] `tests/unit/treasury-dlmm.test.ts` -- covers TREAS-03, TREAS-04
- [ ] Framework install: `pnpm install @meteora-ag/dlmm @coral-xyz/anchor bn.js decimal.js` -- new dependencies for DLMM

## Sources

### Primary (HIGH confidence)
- [@solana/spl-token docs](https://solana-labs.github.io/solana-program-library/token/js/) - Transfer, ATA creation, balance queries (already installed in project)
- [Solana official transfer-tokens guide](https://solana.com/docs/tokens/basics/transfer-tokens) - Complete TypeScript transfer examples
- [Meteora DLMM SDK Functions docs](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions) - Full API reference for DLMM operations

### Secondary (MEDIUM confidence)
- [Meteora DLMM Getting Started](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started) - Installation, setup, DLMM.create()
- [Meteora Developer Home](https://docs.meteora.ag/developer-guide/home) - Confirms devnet deployment at devnet.meteora.ag
- [DeepWiki DLMM SDK Installation](https://deepwiki.com/MeteoraAg/dlmm-sdk/3.1-installation-and-setup) - Peer dependencies (@coral-xyz/anchor 0.31.0, bn.js, decimal.js)
- [@meteora-ag/dlmm npm](https://www.npmjs.com/package/@meteora-ag/dlmm) - Package version 1.9.3, weekly downloads, maintenance status

### Tertiary (LOW confidence)
- Meteora DLMM devnet pool availability -- docs confirm program deployment but no specific devnet pool addresses found; needs runtime verification
- @coral-xyz/anchor 0.31.0 compatibility with @solana/web3.js 1.98.4 -- likely compatible but not explicitly verified; anchoring to same 1.x line

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @solana/spl-token and @solana/web3.js are already in the project and well-documented. @meteora-ag/dlmm is the official Meteora SDK with good docs.
- Architecture: HIGH - Following established BaseAgent pattern exactly. ITreasuryAgent interface already defined.
- Pitfalls: MEDIUM - DLMM devnet availability is the main uncertainty. SPL transfer pitfalls are well-known and documented.
- DLMM integration: MEDIUM - SDK API is well-documented but devnet pool availability and @coral-xyz/anchor compatibility are unverified at runtime.

**Research date:** 2026-03-14
**Valid until:** 2026-03-21 (7 days -- hackathon is March 14-15, so this covers the full event)
