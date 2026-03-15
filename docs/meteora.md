# Meteora DLMM SDK Documentation

> Source: [docs.meteora.ag](https://docs.meteora.ag)
> LLM docs: [docs.meteora.ag/llms.txt](https://docs.meteora.ag/llms.txt)
> GitHub: [github.com/MeteoraAg/dlmm-sdk](https://github.com/MeteoraAg/dlmm-sdk)
> npm: [@meteora-ag/dlmm](https://www.npmjs.com/package/@meteora-ag/dlmm)

## Overview

Meteora provides AMM products on Solana including DLMM (Dynamic Liquidity Market Maker), a discrete liquidity bin-based system. The DLMM SDK is the primary TypeScript interface for interacting with it.

## Installation

```bash
# npm
npm install @meteora-ag/dlmm @solana/web3.js

# pnpm
pnpm install @meteora-ag/dlmm @solana/web3.js

# yarn
yarn add @meteora-ag/dlmm @solana/web3.js
```

## SDK Initialization

```typescript
import DLMM from '@meteora-ag/dlmm';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Create a single pool instance
const USDC_USDT_POOL = new PublicKey('ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq');
const dlmmPool = await DLMM.create(connection, USDC_USDT_POOL);

// Create multiple pool instances (optimized RPC calls)
const pools = await DLMM.createMultiple(connection, [USDC_USDT_POOL, ...otherAddresses]);
```

### Pool Discovery

Get all available pool addresses from:
```
https://dlmm.datapi.meteora.ag/pair/all
```

### Devnet Testing

Faucet available at: https://faucet.raccoons.dev/

## API Rate Limits

| Product | Rate Limit |
|---------|-----------|
| DLMM | 30 requests per second |
| DAMM V1 | 10 requests per second |
| DAMM V2 | 10 requests per second |
| Dynamic Vault & Stake2Earn | No rate limits |

## Core API Methods

### DLMM.create() (Static Factory)

Initialize a single DLMM pool instance with all on-chain data loaded.

```typescript
static async create(
  connection: Connection,
  dlmm: PublicKey,
  opt?: Opt
): Promise<DLMM>
```

**Parameters**:
- `connection` - Solana RPC connection
- `dlmm` - Public key of the LbPair account
- `opt` - Optional: `{ cluster, programId, skipSolWrappingOperation }`

### DLMM.createMultiple() (Static Factory)

Batch-initialize multiple DLMM instances with optimized RPC calls.

```typescript
static async createMultiple(
  connection: Connection,
  dlmmList: Array<PublicKey>,
  opt?: Opt
): Promise<DLMM[]>
```

### refetchStates()

Synchronize all cached on-chain state with blockchain.

```typescript
async refetchStates(): Promise<void>
```

Updates: LbPair, BinArrayBitmapExtension, Token reserves, Reward reserves, Token mints, Transfer hooks, Clock.

### getActiveBin()

Retrieve current active bin ID and its price.

```typescript
async getActiveBin(): Promise<BinLiquidity>
```

**Returns**: `BinLiquidity` with `binId`, `xAmount`, `yAmount`, `price`

```typescript
const activeBin = await dlmmPool.getActiveBin();
console.log('Active bin ID:', activeBin.binId);
console.log('Active bin price:', activeBin.pricePerToken);
```

### swap()

Execute a swap operation.

```typescript
async swap({
  inToken,
  outToken,
  inAmount,
  minOutAmount,
  lbPair,
  user,
  binArraysPubkey,
}: SwapParams): Promise<Transaction>
```

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `inToken` | `PublicKey` | Input token mint address |
| `outToken` | `PublicKey` | Output token mint address |
| `inAmount` | `BN` | Amount of input token to swap |
| `minOutAmount` | `BN` | Minimum expected output token amount |
| `lbPair` | `PublicKey` | Liquidity pool address |
| `user` | `PublicKey` | User account public key |
| `binArraysPubkey` | `PublicKey[]` | Bin arrays involved in swap |

```typescript
const swapTx = await dlmmPool.swap({
  inToken: tokenXMint,
  outToken: tokenYMint,
  inAmount: new BN(1000000),
  minOutAmount: new BN(950000),
  lbPair: dlmmPool.pubkey,
  user: userPublicKey,
  binArraysPubkey: swapQuote.binArraysPubkey
});
```

### initializePositionAndAddLiquidityByStrategy()

Initialize a new position and add liquidity using a specified strategy.

```typescript
async initializePositionAndAddLiquidityByStrategy({
  positionPubKey,
  totalXAmount,
  totalYAmount,
  strategy,
  user,
  slippage,
}: TInitializePositionAndAddLiquidityParamsByStrategy): Promise<Transaction>
```

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `positionPubKey` | `PublicKey` | Position account (typically `new Keypair()`) |
| `totalXAmount` | `BN` | Total token X amount to add |
| `totalYAmount` | `BN` | Total token Y amount to add |
| `strategy` | `StrategyParameters` | `{ strategyType, minBinId, maxBinId }` |
| `user` | `PublicKey` | User account public key |
| `slippage` | `number?` | Optional slippage percentage |

**Strategy Types**: `StrategyType.SpotBalanced`, `StrategyType.BidAsk`, `StrategyType.Curve`

```typescript
import { Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

const positionKeypair = new Keypair();
const btcInAmount = new BN(1).mul(new BN(10 ** btcDecimal));
const usdcInAmount = new BN(24000).mul(new BN(10 ** usdcDecimal));

const transaction = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
  positionPubKey: positionKeypair.publicKey,
  totalXAmount: btcInAmount,
  totalYAmount: usdcInAmount,
  strategy: {
    strategyType: StrategyType.SpotBalanced,
    minBinId: 8388600,
    maxBinId: 8388620,
  },
  user: userPublicKey,
  slippage: 1
});
```

### addLiquidityByStrategy()

Add liquidity to an existing position using a specified strategy.

```typescript
async addLiquidityByStrategy({
  positionPubKey,
  totalXAmount,
  totalYAmount,
  strategy,
  user,
  slippage,
}: TInitializePositionAndAddLiquidityParamsByStrategy): Promise<Transaction>
```

```typescript
const transaction = await dlmmPool.addLiquidityByStrategy({
  positionPubKey: position.publicKey,
  totalXAmount: btcInAmount,
  totalYAmount: usdcInAmount,
  strategy: {
    minBinId: 8388600,
    maxBinId: 8388620,
    strategyType: StrategyType.SpotBalanced,
  },
  user: userPublicKey,
  slippage: 1
});
```

Note: `addLiquidityByStrategyChunkable` is also available for wide bin ranges to avoid transaction size issues.

### removeLiquidity()

Remove liquidity from a position with optional reward claiming and position closure.

```typescript
async removeLiquidity({
  user,
  position,
  fromBinId,
  toBinId,
  bps,
  shouldClaimAndClose?,
  skipUnwrapSOL?,
}: RemoveLiquidityParams): Promise<Transaction[]>
```

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `user` | `PublicKey` | User account public key |
| `position` | `PublicKey` | Position account public key |
| `fromBinId` | `number` | Starting bin ID |
| `toBinId` | `number` | Ending bin ID |
| `bps` | `BN` | Basis points of liquidity to remove (5000 = 50%) |
| `shouldClaimAndClose` | `boolean?` | Claim rewards and close position |
| `skipUnwrapSOL` | `boolean?` | Keep withdrawn SOL as wSOL |

```typescript
const transactions = await dlmmPool.removeLiquidity({
  user: userPublicKey,
  position: positionPublicKey,
  fromBinId: 8388600,
  toBinId: 8388620,
  bps: new BN(5000), // 50%
  shouldClaimAndClose: false
});
```

### getPosition()

Retrieve position information.

```typescript
async getPosition(positionPubKey: PublicKey): Promise<LbPosition>
```

```typescript
const position = await dlmmPool.getPosition(positionPublicKey);
```

### closePosition()

Close a position and recover the rent.

```typescript
async closePosition({
  owner: PublicKey,
  position: LbPosition,
}): Promise<Transaction>
```

```typescript
const position = await dlmmPool.getPosition(positionPublicKey);
const closeTx = await dlmmPool.closePosition({
  owner: userPublicKey,
  position
});
```

### getBinArrays()

Retrieve all bin array accounts containing liquidity.

```typescript
async getBinArrays(): Promise<BinArrayAccount[]>
```

### getBinArrayForSwap()

Get bin arrays required for swap execution.

```typescript
async getBinArrayForSwap(swapYtoX: boolean): Promise<BinArrayAccount[]>
```

- `swapYtoX: true` -- traverses left (decreasing bin IDs)
- `swapYtoX: false` -- traverses right (increasing bin IDs)

### getFeeInfo()

Retrieve pool's fee structure.

```typescript
getFeeInfo(): FeeInfo
// Returns: { baseFee: Decimal, maxFee: Decimal, protocolFee: Decimal }
```

### getDynamicFee()

Calculate current dynamic fee based on volatility.

```typescript
getDynamicFee(): Decimal
```

### Price Conversions

```typescript
// Convert real price to lamport price
toPricePerLamport(realPrice: Decimal): string

// Convert lamport price to real price
fromPricePerLamport(lamportPrice: string): Decimal

// Calculate bin ID for given price (static method)
static getBinIdFromPrice(
  price: string | number | Decimal,
  binStep: number,
  min: boolean  // true for floor, false for ceil
): number

// Get price for specific bin by ID
getPriceOfBinByBinId(binId: number): string
```

### Pool Discovery (Static)

```typescript
// Check if pool exists and return its address
static async getPairPubkeyIfExists(
  connection: Connection,
  tokenX: PublicKey,
  tokenY: PublicKey,
  binStep: number,
  baseFactor: number,
  opt?: Opt
): Promise<PublicKey | null>

// Get all user positions across all DLMM pools
static async getAllLbPairPositionsByUser(
  connection: Connection,
  userPubKey: PublicKey,
  opt?: Opt,
  getPositionsOpt?: GetPositionsOpt
): Promise<Map<string, PositionInfo>>
```

**GetPositionsOpt Interface**:
```typescript
{
  chunkSize?: number,           // Positions per fetch
  callback?: (processed) => void,
  parallelExecution?: boolean
}
```

## Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `pubkey` | `PublicKey` | LbPair account public key |
| `program` | `ClmmProgram` | Anchor program instance |
| `lbPair` | `LbPair` | Decoded pool configuration |
| `tokenX` | `TokenReserve` | Token X information |
| `tokenY` | `TokenReserve` | Token Y information |
| `rewards` | `TokenReserve[]` | Reward token reserves (max 2) |
| `clock` | `Clock` | Cached Solana clock sysvar |

## TokenReserve Structure

```typescript
interface TokenReserve {
  publicKey: PublicKey;              // Token mint
  reserve: PublicKey;                // Pool's token vault
  mint: Mint;                        // Unpacked mint data
  amount: bigint;                    // Current balance
  owner: PublicKey;                  // Token program (SPL/Token2022)
  transferHookAccountMetas: AccountMeta[]; // Token2022 hooks
}
```

## Meteora Product Categories

- **DAMM v1**: Constant-product AMM with swap fees and vault yield
- **DAMM v2**: Concentrated-liquidity constant-product AMM with flexible fee modes
- **DLMM**: Discrete liquidity bin-based system (this SDK)
- **DBC**: Permissionless token launch protocol using bonding curves
- **Dynamic Vault**: Yield infrastructure allocating capital across protocols
- **Alpha Vault**: Anti-sniper protection suite
- **Presale Vault**: Multi-token contribution system
- **Stake2Earn**: Fee-sharing mechanism with token stakers

## Testing (Contributors)

```bash
cd ts-client
bun install
bun test
```
