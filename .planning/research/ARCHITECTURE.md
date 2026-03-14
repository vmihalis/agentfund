# Architecture Patterns

**Domain:** Autonomous multi-agent AI treasury system on Solana
**Researched:** 2026-03-14

## Recommended Architecture

AgentFund is a **coordinator-pattern multi-agent system** with four specialized AI agents, a shared event bus for inter-agent communication, on-chain identity via Metaplex, economic coordination via x402 micropayments, and a Next.js frontend as the human interface. The Governance Agent acts as the coordinator/router, while Scout, Proposal Analyzer, and Treasury Manager are specialist workers.

### System Architecture Overview

```
+------------------------------------------------------------------+
|                      NEXT.JS FRONTEND                            |
|  +-------------------+  +------------------+  +---------------+  |
|  | Voice Command     |  | Dashboard        |  | Proposal      |  |
|  | (ElevenLabs React |  | (Agent Activity, |  | Submission    |  |
|  |  useConversation) |  |  Treasury, TXs)  |  | (Passport     |  |
|  +--------+----------+  +--------+---------+  |  Embed Gate)  |  |
|           |                      |             +-------+-------+  |
+-----------+----------------------+-----------------+---+----------+
            |                      |                 |   |
     voice commands          WebSocket/REST      score   |
            |                      |             check   |
+===========v======================v=================v===v==========+
|                     BACKEND ORCHESTRATION LAYER                   |
|                     (Node.js / Express or tRPC)                   |
|                                                                   |
|  +-----------------------+                                        |
|  |   EVENT BUS           |   Node.js EventEmitter or simple      |
|  |   (In-Process)        |   pub/sub -- NOT Kafka/Redis.          |
|  |                       |   Hackathon-appropriate simplicity.    |
|  +-----------+-----------+                                        |
|              |                                                    |
|   +----------+----------+----------+----------+                   |
|   |          |          |          |          |                   |
|   v          v          v          v          |                   |
| +------+ +--------+ +--------+ +----------+  |                   |
| |GOVERN| |SCOUT   | |PROPOSAL| |TREASURY  |  |                   |
| |ANCE  | |AGENT   | |ANALYZER| |MANAGER   |  |                   |
| |AGENT | |        | |        | |          |  |                   |
| +--+---+ +---+----+ +---+----+ +----+-----+  |                   |
|    |         |           |           |        |                   |
+====|=========|===========|===========|========+===================+
     |         |           |           |
     |    +----+----+  +---+---+  +----+-------+
     |    |Unbrowse |  |Claude |  |Meteora     |
     |    |API      |  |API    |  |DLMM SDK    |
     |    |:6969    |  |       |  |            |
     |    +---------+  +-------+  +----+-------+
     |                                 |
     +---+-----------------------------+
         |
+========v=================================================+
|                   SOLANA DEVNET                           |
|                                                          |
|  +------------------+  +-------------------+             |
|  | Metaplex Agent   |  | SPL Token         |             |
|  | Identity Registry|  | (USDC transfers)  |             |
|  | (4 Agent NFTs +  |  |                   |             |
|  |  AgentIdentityV1 |  +-------------------+             |
|  |  PDAs)           |                                    |
|  +------------------+  +-------------------+             |
|                        | Meteora DLMM      |             |
|  +------------------+  | (LP Positions)    |             |
|  | x402 Payment     |  |                   |             |
|  | Verification     |  +-------------------+             |
|  +------------------+                                    |
+=========================================================+
```

### Component Boundaries

