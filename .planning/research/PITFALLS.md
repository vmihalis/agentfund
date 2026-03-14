# Domain Pitfalls

**Domain:** Autonomous multi-agent AI treasury system on Solana (hackathon, ~20 hours solo)
**Researched:** 2026-03-14
**Confidence:** MEDIUM (new/niche SDKs with limited public documentation; multi-agent architecture pitfalls well-documented)

---

## Critical Pitfalls

Mistakes that cause demo failures, bounty disqualification, or multi-hour rewrites.

### Pitfall 1: Integration Sprawl -- Trying to Deep-Integrate 7 SDKs in 20 Hours

**What goes wrong:** You attempt production-quality integration of Metaplex Agent Registry, x402/Corbits, Unbrowse, Meteora DLMM, ElevenLabs, Human Passport, and Solana Agent Kit simultaneously. Each SDK has its own setup ceremony, auth model, and error surface. Integration conflicts (especially between Umi's keypair model and @solana/web3.js's Keypair) eat hours. You end up with nothing working end-to-end.

**Why it happens:** The bounty structure ($11,400 across 7 bounties) incentivizes touching everything. Solo developers overestimate parallelization gains from Claude Code agents -- integration points between modules still require a single human brain.

**Consequences:** No working demo. Partial integrations that crash during judging. Judges see a dashboard of mock data instead of real on-chain actions.

**Prevention:**
1. Strictly tier the integrations: CORE (Metaplex Agent Registry + basic Solana transactions) must work first, before touching any bonus bounties
2. Set hard time-boxes: if an SDK isn't producing results in 90 minutes, stub it with a mock and move on
3. Build the demo flow (the 5-minute script) first with hardcoded data, then progressively replace stubs with real integrations
4. Accept that 5 solid integrations with real on-chain actions beat 7 half-broken ones

**Detection:** If by hour 8 you don't have at least 2 integrations working end-to-end with real transactions, you are in this trap.

**Phase:** Phase 1 (Foundation) -- establish core agent registration before any bonus integrations.

---

### Pitfall 2: Umi vs @solana/web3.js Keypair/Signer Incompatibility

**What goes wrong:** Metaplex Agent Registry requires the Umi framework, which has its own `KeypairSigner` type and `publicKey()` function. Meanwhile, Meteora DLMM, x402/Corbits, and raw Solana operations use `@solana/web3.js` `Keypair` and `PublicKey`. You end up with two parallel signing infrastructures, type errors everywhere, and transactions that fail because the wrong signer type was passed.

**Why it happens:** Umi wraps Solana primitives in its own type system for extensibility. The types look similar but are not interchangeable. `umi.identity` is not a `@solana/web3.js` `Keypair`. `publicKey()` from Umi is not `PublicKey` from web3.js.

**Consequences:** TypeScript compile errors that look trivial but take 30-60 minutes to resolve. Runtime failures where transactions are signed with the wrong key format. Silent failures where PDA derivation uses the wrong public key encoding.

**Prevention:**
1. Create a single `keys.ts` utility module that holds the raw secret key bytes and exports both Umi and web3.js signer objects from the same source
2. Never import `PublicKey` without qualifying which package it comes from
3. Use `fromWeb3JsKeypair()` and `toWeb3JsKeypair()` adapters from `@metaplex-foundation/umi-web3js-adapters` -- this package exists specifically for this problem
4. Test key conversion early: create a Umi signer, convert to web3.js Keypair, sign a transaction with each, verify both produce valid signatures

**Detection:** TypeScript errors involving `PublicKey` type mismatches, or transactions failing with "invalid signer" errors.

**Phase:** Phase 1 (Foundation) -- resolve before any on-chain operations begin.

