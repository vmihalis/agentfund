# Solana Agent Kit Documentation

> Source: [github.com/sendaifun/solana-agent-kit](https://github.com/sendaifun/solana-agent-kit)
> Full docs: [docs.sendai.fun](https://docs.sendai.fun)

## Installation

```bash
npm install solana-agent-kit
```

## Quick Start

```typescript
import { SolanaAgentKit, createSolanaTools } from "solana-agent-kit";

const agent = new SolanaAgentKit(
  "your-wallet-private-key-as-base58",
  "https://api.mainnet-beta.solana.com",
  { OPENAI_API_KEY: "your-openai-api-key" }
);

const tools = createSolanaTools(agent);
```

## Authentication / Setup Requirements

- Solana wallet private key (base58 encoded)
- RPC endpoint URL (mainnet, devnet, or custom)
- OpenAI API key (for AI-driven agent features)
- For OKX DEX integration, additional env vars:
  - `OKX_API_KEY`
  - `OKX_SECRET_KEY`
  - `OKX_API_PASSPHRASE`
  - `OKX_PROJECT_ID`
  - `RPC_URL`
  - `SOLANA_PRIVATE_KEY`
  - `SOLANA_WALLET_ADDRESS`

## Core Features

### Token Operations
- Deploy SPL tokens and Token2022
- Transfer assets and balance checks
- Stake SOL
- ZK compressed airdrops via Light Protocol
- Wormhole cross-chain bridging

### NFT Management
- 3.Land collection and NFT creation
- Metaplex-based collections with metadata
- Royalty configuration

### DeFi Integration
- Jupiter Exchange swaps
- Pump token launches
- Raydium pool creation (CPMM, CLMM, AMMv4)
- Orca Whirlpool, Meteora, Openbook
- Drift Vaults, perpetuals, lending/borrowing
- deBridge and Wormhole cross-chain support
- Pyth price feeds
- CoinGecko market data

### Market Data
- Real-time token pricing
- Trending tokens and pools
- Top gainers analysis

## Key API Functions

### Deploy Token

```typescript
const result = await agent.deployToken(
  "my ai token",    // name
  "uri",            // metadata URI
  "token",          // symbol
  9,                // decimals
  { mintAuthority: null },  // options
  1000000           // initial supply
);
```

### Swap Tokens (Jupiter)

```typescript
const signature = await agent.trade(
  new PublicKey("target-token-mint"),   // output token
  100,                                  // output amount
  new PublicKey("source-token-mint"),   // input token
  300                                   // slippage bps
);
```

### Stake SOL

```typescript
const signature = await agent.stake(1); // amount in SOL
```

### Send Compressed Airdrop

```typescript
const signature = await agent.sendCompressedAirdrop(
  new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"), // token mint
  42,                // amount per recipient
  [recipients],      // array of recipient addresses
  30_000             // priority fee lamports
);
```

### Get Price Data (Pyth)

```typescript
const priceFeedID = await agent.getPythPriceFeedID("SOL");
const price = await agent.getPythPrice(priceFeedID);
```

### Token Pricing (CoinGecko)

```typescript
const priceData = await agent.getTokenPriceData([
  "So11111111111111111111111111111111111111112",   // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC
]);
```

### Trending Analysis

```typescript
const trendingTokens = await agent.getTrendingTokens();
const latestPools = await agent.getLatestPools();
const topGainers = await agent.getTopGainers("24h", "all");
```

### Cross-Chain: Wormhole

```typescript
const chains = await agent.getWormholeSupportedChains();

const result = await agent.createWrappedToken({
  destinationChain: "BaseSepolia",
  tokenAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  network: "Testnet"
});
```

### Cross-Chain: deBridge

```typescript
const chains = await agent.getDebridgeSupportedChains();
const order = await agent.createDebridgeOrder(orderInput);
const signature = await agent.executeDebridgeOrder(order.tx.data);
```

### OKX DEX Swap

```typescript
const swapResult = await agent.executeSwap({
  fromTokenAddress: "So11111111111111111111111111111111111111112",
  toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  amount: "1000000000",
  autoSlippage: true,
  slippage: "0.1"
});
```

### Allora Price Inference

```typescript
const sol5mPrice = await agent.getPriceInference("SOL", "5m");
const topics = await agent.getAllTopics();
```

### Switchboard Feeds

```typescript
const value = await agent.simulateSwitchboardFeed(
  "9wcBMATS8bGLQ2UcRuYjsRAD7TPqB1CMhqfueBx78Uj2",
  "http://crossbar.switchboard.xyz"
);
```

### Sanctum LST Operations

```typescript
const prices = await agent.getSanctumLSTPrice([...]);
const apys = await agent.getSanctumLSTAPY([...]);
const txId = await agent.addSanctumLiquidity(...);
```

### Drift Protocol

```typescript
await agent.createDriftUserAccount();
await agent.createDriftVault({ name: "my-drift-vault", ... });
await agent.depositIntoDriftVault(100, "vaultAddress");
await agent.tradeUsingDriftPerpAccount({ amount: 500, symbol: "SOL", ... });
```

## AI Integration

- **LangChain**: Use `createSolanaTools(agent)` to get LangChain-compatible tools
- **Vercel AI SDK**: Compatible integration
- **Modes**: Interactive and autonomous agent modes
- **DALL-E**: NFT artwork generation support

## Dependencies

- `@solana/web3.js`
- `@solana/spl-token`
- `@metaplex-foundation` libraries
- `@lightprotocol` (ZK compression)
- `@coingecko/sdk`

## Security Note

This toolkit handles private keys and transactions. Always ensure you're using it in a secure environment and never share your private keys.

## License

Apache-2.0