| Component | Responsibility | Communicates With | External Dependencies |
|-----------|---------------|-------------------|----------------------|
| **Governance Agent** | Coordinates multi-agent decisions, routes voice commands, manages workflow state, interfaces with humans via ElevenLabs | All other agents (via event bus), ElevenLabs WebSocket, Frontend | Claude API, ElevenLabs API |
| **Scout Agent** | Discovers grant proposals and web data, monitors funding opportunities | Governance Agent (reports findings), Event Bus | Unbrowse API (localhost:6969) |
| **Proposal Analyzer** | Evaluates proposals using LLM reasoning, scores feasibility, explains decisions | Governance Agent (receives tasks, returns analysis), Event Bus | Claude API (@anthropic-ai/sdk) |
| **Treasury Manager** | Manages on-chain funds, executes transfers, manages Meteora LP positions, tracks balances | Governance Agent (receives execution orders), Solana devnet | Meteora DLMM SDK, @solana/web3.js, SPL Token |
| **Event Bus** | Routes messages between agents, maintains message log for dashboard | All agents, Frontend (via WebSocket for real-time updates) | None (in-process) |
| **Next.js Frontend** | Dashboard display, voice interface, proposal submission with sybil gate | Backend API, ElevenLabs React SDK, Passport Embed | ElevenLabs React, Passport Embed |
| **Metaplex Identity Layer** | On-chain agent registration, identity verification | All agents (registration at startup), Solana devnet | @metaplex-foundation/mpl-agent-registry, Umi |
| **x402 Payment Layer** | Inter-agent micropayments, pay-per-service model | All agents (wrapped fetch for paid endpoints) | @faremeter/payment-solana, @faremeter/fetch |

## Data Flow

### Primary Data Flow: Proposal Discovery to Funding

```
1. Human (voice) -> "Scout, find grant proposals"
   |
   v
2. ElevenLabs WebSocket -> Governance Agent
   |  (ASR transcription -> intent extraction)
   v
3. Governance Agent -> Event Bus -> SCOUT_TASK event
   |
   v
4. Scout Agent -> Unbrowse API (localhost:6969)
   |  POST /v1/intent/resolve
   |  { intent: "find grant proposals", url: "https://..." }
   |
   v
5. Scout Agent -> Event Bus -> PROPOSALS_FOUND event
   |  (proposals array with metadata)
   |
   v
6. Governance Agent -> Event Bus -> ANALYZE_PROPOSAL event
   |
   v
7. Proposal Analyzer -> Claude API
   |  (structured prompt with proposal data, scoring rubric)
   |
   v
8. Proposal Analyzer -> Event Bus -> ANALYSIS_COMPLETE event
   |  (score, reasoning, recommendation)
   |
   v
9. Governance Agent -> Event Bus -> FUND_DECISION event
   |  (if score > threshold, initiate funding)
   |
   v
10. Treasury Manager -> Solana devnet
    |  (SPL token transfer to proposal recipient)
    |
    v
11. Treasury Manager -> Event Bus -> FUNDING_COMPLETE event
    |  (transaction signature, amount, recipient)
    |
    v
12. Governance Agent -> ElevenLabs TTS -> Human
    "Funded [project] with [amount] USDC. Transaction: [sig]"
```

### Secondary Data Flow: Treasury Yield Management

```
1. Treasury Manager (periodic / on-command)
   |
   v
2. Check idle USDC balance on Solana devnet
   |
   v
3. If balance > threshold:
   |  Meteora DLMM SDK:
   |  - DLMM.create(connection, poolAddress)
   |  - pool.initializePositionAndAddLiquidityByStrategy({
   |      strategy: { strategyType: StrategyType.SpotBalanced, ... }
   |    })
   |
   v
4. Event Bus -> LP_POSITION_OPENED event
   |  (pool address, position keypair, amounts, bin range)
   |
   v
5. Dashboard updates via WebSocket
```

### Tertiary Data Flow: x402 Agent-to-Agent Payments

```
1. Scout Agent needs to call Proposal Analyzer's evaluation endpoint
   |
   v
2. Scout uses wrapFetch (Corbits SDK):
   |  const handler = createPaymentHandler(scoutWallet, usdcMint, connection);
   |  const fetchWithPayer = wrap(fetch, { handlers: [handler] });
   |
   v
3. fetchWithPayer("http://localhost:3002/analyze")
   |  -> First call: 402 Payment Required (returns price in USDC)
   |  -> SDK auto-creates SPL transfer TX, signs with Scout keypair
   |  -> Retries with X-Payment header
   |
   v
4. Proposal Analyzer's x402 server verifies payment on-chain
   |  -> Responds 200 with analysis results
   |
   v
5. On-chain USDC transfer from Scout -> Analyzer recorded on devnet
```

### Agent Registration Flow (Startup)