**Sources:** [Metaplex Core SDK docs](https://metaplex.com/docs/smart-contracts/core/sdk/javascript), [Umi Getting Started](https://developers.metaplex.com/dev-tools/umi/getting-started)

---

### Pitfall 3: Solana Devnet Unreliability During Hackathon Peak Hours

**What goes wrong:** Solana devnet becomes congested or unstable. Faucet airdrops fail with 429 rate limits (max 1 airdrop per wallet per day, 5 SOL 2x per hour from web faucet). RPC endpoints timeout. Transactions land but confirmations are delayed. Your demo breaks live on stage because devnet is having a bad moment.

**Why it happens:** Hundreds of hackathon participants hit devnet simultaneously. The public RPC endpoint (`api.devnet.solana.com`) has aggressive rate limits. Devnet periodically resets or experiences outages that don't affect mainnet.

**Consequences:** Demo fails live. Transactions hang. Agent operations that worked in testing fail during judging. You waste hours debugging "your code" when the problem is the network.

**Prevention:**
1. Pre-fund ALL wallets (4 agent wallets + 1 deployer) with 10+ SOL each the night before the demo, not during the hackathon
2. Use a dedicated RPC provider (Helius, QuickNode, or Alchemy free tier) instead of the public endpoint -- they have devnet support with higher rate limits
3. Create mock/fallback transaction results so the demo can show the flow even if devnet is down: "Here's what the transaction would look like" with a pre-recorded Solscan link
4. For USDC on devnet: the standard USDC mint may not exist. You may need to create your own SPL token mint to simulate USDC. Plan for this.
5. Pre-create all Associated Token Accounts (ATAs) before the demo -- ATA creation requires additional SOL and can fail if accounts already exist

**Detection:** Airdrop failures, RPC timeouts, or transaction confirmation times exceeding 30 seconds.

**Phase:** Phase 1 (Foundation) -- fund wallets and validate RPC connectivity before writing any business logic.

**Sources:** [Solana Devnet Faucets Guide](https://solana.com/developers/guides/getstarted/solana-token-airdrop-and-faucets), [Metaplex Airdrop Guide](https://developers.metaplex.com/solana/airdrop-sol-for-development)

---

### Pitfall 4: Multi-Agent Coordination Collapse -- The "Bag of Agents" Anti-Pattern

**What goes wrong:** You build 4 independent agents (Scout, Analyzer, Treasury, Governance) that each work in isolation but have no reliable coordination protocol. When the Governance agent tries to orchestrate a funding decision, messages get lost, agents process out of order, context is dropped, and the system either loops forever or silently fails. Research shows multi-agent systems can consume 15x more tokens than single-agent approaches for the same task.

**Why it happens:** Building individual agents is straightforward. Coordination is the hard part. Common failures include: delegation errors (orchestrator routes to wrong agent), uncontrolled loops (agents trigger each other endlessly), validation gaps (bad output flows downstream unchecked), and role confusion (agents duplicate work or contradict each other).

**Consequences:** Demo shows agents doing individual tasks but failing to coordinate a complete funding decision. The core value prop ("autonomous agents that coordinate real funding decisions") is undermined.

**Prevention:**
1. Use a hub-and-spoke topology: Governance Agent is the sole orchestrator. Other agents ONLY respond to Governance, never to each other directly. This eliminates circular dependencies.
2. Define a strict message protocol with typed request/response schemas. Each agent accepts a specific input shape and returns a specific output shape.
3. Implement hard timeouts: if any agent doesn't respond in 10 seconds, Governance logs the failure and continues with a default/fallback.
4. For the demo, pre-script the happy path. The coordination should follow a deterministic sequence, not free-form agent negotiation.
5. Limit LLM reasoning to the Proposal Analyzer. Scout, Treasury, and Governance should be deterministic code with LLM-generated explanations, not LLM-driven decision-making.

**Detection:** Agents calling each other in circles, token usage spiking unexpectedly, or demo flow taking > 60 seconds for a single decision cycle.

**Phase:** Phase 2 (Agent Coordination) -- after individual agents are registered and functional.

**Sources:** [Why Multi-Agent Systems Fail (Towards Data Science)](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/), [Multi-Agent Architecture Design (O'Reilly)](https://www.oreilly.com/radar/designing-effective-multi-agent-architectures/)

---

### Pitfall 5: Metaplex Agent Registry Is New and Sparsely Documented

**What goes wrong:** `@metaplex-foundation/mpl-agent-registry` is a new package with limited public examples, tutorials, or Stack Overflow answers. You hit an error and there's no community knowledge to reference. The API may differ from what training data suggests. The `AgentIdentityV1` PDA derivation seeds may not match your assumptions.

**Why it happens:** The Metaplex Agent Registry launched recently (the `mpl-agent` repo was last updated Feb 2026). It's a hackathon-specific bounty target, meaning most developers haven't used it outside of hackathons. Documentation is authoritative but sparse.

**Consequences:** Hours spent reverse-engineering API behavior. PDA derivation errors that produce wrong addresses. Assets created without the required plugin. Registration appears to succeed but the agent identity isn't queryable.

**Prevention:**
1. Start by reading the ACTUAL npm package source code (node_modules/@metaplex-foundation/mpl-agent-registry) -- the generated TypeScript types are the most reliable documentation for new Metaplex packages
2. Look for example repositories from the Metaplex Foundation GitHub org -- they typically publish example code alongside new programs
3. Use `fetchAsset()` after every creation to verify the on-chain state matches expectations
4. The Agent Registry likely extends Metaplex Core (MPL Core NFTs with plugins). Understand Core first: `create()` an asset, add plugins, verify with `fetchAsset()`. Agent identity is a plugin/PDA on top of Core.
5. Join the Metaplex Discord and search for recent messages about agent registry -- hackathon participants are the primary user base right now

**Detection:** If the npm package README is less than 50 lines, or the API surface doesn't match any tutorial you find, you're in uncharted territory. Validate every operation by reading on-chain state.

**Phase:** Phase 1 (Foundation) -- this is the CORE bounty ($5,000). Get it right first.

**Sources:** [Metaplex Developer Hub](https://developers.metaplex.com/), [Solana Agent Registry](https://solana.com/agent-registry), [Metaplex Core SDK](https://metaplex.com/docs/smart-contracts/core/sdk/javascript)

---

## Moderate Pitfalls

### Pitfall 6: x402/Corbits Payment Flow Requires Pre-Existing Token Accounts and Funded Wallets

**What goes wrong:** You set up the Corbits wrapped `fetch()` for agent-to-agent payments, but transactions fail silently because the receiving agent doesn't have an Associated Token Account (ATA) for the payment token, or the paying agent has no SPL tokens (e.g., devnet USDC).

**Why it happens:** x402 payment flow: client requests -> server returns 402 + payment requirements -> client creates signed SPL transfer -> server verifies and serves content. This requires: (a) payer wallet funded with the correct SPL token, (b) receiver wallet has an ATA for that token, (c) correct mint address for the target network. On devnet, the standard USDC mint may not work -- you may need to create and distribute your own token.

**Prevention:**
1. Create a setup script that initializes ALL 4 agent wallets with: SOL for gas, your chosen SPL token, and pre-created ATAs
2. Use `lookupKnownSPLToken()` from Corbits to get the correct mint per network, but verify the result actually exists on devnet
3. If devnet USDC isn't available, create your own "DEMO_USDC" mint and distribute tokens to all agents during setup
4. Test the full payment cycle (402 response -> payment -> verification -> content delivery) between two agents before building the multi-agent flow
5. Use the simpler `@faremeter/rides` 3-line approach for rapid prototyping, fall back to exact payment only if you need custom behavior

**Detection:** 402 responses that never resolve, transaction simulation failures mentioning "account not found," or wallet balance unchanged after payment.

**Phase:** Phase 2 (Agent Coordination) -- after agents are registered, before full coordination flow.

**Sources:** [Corbits Exact Payment Docs](https://docs.corbits.dev/examples/solana/solana-exact-payment), [x402 on Solana Guide](https://solana.com/developers/guides/getstarted/intro-to-x402)

---

### Pitfall 7: Unbrowse First-Run Latency Kills the Demo Flow

**What goes wrong:** You trigger the Scout agent to "find grant proposals" during the demo. Unbrowse hits a site it hasn't seen before and takes 20-80 seconds to capture, index, and generate a skill. The demo stalls. Judges lose attention. The voice agent says "searching..." and then awkward silence.

**Why it happens:** Unbrowse auto-discovers APIs by intercepting browser network traffic. First-time discovery requires launching a headless browser, loading the page, capturing network requests, reverse-engineering the API, and caching a reusable skill. This is powerful but slow on first run.

**Prevention:**
1. Pre-warm Unbrowse before the demo: run the exact queries you'll use in the demo flow at least once so skills are cached in the marketplace
2. Have 2-3 pre-cached sites/skills ready for the demo. Don't rely on live discovery during judging.
3. If Unbrowse is down or slow, have a fallback: pre-fetched JSON data that the Scout agent can read from disk and present as "discovered" data
4. Keep the Unbrowse server running (localhost:6969) before the demo starts -- cold starts add latency
5. Avoid sites with heavy anti-bot protection (Reddit, LinkedIn) during demo -- they're unreliable with Unbrowse

**Detection:** Unbrowse responses taking > 10 seconds, skill generation failures, or Chrome/browser process crashes.

**Phase:** Phase 3 (Integrations) -- after core agent flow works.

**Sources:** [Unbrowse GitHub](https://github.com/unbrowse-ai/unbrowse)

---

### Pitfall 8: ElevenLabs Voice Agent Requires Dashboard Configuration, Not Just Code

**What goes wrong:** You write React code using `@elevenlabs/react` hooks, but the voice agent doesn't behave as expected -- it doesn't await tool responses, it ignores custom events, or it responds generically instead of using your system prompt. You debug the code for hours when the issue is in the ElevenLabs dashboard configuration.

**Why it happens:** ElevenLabs Agents Platform is a hybrid: some configuration lives in code (client tools, session management), but critical settings live in the ElevenLabs web dashboard (agent personality, server tools, event toggles, blocking behavior). If you configure a tool as a webhook/server tool, it must be marked as "blocking" in the dashboard UI for the agent to wait for the response. Client events must be explicitly enabled in the "Advanced" tab.

**Consequences:** Voice agent talks over tool responses, doesn't wait for Solana transaction confirmations, or doesn't trigger your custom tools at all.

**Prevention:**
1. Configure the ElevenLabs agent in the dashboard FIRST, before writing any React code. Set: system prompt, voice, tools, and event settings.
2. For tools that trigger on-chain actions: mark them as "blocking" in the dashboard so the agent waits for the response before speaking
3. If you have callbacks that aren't firing, check the "Advanced" tab to ensure the corresponding events are enabled for your agent
4. For hackathon demo reliability: use text-only mode as a fallback. Set the flag for no-audio mode so the demo works even if microphone access fails in the venue
5. Test voice interaction in the ElevenLabs playground (in-dashboard) before integrating with your React app

**Detection:** Agent speaks before tools return, custom events don't fire, or agent uses generic responses ignoring your system prompt.

**Phase:** Phase 3 (Integrations) -- after core agent flow works without voice.

**Sources:** [ElevenLabs React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react), [ElevenLabs Latency Optimization](https://elevenlabs.io/blog/how-do-you-optimize-latency-for-conversational-ai)

---

### Pitfall 9: Meteora DLMM Devnet Pool Availability and Bin Constraints

**What goes wrong:** You try to interact with DLMM pools on devnet but the pool you want doesn't exist, or you create a position spanning too many bins and the transaction fails. The DLMM SDK silently assumes mainnet unless you explicitly pass `{ cluster: "devnet" }`, causing lookups to fail with confusing errors.

**Why it happens:** Meteora's DLMM pools are primarily a mainnet product. Devnet may have limited or no pre-existing pools. Creating your own pool requires additional setup. The SDK has a 70-bin limit per position. Transaction size limits (1,232 bytes) can be hit when the position spans many bin arrays.

**Consequences:** Treasury Manager agent can't demonstrate yield optimization because there are no pools to interact with. Position creation transactions fail or silently produce no effect (known issue: transaction returns signature but balances unchanged).

**Prevention:**
1. Check devnet pool availability EARLY -- use `DLMM.create(connection, poolAddress, { cluster: "devnet" })` and verify it returns valid data
2. If no devnet pools exist, you may need to create one yourself. Budget 1-2 hours for this.
3. Limit positions to < 70 bins. Use a narrow range strategy for the demo.
4. After creating any position, call `refetchStates()` and verify balances on-chain -- don't trust the transaction receipt alone
5. Have a fallback: if DLMM is intractable on devnet, show the Treasury Manager doing basic SOL transfers + token swaps as "treasury management," with DLMM as a "future yield strategy" slide

**Detection:** `DLMM.create()` failing, empty pool state, or position transactions returning signatures without balance changes.

**Phase:** Phase 3 (Integrations) -- after core treasury operations (SOL transfers) work.

**Sources:** [Meteora DLMM SDK Functions](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions), [DLMM SDK GitHub Issue #234](https://github.com/MeteoraAg/dlmm-sdk/issues/234), [DeepWiki DLMM Setup](https://deepwiki.com/MeteoraAg/dlmm-sdk/3.1-installation-and-setup)

---

### Pitfall 10: Solana Transaction Size Limit (1,232 Bytes) Blocks Complex Operations

**What goes wrong:** You compose a transaction that registers an agent, creates an identity PDA, adds a plugin, and transfers tokens -- all in one transaction. It exceeds 1,232 bytes and fails with a cryptic "transaction too large" error. Or you use legacy transaction format instead of v0 with Address Lookup Tables, hitting account limits sooner.

**Why it happens:** Solana's MTU is 1,280 bytes (IPv6 minimum), leaving 1,232 for transaction data. Each account reference costs 32 bytes. Complex Metaplex operations + SPL token transfers + compute budget instructions stack up fast.

**Consequences:** Registration transactions fail. You waste time splitting operations into multiple transactions, managing sequential confirmation, and handling partial failures.

**Prevention:**
1. Never batch Metaplex agent registration with token operations in one transaction. Register agents in separate transactions from payment setup.
2. Use v0 transactions with Address Lookup Tables when referencing many accounts (Umi supports this)
3. Add `SetComputeUnitLimit` instructions proactively -- default 200K CU is often too low for Metaplex operations. Set to 400K-800K.
4. If a transaction fails with size errors, split it. Two small transactions that succeed beat one large one that fails.
5. Use "finalized" commitment level when operations depend on previous transaction results

**Detection:** Transaction failures mentioning size, serialization errors, or compute budget exceeded.

**Phase:** Phase 1 (Foundation) -- understand Solana constraints before building any multi-instruction flows.

**Sources:** [Solana Transaction Fundamentals](https://developers.metaplex.com/solana/solana-transaction-fundamentals), [Solana Transaction Size Discussion](https://github.com/solana-foundation/solana-improvement-documents/discussions/226)

---

## Minor Pitfalls

### Pitfall 11: Human Passport Embed Requires React and Wallet Connection

**What goes wrong:** You integrate Passport Embed expecting a simple "add script tag, get sybil score" experience. Instead, it requires a React component, wallet connection via Web3 provider, and API credentials from developer.passport.xyz. The default score threshold (20) may reject legitimate test users during demo.

**Prevention:**
1. Apply for API access at developer.passport.xyz BEFORE the hackathon starts
2. Passport Embed is React-native, which fits your Next.js stack. Just embed the component.
3. For demo purposes, lower the score threshold or use a pre-verified wallet that already has stamps
4. Test the full flow (connect wallet -> verify stamps -> get score -> gate access) end-to-end before demo day

**Phase:** Phase 4 (Polish) -- this is the EASY bounty ($1,200). Don't spend more than 30-45 minutes.

**Sources:** [Human Passport Docs](https://docs.human.tech/tech/human-passport), [Passport Embed Introduction](https://docs.passport.xyz/building-with-passport/embed/introduction)

---

### Pitfall 12: Parallel Claude Code Agents Create Merge Conflicts and Inconsistent Interfaces

**What goes wrong:** You spawn 3 Claude Code agents to build Scout, Analyzer, and Treasury Manager simultaneously. Each agent defines its own types, imports, and file structure. When you integrate, the types don't align, imports conflict, and the shared state model is inconsistent.

**Prevention:**
1. Define shared types and interfaces in a single `types/` directory BEFORE spawning parallel agents
2. Define the inter-agent message protocol (input/output shapes) upfront in a shared schema
3. Have each agent work in its own directory (`agents/scout/`, `agents/analyzer/`, etc.) with a clearly defined API boundary
4. Integration is sequential, not parallel. After individual modules are built, a single agent (or you) handles integration.
5. Use coarse parallelization (2-3 agents max simultaneously), not fine-grained (4+ agents on interconnected modules)

**Phase:** All phases -- architectural discipline from the start.

---

### Pitfall 13: Demo Audio Fails at the Venue

**What goes wrong:** ElevenLabs voice interaction requires microphone access. The hackathon venue has background noise, browser blocks microphone without HTTPS, or the presentation laptop's audio settings aren't configured for the demo.

**Prevention:**
1. Implement a text-input fallback for every voice command. The dashboard should accept typed commands that trigger the same agent actions.
2. Test microphone access on the actual demo device before judging
3. If presenting from localhost, use Chrome flags or a self-signed cert to enable microphone access
4. Pre-record a backup video of the voice interaction working, in case live audio fails
5. ElevenLabs supports text-only mode -- configure it as a fallback

**Phase:** Phase 4 (Polish) -- test on actual demo hardware.

---

### Pitfall 14: Unbrowse Mutation Safety Blocks Scout Actions

**What goes wrong:** Unbrowse treats non-GET requests as potentially unsafe mutations and requires explicit `confirm_unsafe: true` or `dry_run: true` flags. If your Scout agent tries to submit a form or POST to an API without these flags, Unbrowse blocks the action silently or returns an error.

**Prevention:**
1. For hackathon demo, Scout should ONLY read (GET) data. Don't have it submit anything.
2. If you need POST/mutation operations, explicitly set `confirm_unsafe: true` in the skill call
3. Test each Unbrowse interaction in isolation before wiring it to the Scout agent

**Phase:** Phase 3 (Integrations).

**Sources:** [Unbrowse GitHub](https://github.com/unbrowse-ai/unbrowse)

---

### Pitfall 15: Forgetting to Show REAL On-Chain Actions

**What goes wrong:** You build a beautiful dashboard that shows agent activity, proposals, and treasury data -- but it's all read from a local database or mock data. Judges specifically want "agents that take real actions." Your demo shows charts and text but no Solscan links, no actual transaction signatures, no on-chain proof.

**Prevention:**
1. Every agent action should produce a transaction signature that links to Solscan devnet
2. Display transaction signatures in the UI with clickable links
3. The demo script should include at least 3 verifiable on-chain actions: agent registration, token transfer, and one more (LP position, payment, etc.)
4. Pre-execute some transactions and have their Solscan links ready as backup evidence

**Phase:** Phase 2 (Agent Coordination) onward -- every on-chain action should be observable.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Foundation (Agent Registration) | Umi/web3.js signer incompatibility (#2), Agent Registry sparse docs (#5) | Build key utility module first; read npm source code |
| Foundation (Wallet Setup) | Devnet unreliability (#3), missing token accounts (#6) | Pre-fund night before; use dedicated RPC; create setup script |
| Agent Coordination | Bag-of-agents collapse (#4), transaction size limits (#10) | Hub-and-spoke topology; separate transactions |
| Integrations (Unbrowse) | First-run latency (#7), mutation blocking (#14) | Pre-warm skills; GET-only operations |
| Integrations (Meteora) | No devnet pools (#9), bin constraints (#9) | Verify pool availability early; have fallback |
| Integrations (ElevenLabs) | Dashboard vs code config mismatch (#8), venue audio (#13) | Configure dashboard first; text fallback |
| Integrations (x402) | Token account/funding prerequisites (#6) | Setup script; test full 402 cycle early |
| Polish (Passport) | API access delay (#11) | Apply for access before hackathon |
| Polish (Demo) | No real on-chain proof (#15), integration sprawl (#1) | Transaction links in UI; time-box integrations |
| All Phases | Parallel agent merge conflicts (#12) | Shared types first; coarse parallelization |

---

## Hackathon-Specific Meta-Pitfalls

### The "Works on My Machine" Demo
**What goes wrong:** Everything works on your dev laptop but fails on the presentation setup. Different Node version, missing env vars, Chrome profile differences for Unbrowse, or the ElevenLabs API key is in a local `.env` that isn't on the demo machine.
**Prevention:** Use a single `.env.example` with all required vars documented. Test the full startup sequence (`npm install && npm run setup && npm run dev`) on a clean environment at least once before demo.

### The "Just One More Feature" Trap
**What goes wrong:** At hour 16, the core flow works. You decide to add one more integration. It breaks something that was working. You spend the last 4 hours debugging the new thing instead of polishing the demo.
**Prevention:** Feature freeze at hour 14. Last 6 hours are for integration testing, demo rehearsal, and polish. The extra bounty ($500-$1,200) isn't worth risking the core bounties ($5,000 + $1,200).

### Time Budget Recommendation
| Activity | Hours | Notes |
|----------|-------|-------|
| Foundation (wallets, keys, agent registration) | 4 | Include devnet funding, RPC setup |
| Agent coordination (hub-and-spoke, message protocol) | 4 | Governance orchestrator + 1 agent end-to-end |
| Deep integrations (Unbrowse + Meteora) | 4 | Time-boxed, fallbacks ready |
| Bonus integrations (ElevenLabs + Passport) | 3 | Dashboard config + embed component |
| Frontend dashboard | 2 | Show real transaction links |
| Demo prep + polish | 3 | Rehearsal, pre-warm Unbrowse, backup video |
| **Total** | **20** | |

---

## Sources

- [Metaplex Developer Hub](https://developers.metaplex.com/)
- [Metaplex Core SDK JavaScript](https://metaplex.com/docs/smart-contracts/core/sdk/javascript)
- [Solana Agent Registry](https://solana.com/agent-registry)
- [Umi Getting Started](https://developers.metaplex.com/dev-tools/umi/getting-started)
- [Corbits Exact Payment Docs](https://docs.corbits.dev/examples/solana/solana-exact-payment)
- [x402 on Solana Guide](https://solana.com/developers/guides/getstarted/intro-to-x402)
- [x402 Protocol](https://www.x402.org/)
- [Unbrowse GitHub](https://github.com/unbrowse-ai/unbrowse)
- [Meteora DLMM SDK Docs](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions)
- [Meteora DLMM SDK GitHub Issue #234](https://github.com/MeteoraAg/dlmm-sdk/issues/234)
- [DeepWiki DLMM Setup](https://deepwiki.com/MeteoraAg/dlmm-sdk/3.1-installation-and-setup)
- [ElevenLabs Agents Platform](https://elevenlabs.io/docs/agents-platform/overview)
- [ElevenLabs Latency Optimization](https://elevenlabs.io/blog/how-do-you-optimize-latency-for-conversational-ai)
- [Human Passport Docs](https://docs.human.tech/tech/human-passport)
- [Passport Embed](https://docs.passport.xyz/building-with-passport/embed/introduction)
- [Solana Devnet Faucets](https://solana.com/developers/guides/getstarted/solana-token-airdrop-and-faucets)
- [Solana Transaction Fundamentals](https://developers.metaplex.com/solana/solana-transaction-fundamentals)
- [Why Multi-Agent Systems Fail (Towards Data Science)](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- [Multi-Agent Architecture Design (O'Reilly)](https://www.oreilly.com/radar/designing-effective-multi-agent-architectures/)
- [How to Build Solana AI Agents (Alchemy)](https://www.alchemy.com/blog/how-to-build-solana-ai-agents-in-2026)
