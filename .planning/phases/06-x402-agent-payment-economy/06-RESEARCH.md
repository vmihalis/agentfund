# Phase 6: x402 Agent Payment Economy - Research

**Researched:** 2026-03-14
**Domain:** x402 payment protocol, HTTP 402 micropayments, Solana SPL token transfers, Express middleware
**Confidence:** HIGH

## Summary

The x402 protocol revives the HTTP 402 "Payment Required" status code to enable machine-to-machine micropayments over standard HTTP. Launched by Coinbase in May 2025 and updated to V2 in December 2025, x402 defines a simple flow: server responds with 402 + payment requirements, client creates/signs a payment transaction, client retries with an `X-Payment` header containing the signed transaction, server verifies and submits on-chain, server returns the gated content.

This project already has all Solana primitives needed (@solana/web3.js v1, @solana/spl-token, devnet USDC, agent keypairs, ATAs). The official @x402/svm SDK depends on @solana/kit (web3.js v2), which conflicts with this project's existing v1 stack. Rather than introducing a compatibility layer, the recommended approach is to implement the x402 protocol natively -- the protocol is deliberately simple and the project already has SPL transfer infrastructure (TreasuryAgent's executeFunding proves the pattern). Express is a well-known framework that requires minimal new code. The native implementation matches the pattern documented in Solana's official x402 developer guide.

**Primary recommendation:** Implement x402 natively with Express + existing @solana/web3.js v1 stack. Each agent exposes an HTTP server with x402 middleware. The Governance Agent's wrapFetch client creates SPL transfers, encodes them as X-Payment headers, and retries on 402.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-01 | x402 micropayment flow between agents (402 response -> payment -> content) | Native x402 protocol implementation with Express middleware; flow is: 402 response with payment JSON -> client creates SPL transfer -> client sends X-Payment header -> server verifies on-chain -> server returns content |
| PAY-02 | At least one agent-to-agent x402 payment with real on-chain USDC transfer on devnet | Uses existing devnet USDC (4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU), agent keypairs, and SPL transfer via @solana/spl-token -- same pattern as TreasuryAgent.executeFunding |
| PAY-03 | x402 server middleware gating agent service endpoints (returns 402 with payment requirements) | Express middleware that checks for X-Payment header; returns 402 JSON with recipientWallet, tokenAccount, mint, amount when missing |
| PAY-04 | x402 client wrapper (wrapFetch) enabling agents to automatically pay for peer services | Fetch wrapper that detects 402 responses, creates SPL transfer transactions, signs them, encodes as base64 X-Payment header, retries request |
| SCOUT-04 | Scout exposes x402-gated endpoint for paid data discovery services | Express HTTP server wrapping ScoutAgent.discoverProposals behind x402 middleware |
| ANLZ-04 | Analyzer exposes x402-gated endpoint for paid evaluation services | Express HTTP server wrapping AnalyzerAgent.evaluateProposal behind x402 middleware |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.21 | HTTP server for agent endpoints | Most mature Node.js HTTP framework; x402 examples all use Express |
| @solana/web3.js | ^1.98.4 | Already installed; Solana RPC, transactions, keypairs | Project standard -- avoids @solana/kit v2 conflict |
| @solana/spl-token | ^0.4.14 | Already installed; SPL token transfers for USDC payments | Project standard -- createTransferInstruction, getAssociatedTokenAddress |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/express | ^5.0 | TypeScript types for Express | Required for strict TypeScript compilation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native x402 impl | @x402/express + @x402/svm + @x402/fetch | Official SDK requires @solana/kit (web3.js v2) which conflicts with project's v1 stack; would need compat layer; adds 3+ packages vs 1 (express) |
| Native x402 impl | x402-solana (PayAI) | Community package, built on web3.js v1, but less tested and adds unnecessary abstraction for this project's needs |
| Express | Hono or Fastify | Express is simpler, more examples exist, and agents only need 1-2 routes each |

**Installation:**
```bash
pnpm add express @types/express
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    x402/
      middleware.ts     # Express middleware for x402 payment gating
      client.ts         # wrapFetch utility for automatic 402 payment
      types.ts          # PaymentRequirements, PaymentProof types
      verify.ts         # Transaction verification logic
  agents/
    scout-agent.ts      # Existing (unchanged)
    analyzer-agent.ts   # Existing (unchanged)
  servers/
    scout-server.ts     # Express app wrapping ScoutAgent with x402 middleware
    analyzer-server.ts  # Express app wrapping AnalyzerAgent with x402 middleware
```