```
1. For each of 4 agents:
   |
   v
2. Create MPL Core NFT asset (agent's on-chain identity)
   |  - Name: "AgentFund Scout" / "AgentFund Analyzer" / etc.
   |  - Collection: AgentFund collection
   |
   v
3. Register agent identity via mpl-agent-registry:
   |  await registerIdentityV1(umi, {
   |    asset: agentAssetPublicKey,
   |    collection: agentFundCollectionPublicKey,
   |  }).sendAndConfirm(umi);
   |
   v
4. Derive and store AgentIdentityV1 PDA:
   |  PDA seeds: ["agent_identity", <asset_pubkey>]
   |  -> 40-byte account (key, bump, padding, asset reference)
   |
   v
5. AppData external plugin added to MPL Core asset
   |  -> PDA is data authority (tamper-evident binding)
   |
   v
6. Agent operational with on-chain identity
```

## Patterns to Follow

### Pattern 1: Coordinator Agent with Event Bus

**What:** The Governance Agent acts as the central coordinator. It receives all human commands (via ElevenLabs), decomposes them into tasks, dispatches to specialist agents via the event bus, collects results, and synthesizes responses.

**When:** This is the primary coordination pattern. Every multi-agent workflow flows through Governance.

**Why:** For a 4-agent system with clear role separation, the coordinator pattern is simpler and more debuggable than peer-to-peer. Agents do not need to know about each other -- they publish events and the coordinator routes.

**Example:**

```typescript
// Event Bus -- simple typed EventEmitter
import { EventEmitter } from 'events';

interface AgentEvent {
  id: string;
  type: string;
  source: 'governance' | 'scout' | 'analyzer' | 'treasury';
  timestamp: number;
  payload: unknown;
}

class AgentEventBus extends EventEmitter {
  private log: AgentEvent[] = [];

  publish(event: AgentEvent): void {
    this.log.push(event);
    this.emit(event.type, event);
    this.emit('*', event); // wildcard for dashboard
  }

  getLog(): AgentEvent[] {
    return this.log;
  }
}

// Governance Agent subscribes and routes
eventBus.on('PROPOSALS_FOUND', (event) => {
  // Route each proposal to analyzer
  for (const proposal of event.payload.proposals) {
    eventBus.publish({
      id: crypto.randomUUID(),
      type: 'ANALYZE_PROPOSAL',
      source: 'governance',
      timestamp: Date.now(),
      payload: { proposal },
    });
  }
});
```

### Pattern 2: Agent as Class with Wallet + Tools

**What:** Each agent is a TypeScript class that encapsulates its Solana keypair, its tools (Unbrowse, Claude, Meteora), and its event subscriptions. Agents are instantiated at startup, registered on-chain, and then listen for events.

**When:** Agent initialization and lifecycle management.

**Example:**

```typescript
abstract class BaseAgent {
  readonly name: string;
  readonly keypair: Keypair;
  readonly publicKey: PublicKey;
  protected eventBus: AgentEventBus;
  protected connection: Connection;

  // Metaplex identity
  assetPublicKey?: PublicKey;
  identityPda?: PublicKey;

  constructor(
    name: string,
    keypair: Keypair,
    eventBus: AgentEventBus,
    connection: Connection,
  ) {
    this.name = name;
    this.keypair = keypair;
    this.publicKey = keypair.publicKey;
    this.eventBus = eventBus;
    this.connection = connection;
  }

  abstract registerEventHandlers(): void;
  abstract getTools(): Record<string, Function>;
}

class ScoutAgent extends BaseAgent {
  private unbrowseUrl = 'http://localhost:6969';

  registerEventHandlers(): void {
    this.eventBus.on('SCOUT_TASK', async (event) => {
      const proposals = await this.discoverProposals(event.payload.query);
      this.eventBus.publish({
        id: crypto.randomUUID(),
        type: 'PROPOSALS_FOUND',
        source: 'scout',
        timestamp: Date.now(),
        payload: { proposals },
      });
    });
  }

  private async discoverProposals(query: string) {
    const res = await fetch(`${this.unbrowseUrl}/v1/intent/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: query,
        params: { url: 'https://grants.example.com' },
      }),
    });
    return res.json();
  }

  getTools() {
    return { discoverProposals: this.discoverProposals.bind(this) };
  }
}
```

### Pattern 3: x402 Wrapped Endpoints for Inter-Agent Economy

**What:** Each agent exposes its capabilities as x402-gated HTTP endpoints. When agents need to consume each other's services, they use `wrapFetch` from Corbits SDK which automatically handles the 402 payment flow.

**When:** Demonstrating the agent-to-agent economy for the Metaplex and Solana bounties.

**Why:** This creates verifiable on-chain payment trails showing agents paying each other, which is the core demo requirement. The wrapped fetch pattern means agents call each other's APIs just like normal HTTP calls -- the payment is transparent.

**Example:**

```typescript
// Proposal Analyzer exposes a paid endpoint
app.post('/analyze', async (req, res) => {
  const xPayment = req.header('X-Payment');
  if (!xPayment) {
    return res.status(402).json({
      payment: {
        recipientWallet: analyzerWallet.toBase58(),
        tokenAccount: analyzerTokenAccount.toBase58(),
        mint: USDC_MINT.toBase58(),
        amount: 100, // 0.0001 USDC per analysis
        cluster: 'devnet',
      },
    });
  }
  // Verify payment, then analyze...
  const analysis = await analyzeWithClaude(req.body.proposal);
  return res.json({ analysis });
});

