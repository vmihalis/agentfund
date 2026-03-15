# x402 Protocol Documentation (Solana)

> Source: [solana.com/developers/guides/getstarted/intro-to-x402](https://solana.com/developers/guides/getstarted/intro-to-x402)
> Corbits SDK docs: [docs.corbits.dev](https://docs.corbits.dev)
> Protocol spec: [x402.org](https://x402.org)

## Overview

x402 is an open protocol for internet-native payments implementing the HTTP 402 Payment Required pattern. On Solana, clients submit small transfers that servers verify on-chain before serving protected content. It supports all SPL tokens and offers low transaction costs (fractions of a cent) with instant settlement.

## Installation

```bash
npm install @faremeter/payment-solana @faremeter/fetch @faremeter/info @solana/web3.js
```

## Protocol Flow

1. Client requests a protected endpoint
2. Server responds with `402 Payment Required` status and payment requirements
3. Client creates and signs a transfer transaction
4. Client resubmits request with `X-PAYMENT` header containing serialized transaction (base64-encoded JSON)
5. Server verifies, submits transaction to blockchain, and confirms on-chain
6. Upon confirmation, server responds with `200 OK` and content

## Payment Header Format

```typescript
const paymentProof = {
  x402Version: 1,
  scheme: "exact",
  network: "solana-mainnet", // or "solana-devnet"
  payload: {
    serializedTransaction: "<base64-encoded-transaction>"
  }
};

const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString("base64");
// Set as X-Payment header
```

## Use Cases

- **AI/Agents**: Pay per LLM inference, image generation, or model API access
- **Content**: Paywalled articles, video/audio streaming, premium newsletters
- **Developer Services**: API metering, per-RPC call pricing, serverless functions
- **Data**: Real-time market feeds, analytics reports, IoT sensor data
- **Gaming**: Server access, mod downloads, tournament entries

## Client Implementation (Corbits SDK)

### Using `@faremeter/payment-solana` with Wrapped Fetch

```typescript
import {
  Keypair,
  PublicKey,
  VersionedTransaction,
  Connection
} from "@solana/web3.js";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";
import { wrap } from "@faremeter/fetch";
import { lookupKnownSPLToken } from "@faremeter/info/solana";
import * as fs from "fs";

// Load wallet
const keypairData = JSON.parse(fs.readFileSync("./payer-wallet.json", "utf-8"));
const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

// Configure
const network = "mainnet-beta";
const connection = new Connection("https://api.mainnet.solana.com");
const usdcInfo = lookupKnownSPLToken(network, "USDC");
const usdcMint = new PublicKey(usdcInfo.address);

// Create wallet adapter
const wallet = {
  network,
  publicKey: keypair.publicKey,
  updateTransaction: async (tx: VersionedTransaction) => {
    tx.sign([keypair]);
    return tx;
  }
};

// Create payment handler and wrap fetch
const handler = createPaymentHandler(wallet, usdcMint, connection);
const fetchWithPayer = wrap(fetch, { handlers: [handler] });

// Make a paid request (payment handled automatically)
const response = await fetchWithPayer("https://helius.api.corbits.dev", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "getBlockHeight"
  })
});

const data = await response.json();
console.log(data);
```

### Key SDK Functions

| Function | Package | Description |
|----------|---------|-------------|
| `createPaymentHandler(wallet, mint, connection)` | `@faremeter/payment-solana/exact` | Creates a handler for standard EOA wallets (Phantom, etc.) |
| `wrap(fetch, { handlers })` | `@faremeter/fetch` | Wraps native fetch to auto-handle 402 responses |
| `lookupKnownSPLToken(network, symbol)` | `@faremeter/info/solana` | Looks up known token info (address, decimals) by symbol |

### Wallet Adapter Interface

```typescript
interface WalletAdapter {
  network: string;                           // "mainnet-beta" | "devnet"
  publicKey: PublicKey;                      // Wallet public key
  updateTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>; // Sign tx
}
```

### Smart Wallet Support

For smart wallets (Crossmint, Squads) that use account abstraction, use the settlement scheme:

```bash
npm install @faremeter/x-solana-settlement
```

## Server Implementation (Express + USDC)

```typescript
import express from "express";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const RECIPIENT_WALLET = new PublicKey("seFkxFkXEY9JGEpCyPfCWTuPZG9WK6ucf95zvKCfsRX");
const RECIPIENT_TOKEN_ACCOUNT = await getAssociatedTokenAddress(USDC_MINT, RECIPIENT_WALLET);
const PRICE_USDC = 100; // 0.0001 USDC (in smallest units)

const app = express();
app.use(express.json());

app.get("/premium", async (req, res) => {
  const xPaymentHeader = req.header("X-Payment");

  if (xPaymentHeader) {
    try {
      // Decode payment proof
      const paymentData = JSON.parse(
        Buffer.from(xPaymentHeader, "base64").toString("utf-8")
      );

      // Deserialize and verify transaction
      const txBuffer = Buffer.from(
        paymentData.payload.serializedTransaction, "base64"
      );
      const tx = Transaction.from(txBuffer);

      // Validate transfer instructions target correct recipient and amount
      let validTransfer = false;
      for (const ix of tx.instructions) {
        if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
          if (ix.data.length >= 9 && ix.data[0] === 3) {
            const transferAmount = Number(ix.data.readBigUInt64LE(1));
            if (ix.keys.length >= 2) {
              const destAccount = ix.keys[1].pubkey;
              if (destAccount.equals(RECIPIENT_TOKEN_ACCOUNT) && transferAmount >= PRICE_USDC) {
                validTransfer = true;
                break;
              }
            }
          }
        }
      }

      if (!validTransfer) {
        return res.status(402).json({ error: "Invalid transfer" });
      }

      // Simulate then submit transaction
      const simulation = await connection.simulateTransaction(tx);
      if (simulation.value.err) {
        return res.status(402).json({ error: "Simulation failed" });
      }

      const signature = await connection.sendRawTransaction(txBuffer, {
        skipPreflight: false,
        preflightCommitment: "confirmed"
      });

      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) {
        return res.status(402).json({ error: "Transaction failed" });
      }

      return res.json({
        data: "Premium content - USDC payment verified!",
        paymentDetails: { signature, amount: PRICE_USDC }
      });
    } catch (e) {
      return res.status(402).json({ error: "Payment verification failed" });
    }
  }

  // No payment header: return payment requirements (402)
  return res.status(402).json({
    payment: {
      recipientWallet: RECIPIENT_WALLET.toBase58(),
      tokenAccount: RECIPIENT_TOKEN_ACCOUNT.toBase58(),
      mint: USDC_MINT.toBase58(),
      amount: PRICE_USDC,
      amountUSDC: PRICE_USDC / 1000000,
      cluster: "devnet",
      message: "Send USDC to the token account"
    }
  });
});

app.listen(3001, () => console.log("x402 USDC server listening on :3001"));
```

## Client Implementation (Native, No SDK)

```typescript
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  getAccount
} from "@solana/spl-token";
import fetch from "node-fetch";
import { readFileSync } from "fs";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const keypairData = JSON.parse(readFileSync("./client.json", "utf-8"));
const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

async function run() {
  // Step 1: Get payment quote
  const quote = await fetch("http://localhost:3001/premium");
  const q = await quote.json();
  if (quote.status !== 402) throw new Error("Expected 402 quote");

  const recipientTokenAccount = new PublicKey(q.payment.tokenAccount);
  const mint = new PublicKey(q.payment.mint);
  const amount = q.payment.amount;

  // Step 2: Get payer's token account
  const payerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, payer.publicKey
  );

  // Step 3: Build transfer transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight });

  const transferIx = createTransferInstruction(
    payerTokenAccount.address,
    recipientTokenAccount,
    payer.publicKey,
    amount
  );
  tx.add(transferIx);
  tx.sign(payer);

  // Step 4: Send payment proof
  const paymentProof = {
    x402Version: 1,
    scheme: "exact",
    network: "solana-devnet",
    payload: { serializedTransaction: tx.serialize().toString("base64") }
  };

  const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString("base64");

  const paid = await fetch("http://localhost:3001/premium", {
    headers: { "X-Payment": xPaymentHeader }
  });

  const result = await paid.json();
  console.log(result);
}

run().catch(console.error);
```

## Available SDKs

| SDK | Solana Support | Purpose |
|-----|----------------|---------|
| Corbits (`@faremeter/*`) | Yes | Solana-first SDK for rapid x402 implementation |
| Coinbase | Yes | Reference protocol implementation |
| MCPay.tech | Yes | Micropayments for MCP servers |
| PayAI Facilitator | Yes | Transaction fee handling |
| ACK | In PR | Agent Commerce Kit with verifiable identity |
| A2A x402 (Google) | In development | Agent-to-agent payment flows |
| Crossmint | In development | All-in-one crypto rails |

## Running the Example

```bash
git clone https://github.com/Woody4618/x402-solana-examples
npm install

# Terminal 1: Start server
npm run usdc:server

# Terminal 2: Run client (requires devnet USDC)
npm run usdc:client
```

## Production Recommendations

- Return JWT tokens after payment for temporary reuse access
- Store credentials in environment variables, not code
- Consider using a facilitator to abstract blockchain complexity
- The example code is not audited and is for demonstration purposes only