### Pattern 1: x402 Server Middleware
**What:** Express middleware that intercepts requests without valid X-Payment headers and returns 402 with payment requirements. Passes through requests with valid verified payments.
**When to use:** On every agent HTTP endpoint that should be paid.
**Example:**
```typescript
// Source: Adapted from solana.com x402 developer guide
import { Request, Response, NextFunction } from 'express';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';

interface X402Config {
  recipientWallet: PublicKey;
  usdcMint: PublicKey;
  priceUsdc: number;  // In base units (1 USDC = 1_000_000)
  connection: Connection;
  cluster: 'devnet' | 'mainnet-beta';
}

export function x402Middleware(config: X402Config) {
  const recipientAta = getAssociatedTokenAddressSync(config.usdcMint, config.recipientWallet);

  return async (req: Request, res: Response, next: NextFunction) => {
    const xPayment = req.header('X-Payment');

    if (!xPayment) {
      // Return 402 with payment requirements
      return res.status(402).json({
        x402Version: 1,
        scheme: 'exact',
        network: `solana-${config.cluster}`,
        payment: {
          recipientWallet: config.recipientWallet.toBase58(),
          tokenAccount: recipientAta.toBase58(),
          mint: config.usdcMint.toBase58(),
          amount: config.priceUsdc,
          amountUSDC: config.priceUsdc / 1_000_000,
        },
      });
    }

    // Verify payment, submit tx, call next() on success
    // ... (see verify.ts pattern)
  };
}
```

### Pattern 2: x402 Client (wrapFetch)
**What:** A fetch wrapper that detects 402 responses, automatically creates an SPL transfer transaction, signs it, and retries with the X-Payment header.
**When to use:** When any agent needs to call another agent's paid endpoint.
**Example:**
```typescript
// Source: Adapted from solana.com x402 developer guide + project patterns
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';

interface WrapFetchOptions {
  keypair: Keypair;
  connection: Connection;
  usdcMint: PublicKey;
  maxPaymentUsdc?: number; // Safety cap in base units
}

export function wrapFetchWithPayment(
  baseFetch: typeof fetch,
  options: WrapFetchOptions,
): typeof fetch {
  return async (input, init?) => {
    const response = await baseFetch(input, init);

    if (response.status !== 402) return response;

    // Parse payment requirements from 402 response
    const requirements = await response.json();
    const { tokenAccount, amount } = requirements.payment;

    // Safety check
    if (options.maxPaymentUsdc && amount > options.maxPaymentUsdc) {
      throw new Error(`Payment ${amount} exceeds max ${options.maxPaymentUsdc}`);
    }

    // Build SPL transfer transaction
    const payerAta = getAssociatedTokenAddressSync(
      options.usdcMint,
      options.keypair.publicKey,
    );
    const destAta = new PublicKey(tokenAccount);
    const { blockhash, lastValidBlockHeight } =
      await options.connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: options.keypair.publicKey,
      blockhash,
      lastValidBlockHeight,
    });

    tx.add(
      createTransferInstruction(payerAta, destAta, options.keypair.publicKey, amount),
    );

    tx.sign(options.keypair);

    // Encode as X-Payment header
    const paymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: {
        serializedTransaction: tx.serialize().toString('base64'),
      },
    };

    const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

    // Retry with payment
    return baseFetch(input, {
      ...init,
      headers: {
        ...((init?.headers as Record<string, string>) ?? {}),
        'X-Payment': xPaymentHeader,
      },
    });
  };
}
```

### Pattern 3: Agent Server Wrapping Existing Agent Logic
**What:** Each agent that exposes paid services runs a small Express server that delegates to the existing agent class. The agent class itself is unchanged.
**When to use:** For Scout (SCOUT-04) and Analyzer (ANLZ-04).
**Example:**
```typescript
// scout-server.ts
import express from 'express';
import { ScoutAgent } from '../agents/scout-agent.js';
import { TypedEventBus } from '../events/event-bus.js';
import { x402Middleware } from '../lib/x402/middleware.js';

const bus = new TypedEventBus();
const scout = new ScoutAgent(bus);
await scout.initialize();

const app = express();
app.use(express.json());

app.get('/discover', x402Middleware({ /* config */ }), async (req, res) => {
  const query = req.query.q as string ?? 'solana grants';
  const proposals = await scout.discoverProposals(query);
  res.json({ proposals });
});

app.listen(4001);
```