// Scout agent calls analyzer with auto-payment
const analyzerFetch = wrap(fetch, {
  handlers: [createPaymentHandler(scoutWallet, usdcMint, connection)],
});
const result = await analyzerFetch('http://localhost:3002/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ proposal: discoveredProposal }),
});
```

### Pattern 4: ElevenLabs as Voice-First Human Interface

**What:** The ElevenLabs Agents Platform handles the full voice pipeline (ASR -> LLM -> TTS) via WebSocket. The Governance Agent is configured as an ElevenLabs agent with client tools that trigger backend actions.

**When:** All human-agent interaction flows through voice.

**Why:** ElevenLabs handles turn-taking, transcription, and synthesis. Client tools bridge voice commands to backend agent actions without custom NLU.

**Example:**

```typescript
// Next.js frontend -- voice command center
import { useConversation } from '@elevenlabs/react';

function VoiceCommandCenter() {
  const conversation = useConversation({
    onMessage: (message) => {
      // Display in chat transcript
      addToTranscript(message);
    },
  });

  const startSession = async () => {
    const signedUrl = await fetch('/api/elevenlabs/signed-url').then(r => r.json());
    await conversation.startSession({
      signedUrl: signedUrl.url,
      clientTools: {
        findProposals: async ({ query }) => {
          const res = await fetch('/api/agents/scout', {
            method: 'POST',
            body: JSON.stringify({ action: 'discover', query }),
          });
          return await res.json();
        },
        analyzeProposal: async ({ proposalId }) => {
          const res = await fetch('/api/agents/analyzer', {
            method: 'POST',
            body: JSON.stringify({ action: 'analyze', proposalId }),
          });
          return await res.json();
        },
        fundProject: async ({ proposalId, amount }) => {
          const res = await fetch('/api/agents/treasury', {
            method: 'POST',
            body: JSON.stringify({ action: 'fund', proposalId, amount }),
          });
          return await res.json();
        },
      },
    });
  };

  return (
    <button onClick={startSession}>Start Voice Command</button>
  );
}
```

### Pattern 5: Umi-Based Registration (Separate from @solana/web3.js)

**What:** Metaplex operations use the Umi framework, which has a different keypair and transaction model from @solana/web3.js. Keep Umi operations isolated in a registration module; all other Solana operations use standard web3.js.

**When:** Agent registration at startup only. Do not mix Umi into runtime agent operations.

**Why:** Umi and web3.js have incompatible PublicKey/Keypair types. Mixing them causes type errors and confusion. Isolate Umi to a `registerAgents()` function that runs once at startup.

**Example:**

```typescript
// registration/metaplex.ts -- Umi-only module
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplAgentIdentity } from '@metaplex-foundation/mpl-agent-registry';
import { registerIdentityV1, findAgentIdentityV1Pda } from '@metaplex-foundation/mpl-agent-registry';
import { createV1, mplCore } from '@metaplex-foundation/mpl-core';