### Anti-Patterns to Avoid
- **Modifying BaseAgent or existing agent classes for HTTP concerns:** Keep HTTP server logic in separate server files. Agents stay pure domain logic.
- **Using the official @x402/svm SDK with this project:** It depends on @solana/kit (web3.js v2), creating a dependency conflict. The protocol is simple enough to implement natively.
- **Sharing a single Express server for all agents:** Each agent should run its own server on its own port. This matches the x402 model of each service having its own payment address and price.
- **Sending the payment client-side and then telling the server the signature:** In x402, the client signs but does NOT submit. The server receives the serialized signed transaction, verifies it, and submits it. This gives the server control over settlement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP server framework | Custom HTTP handler with Node http module | Express | Middleware pattern, body parsing, routing all built-in |
| SPL token transfers | Raw instruction building from scratch | @solana/spl-token createTransferInstruction | Already in project; handles instruction encoding correctly |
| ATA derivation | Manual PDA derivation for token accounts | @solana/spl-token getAssociatedTokenAddressSync | Deterministic derivation with standard seed; already used in project |
| Transaction serialization | Custom binary encoding | @solana/web3.js Transaction.serialize() | Standard Solana transaction format |
| JSON body parsing | Manual request body concatenation | express.json() middleware | Handles content-type, size limits, error cases |

**Key insight:** The x402 protocol is intentionally simple -- it is just HTTP status codes + headers + standard blockchain transactions. The complexity is in the Solana primitives (SPL transfers, transaction verification), which this project already has.

## Common Pitfalls

### Pitfall 1: Transaction Replay
**What goes wrong:** A client could replay the same signed transaction to get free access after the first payment.
**Why it happens:** Solana rejects duplicate signatures, so a replayed serialized tx would fail on-chain. But if the server only verifies the transaction structure without submitting, the client could use the same signed tx multiple times.
**How to avoid:** Always submit the transaction on-chain as part of verification. The server should: (1) verify transfer instruction, (2) simulate, (3) submit, (4) confirm, then (5) serve content. Solana's duplicate signature rejection handles replay.
**Warning signs:** Server verifying transaction structure but not actually submitting it.

### Pitfall 2: Blockhash Expiration
**What goes wrong:** The signed transaction in X-Payment header has an expired blockhash by the time the server tries to submit.
**Why it happens:** Solana blockhashes expire after ~60 seconds. If the client-server roundtrip is slow or the client pre-signs transactions, blockhash may be stale.
**How to avoid:** Client should fetch a fresh blockhash immediately before signing. Server should submit promptly. For devnet with ~400ms finality, this is rarely an issue in practice.
**Warning signs:** "Blockhash not found" errors on transaction submission.

### Pitfall 3: Missing Token Accounts
**What goes wrong:** The recipient token account (ATA) doesn't exist yet, so the SPL transfer fails.
**Why it happens:** ATAs are created lazily. If the server agent's ATA for USDC was never created, the transfer instruction will fail.
**How to avoid:** Ensure all agent ATAs are created during the fund-wallets setup script (Phase 1 already does this). Verify ATAs exist in the x402 middleware initialization.
**Warning signs:** "Account not found" errors during transaction simulation.

### Pitfall 4: USDC Decimal Confusion
**What goes wrong:** Charging 1 USDC instead of 0.001 USDC (or vice versa) because of decimal handling.
**Why it happens:** USDC on Solana has 6 decimals. 1 USDC = 1_000_000 base units.
**How to avoid:** Define prices in base units internally (e.g., 1000 = 0.001 USDC). Only convert to human-readable format in the 402 response JSON. The project already uses this pattern in token-accounts.ts.
**Warning signs:** Unexpectedly large or small payments.

### Pitfall 5: Port Conflicts
**What goes wrong:** Multiple agent servers try to bind the same port.
**Why it happens:** Each agent needs its own Express server on a unique port.
**How to avoid:** Define a clear port mapping: Scout = 4001, Analyzer = 4002. Use environment variables for port configuration.
**Warning signs:** "EADDRINUSE" errors on startup.

### Pitfall 6: Server Not Waiting for Confirmation
**What goes wrong:** Server returns content before the transaction is confirmed on-chain.
**Why it happens:** sendRawTransaction is async; it submits but doesn't wait for confirmation.
**How to avoid:** Always await `connection.confirmTransaction(signature, 'confirmed')` before returning the 200 response with content. On devnet this typically takes 400ms-2s.
**Warning signs:** Transaction submitted but not visible on Solscan when demo is shown.

## Code Examples

Verified patterns from official sources and project codebase:

### Transaction Verification (Server-Side)
```typescript
// Source: solana.com/developers/guides/getstarted/intro-to-x402
import { Connection, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface VerifyResult {
  valid: boolean;
  signature?: string;
  error?: string;
}

export async function verifyAndSettlePayment(
  connection: Connection,
  serializedTx: string,
  expectedRecipientAta: string,
  expectedMinAmount: number,
): Promise<VerifyResult> {
  const txBuffer = Buffer.from(serializedTx, 'base64');
  const tx = Transaction.from(txBuffer);

  // 1. Verify SPL token transfer instruction
  let validTransfer = false;
  for (const ix of tx.instructions) {
    if (ix.programId.equals(TOKEN_PROGRAM_ID) && ix.data.length >= 9 && ix.data[0] === 3) {
      const amount = Number(ix.data.readBigUInt64LE(1));
      const dest = ix.keys[1]?.pubkey.toBase58();
      if (dest === expectedRecipientAta && amount >= expectedMinAmount) {
        validTransfer = true;
        break;
      }
    }
  }

  if (!validTransfer) {
    return { valid: false, error: 'Invalid transfer instruction' };
  }

  // 2. Simulate
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    return { valid: false, error: `Simulation failed: ${JSON.stringify(sim.value.err)}` };
  }

  // 3. Submit
  const signature = await connection.sendRawTransaction(txBuffer, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  // 4. Confirm
  const conf = await connection.confirmTransaction(signature, 'confirmed');
  if (conf.value.err) {
    return { valid: false, error: 'Transaction failed on-chain' };
  }

  return { valid: true, signature };
}
```

### Existing SPL Transfer Pattern (from TreasuryAgent)
```typescript
// Source: src/agents/treasury-agent.ts (already in project)
import { transfer, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';

// This pattern is proven to work on devnet in this project:
const sourceAta = await getOrCreateAssociatedTokenAccount(conn, keypair, usdcMint, publicKey);
const destAta = await getOrCreateAssociatedTokenAccount(conn, keypair, usdcMint, recipientPubkey);
const signature = await transfer(conn, keypair, sourceAta.address, destAta.address, keypair, amountBaseUnits);
```

### Express Server with x402 Middleware (Complete)
```typescript
// Source: Synthesized from solana.com guide + project patterns
import express from 'express';
import { getConnection } from '../lib/solana/index.js';
import { getWeb3Keypair } from '../lib/keys.js';
import { DEVNET_USDC_MINT } from '../lib/solana/index.js';
import { x402Middleware } from '../lib/x402/middleware.js';

const app = express();
app.use(express.json());

const scoutKeypair = getWeb3Keypair('scout');
const connection = getConnection();

// Scout discovery endpoint -- costs 0.001 USDC (1000 base units)
app.get('/discover',
  x402Middleware({
    recipientWallet: scoutKeypair.publicKey,
    usdcMint: DEVNET_USDC_MINT,
    priceUsdc: 1000,  // 0.001 USDC
    connection,
    cluster: 'devnet',
  }),
  async (req, res) => {
    const query = (req.query.q as string) ?? 'solana grants';
    // ... call scout.discoverProposals(query)
    res.json({ proposals: [] });
  },
);

app.listen(4001, () => console.log('Scout x402 server on :4001'));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom payment headers | x402 protocol V1 (X-Payment header, base64 JSON) | May 2025 | Standardized 402 payment flow across all chains |
| x402 V1 | x402 V2 (CAIP-2 network IDs, multi-chain) | Dec 2025 | Network-agnostic payment format, but V1 still works |
| @solana/web3.js v1 | @solana/kit (formerly web3.js v2) | 2025 | Official x402 SDK uses kit; but v1 is fine for native impl |
| Self-hosted facilitator | x402.org/facilitator (free tier) | 2025 | Optional hosted verification/settlement service |

**Key note:** x402 V2 adds CAIP-2 network identifiers and multi-chain support, but the core 402->pay->retry flow is identical to V1. For this hackathon, V1-style native implementation is sufficient. The facilitator service is optional -- servers can self-verify transactions (which this implementation does).

## Open Questions

1. **USDC Balance for Paying Agents**
   - What we know: Agent wallets were funded in Phase 1 (fund-wallets script). USDC comes from either Circle devnet faucet or custom DEMO_USDC mint.
   - What's unclear: Whether the governance agent (which will be calling Scout/Analyzer via wrapFetch) has enough USDC balance for multiple demo payments.
   - Recommendation: Check during initialization. The fund-wallets script may need a re-run or the demo script should ensure sufficient balance. Prices should be tiny (0.001 USDC = 1000 base units).

2. **Agent Server Lifecycle**
   - What we know: Agents currently run as in-process objects instantiated by GovernanceAgent.
   - What's unclear: How to start/stop HTTP servers for the demo. Do we run them as separate processes or start them within a single orchestrator?
   - Recommendation: Create a simple script (e.g., `start-servers.ts`) that starts both Scout and Analyzer Express servers. The GovernanceAgent's wrapFetch then calls these servers over HTTP instead of calling agent methods directly.

3. **GovernanceAgent Integration**
   - What we know: Currently GovernanceAgent calls scout.discoverProposals() and analyzer.evaluateProposal() directly via TypeScript method calls.
   - What's unclear: Whether GovernanceAgent should switch to HTTP calls via wrapFetch for the demo, or whether direct calls and HTTP/x402 calls coexist.
   - Recommendation: Create an x402-aware adapter that implements IScoutAgent and IAnalyzerAgent but calls the HTTP endpoints via wrapFetch. GovernanceAgent can then use either the direct agent or the x402 adapter.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test -- tests/unit/x402` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | x402 middleware returns 402 with payment requirements when no X-Payment header present | unit | `pnpm test -- tests/unit/x402-middleware.test.ts -x` | No - Wave 0 |