export async function registerAgentOnChain(
  agentName: string,
  collectionAddress: string,
  rpcUrl: string,
  keypairBytes: Uint8Array,
): Promise<{ assetAddress: string; pdaAddress: string }> {
  const umi = createUmi(rpcUrl)
    .use(mplAgentIdentity())
    .use(mplCore());

  // Convert web3.js keypair to Umi signer
  const signer = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
  umi.use(keypairIdentity(signer));

  // Create MPL Core asset for this agent
  const asset = generateSigner(umi);
  await createV1(umi, {
    asset,
    name: agentName,
    uri: `https://agentfund.app/metadata/${agentName}.json`,
    collection: publicKey(collectionAddress),
  }).sendAndConfirm(umi);

  // Register agent identity
  await registerIdentityV1(umi, {
    asset: asset.publicKey,
    collection: publicKey(collectionAddress),
  }).sendAndConfirm(umi);

  const pda = findAgentIdentityV1Pda(umi, { asset: asset.publicKey });

  return {
    assetAddress: asset.publicKey.toString(),
    pdaAddress: pda.toString(),
  };
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Agent-to-Agent Function Calls

**What:** Agents importing and calling each other's methods directly.
**Why bad:** Creates tight coupling, makes it impossible to show x402 payments between agents, breaks the demo narrative of independent economic actors.
**Instead:** Agents communicate via the event bus for coordination and via x402 HTTP endpoints for paid services.

### Anti-Pattern 2: Mixing Umi and web3.js Throughout

**What:** Using Umi keypairs, transactions, and PublicKey types alongside @solana/web3.js equivalents in the same modules.
**Why bad:** Type incompatibility causes runtime errors. Umi's `PublicKey` is not the same as `@solana/web3.js`'s `PublicKey`. Debug time multiplies.
**Instead:** Isolate all Umi operations to a single `registration/` module. All runtime operations use standard @solana/web3.js.

### Anti-Pattern 3: Complex Message Queue Infrastructure

**What:** Using Redis, RabbitMQ, or Kafka for inter-agent communication.
**Why bad:** Massive setup overhead for a hackathon. 4 agents in a single Node.js process can use a typed EventEmitter. External message queues add deployment complexity, latency, and debugging overhead for zero benefit at this scale.
**Instead:** Use Node.js EventEmitter wrapped in a typed AgentEventBus class. Add WebSocket forwarding for dashboard real-time updates.

### Anti-Pattern 4: Autonomous Agent Loops Without Guardrails

**What:** Letting agents operate in fully autonomous loops that spend treasury funds without any confirmation.
**Why bad:** For a demo, uncontrolled spending is a bad look. Judges want to see coordination and reasoning, not runaway bots. On devnet this is low-risk but demonstrates poor design thinking.
**Instead:** Governance Agent requires confirmation for funding decisions above a threshold. Voice confirmation: "I recommend funding [project] for [amount]. Shall I proceed?"

### Anti-Pattern 5: Single Monolithic Agent

**What:** Building one "super agent" that does everything instead of 4 specialized agents.
**Why bad:** Misses the entire bounty narrative. Judges want to see multi-agent coordination, clear role separation, and agents paying each other.
**Instead:** Each agent has a clear boundary, its own keypair, its own on-chain identity, and its own x402 endpoints.

## Component Dependency Graph and Build Order

```
LAYER 0 (Foundation -- no dependencies, build first):
  [Solana Connection + Keypairs]
  [Event Bus]
  [Metaplex Agent Registration Module (Umi)]

LAYER 1 (Agent Shells -- depends on Layer 0):
  [BaseAgent class with keypair + event bus]
  [x402 Server/Client wrappers]

LAYER 2 (Individual Agents -- depends on Layer 1, can build in parallel):
  [Scout Agent + Unbrowse integration]
  [Proposal Analyzer + Claude integration]
  [Treasury Manager + Meteora DLMM integration]
  [Governance Agent + routing logic]

LAYER 3 (Integration -- depends on Layer 2):
  [Agent-to-agent x402 payment flows]
  [Multi-agent workflow orchestration]

LAYER 4 (Frontend -- depends on Layer 3 for APIs):
  [Next.js Dashboard]
  [ElevenLabs Voice Command Center]
  [Human Passport Embed gate]

LAYER 5 (Polish -- depends on Layer 4):
  [Frontier Tower context / RAG]
  [Demo script rehearsal]
```

### Build Order Rationale

1. **Layer 0 first** because every agent needs a Solana connection, a keypair, and event bus access. The Metaplex registration is isolated (Umi) and can be built as a standalone utility.

2. **Layer 1 second** because the BaseAgent class defines the interface that all 4 agents implement. The x402 wrapper is reusable infrastructure.

3. **Layer 2 is parallelizable** -- each agent is independent once BaseAgent exists. A solo developer with 2-3 parallel Claude Code sessions can build Scout, Analyzer, and Treasury Manager simultaneously. Governance depends conceptually on knowing the other agents' event types but can be built with stubs.

4. **Layer 3 is integration** -- this is where agents talk to each other via x402 and where the Governance Agent orchestrates real multi-step workflows. This cannot be fully parallelized.

5. **Layer 4 is frontend** -- the Next.js dashboard consumes backend APIs. ElevenLabs integration is configured partly in the ElevenLabs dashboard (agent setup, tools, system prompt) and partly in React code.

6. **Layer 5 is stretch** -- Frontier Tower context is low-prize ($500) and can be a simple RAG endpoint. Demo polish happens last.

## Module Structure (Recommended)

```
agentfund/
  src/
    agents/
      base-agent.ts          # Abstract BaseAgent class
      scout/
        scout-agent.ts       # ScoutAgent class
        unbrowse-client.ts   # Unbrowse API wrapper
      analyzer/
        analyzer-agent.ts    # ProposalAnalyzerAgent class
        claude-evaluator.ts  # Claude API evaluation logic
      treasury/
        treasury-agent.ts    # TreasuryManagerAgent class
        meteora-client.ts    # Meteora DLMM wrapper
      governance/
        governance-agent.ts  # GovernanceAgent class (coordinator)
        workflow-engine.ts   # Multi-step workflow state machine

    event-bus/
      event-bus.ts           # Typed EventEmitter wrapper
      event-types.ts         # All event type definitions

    registration/
      metaplex.ts            # Umi-only agent registration
      collection.ts          # Create AgentFund collection

    x402/
      server.ts              # x402 payment verification middleware
      client.ts              # wrapFetch utilities per agent

    api/
      routes.ts              # Express/Next.js API routes
      websocket.ts           # WebSocket for dashboard real-time

    config/
      agents.ts              # Agent keypairs, addresses, config
      solana.ts              # Connection, USDC mint, cluster

  app/                       # Next.js App Router
    page.tsx                 # Dashboard
    voice/page.tsx           # Voice command center
    proposals/page.tsx       # Proposal submission + Passport gate
    api/
      agents/[agent]/route.ts  # Agent action endpoints
      elevenlabs/
        signed-url/route.ts    # ElevenLabs signed URL generation

  scripts/
    register-agents.ts       # One-time agent registration script
    fund-agents.ts           # Devnet faucet + USDC distribution
```

## Communication Protocol Summary

| From | To | Mechanism | Purpose |
|------|----|-----------|---------|
| Human | Governance | ElevenLabs WebSocket (voice) | Voice commands |
| Human | Frontend | Browser | Dashboard interaction |
| Human | Passport Embed | React widget | Sybil verification for proposals |
| Governance | Scout | Event Bus (`SCOUT_TASK`) | Task dispatch |
| Governance | Analyzer | Event Bus (`ANALYZE_PROPOSAL`) | Task dispatch |
| Governance | Treasury | Event Bus (`FUND_PROJECT`) | Execution orders |
| Scout | Governance | Event Bus (`PROPOSALS_FOUND`) | Results |
| Analyzer | Governance | Event Bus (`ANALYSIS_COMPLETE`) | Results |
| Treasury | Governance | Event Bus (`FUNDING_COMPLETE`) | Confirmations |
| Scout | Analyzer | x402 HTTP (`/analyze`) | Paid service call (demo) |
| Scout | Unbrowse | HTTP (`localhost:6969`) | Web data discovery |
| Analyzer | Claude | HTTPS API | LLM evaluation |
| Treasury | Meteora | Solana TX (DLMM SDK) | LP management |
| Treasury | Solana | Solana TX (SPL Token) | Fund transfers |
| All Agents | Metaplex | Solana TX (Umi, startup) | Identity registration |
| Backend | Frontend | WebSocket | Real-time dashboard updates |
| Frontend | Backend | REST/tRPC | Agent actions, data queries |

## Scalability Considerations

| Concern | Hackathon (4 agents) | Production (10+ agents) | Notes |
|---------|---------------------|------------------------|-------|
| Agent communication | In-process EventEmitter | Redis pub/sub or NATS | EventEmitter is fine for single-process demo |
| State management | In-memory arrays/maps | PostgreSQL + event sourcing | For hackathon, agent state lives in memory |
| Solana transactions | Sequential, devnet | Batched, priority fees, mainnet | Devnet has no congestion concerns |
| x402 payments | Direct HTTP on localhost | Facilitator pattern, retry logic | Localhost eliminates network latency |
| LLM calls | Direct Claude API calls | Queue with rate limiting | Anthropic rate limits are generous for demo |
| Dashboard updates | Single WebSocket | Socket.io rooms or SSE | Single-user demo needs only one connection |

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Coordination pattern | Coordinator (Governance Agent) | 4 agents is small enough for centralized coordination. Simpler than peer-to-peer. Clearer demo narrative. |
| Inter-agent comms | Event Bus (EventEmitter) + x402 HTTP | Event bus for free coordination; x402 for paid services (bounty requirement). Dual-channel shows both patterns. |
| Umi isolation | Separate registration module | Umi/web3.js type incompatibility is a known pitfall. One clean boundary prevents it. |
| Voice architecture | ElevenLabs client tools -> backend API | ElevenLabs handles ASR/TTS/turn-taking. Client tools bridge to backend. No custom NLU needed. |
| Sybil gate | Passport Embed (frontend-only for demo) | 15-minute integration. Frontend `isPassing` check gates proposal UI. Server-side verification is stretch. |
| Treasury on-chain | Meteora DLMM with SpotBalanced strategy | SpotBalanced is the simplest strategy. Demonstrates real LP management without complex bin math. |
| Monorepo vs separate | Single Next.js project with src/ modules | Solo dev, 20 hours. One repo, one deploy, one `npm install`. |

## Sources

- [Metaplex Agent Registry docs](https://github.com/metaplex-foundation/mpl-agent) - Agent identity PDA structure, registration flow (HIGH confidence, from project docs)
- [x402 Protocol on Solana](https://solana.com/developers/guides/getstarted/intro-to-x402) - Payment flow, Corbits SDK wrapped fetch pattern (HIGH confidence, official Solana docs)
- [Chainstack x402 Architecture](https://chainstack.com/x402-protocol-for-ai-agents/) - Three-party architecture: client, resource server, facilitator (MEDIUM confidence)
- [Meteora DLMM SDK docs](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions) - Pool creation, liquidity strategies, position management (HIGH confidence, official docs)
- [ElevenLabs Agents Platform](https://elevenlabs.io/docs/agents-platform/libraries/react) - React SDK, useConversation, client tools, WebSocket API (HIGH confidence, official docs)
- [Unbrowse API](https://www.unbrowse.ai/skill.md) - Intent resolution, localhost:6969, skill marketplace (HIGH confidence, from project docs)
- [Human Passport Embed](https://docs.passport.xyz/building-with-passport/embed/component-reference) - PassportScoreWidget props, usePassportScore hook (HIGH confidence, official docs)
- [Alchemy: How to Build Solana AI Agents](https://www.alchemy.com/blog/how-to-build-solana-ai-agents-in-2026) - Three-layer architecture, ReAct pattern, dual-key wallets (MEDIUM confidence)
- [arXiv: Autonomous Agents on Blockchains](https://arxiv.org/html/2601.04583v1) - Execution models, trust boundaries, defense-in-depth (MEDIUM confidence, academic)
- [DEV.to Multi-Agent Systems Guide](https://dev.to/eira-wexford/how-to-build-multi-agent-systems-complete-2026-guide-1io6) - Coordinator pattern, 3-7 agents per workflow, state management (MEDIUM confidence)
- [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) - Plugin architecture, LangChain integration, DeFi tools (HIGH confidence, from project docs)