| PAY-02 | On-chain USDC transfer produced by x402 payment flow | integration | `pnpm test -- tests/integration/x402-payment.test.ts -x` | No - Wave 0 |
| PAY-03 | Server middleware gates endpoints and verifies SPL transfer transactions | unit | `pnpm test -- tests/unit/x402-middleware.test.ts -x` | No - Wave 0 |
| PAY-04 | wrapFetch detects 402, creates SPL transfer, retries with X-Payment header | unit | `pnpm test -- tests/unit/x402-client.test.ts -x` | No - Wave 0 |
| SCOUT-04 | Scout Express server responds to /discover with x402 gating | unit | `pnpm test -- tests/unit/scout-server.test.ts -x` | No - Wave 0 |
| ANLZ-04 | Analyzer Express server responds to /evaluate with x402 gating | unit | `pnpm test -- tests/unit/analyzer-server.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- tests/unit/x402`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/x402-middleware.test.ts` -- covers PAY-01, PAY-03
- [ ] `tests/unit/x402-client.test.ts` -- covers PAY-04
- [ ] `tests/unit/scout-server.test.ts` -- covers SCOUT-04
- [ ] `tests/unit/analyzer-server.test.ts` -- covers ANLZ-04
- [ ] `tests/integration/x402-payment.test.ts` -- covers PAY-02 (requires devnet)
- [ ] Framework install: `pnpm add express @types/express` -- Express is not yet a dependency

## Sources

### Primary (HIGH confidence)
- [Solana x402 Developer Guide](https://solana.com/developers/guides/getstarted/intro-to-x402) - Complete native Solana x402 implementation with Express server and client, includes devnet USDC address, transaction verification pattern
- [x402 Official Documentation](https://docs.x402.org/getting-started/quickstart-for-sellers) - Server middleware configuration, CAIP-2 network identifiers, ExactSvmScheme registration, facilitator URL
- [Coinbase x402 GitHub](https://github.com/coinbase/x402) - Official monorepo: @x402/core, @x402/svm, @x402/express, @x402/fetch packages; confirms @solana/kit dependency
- [x402 Official Documentation - Buyers](https://docs.x402.org/getting-started/quickstart-for-buyers) - wrapFetchWithPayment API, x402Client registration, SVM signer setup
- Project codebase: src/agents/treasury-agent.ts - Proven SPL transfer pattern using @solana/web3.js v1 + @solana/spl-token

### Secondary (MEDIUM confidence)
- [Coinbase x402 Product Page](https://www.coinbase.com/developer-platform/products/x402) - Protocol overview, V2 announcement, ecosystem metrics
- [x402 Facilitator Docs](https://docs.cdp.coinbase.com/x402/core-concepts/facilitator) - Facilitator is optional; servers can self-verify
- [Corbits Faremeter Facilitator](https://docs.corbits.dev/faremeter/about-x402/facilitators) - Alternative facilitator at facilitator.corbits.dev; supports Solana

### Tertiary (LOW confidence)
- [Chainstack x402 Solana Guide](https://chainstack.com/x402-on-solana-developer-guide-micro-payments/) - Telegram bot example using @x402/svm (content truncated, partial verification)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Express is the standard, @solana/web3.js v1 is already proven in this project, native x402 implementation follows official Solana guide
- Architecture: HIGH - Server/client pattern is well-documented across multiple official sources; adapter pattern for GovernanceAgent follows existing project conventions (IScoutAgent/IAnalyzerAgent interfaces)
- Pitfalls: HIGH - Transaction verification, blockhash expiration, ATA requirements are well-documented Solana concerns; decimal handling already solved in project

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (x402 protocol is stable post-V2; Solana SPL primitives are mature)
