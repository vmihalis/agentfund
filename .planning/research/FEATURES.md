# Feature Landscape

**Domain:** Autonomous multi-agent AI treasury system on Solana (hackathon project)
**Researched:** 2026-03-14
**Hackathon:** Intelligence at the Frontier / Funding the Commons SF (March 14-15, 2026)
**Track:** Agentic Funding & Coordination

## Table Stakes

Features judges and bounty sponsors expect. Missing = bounty disqualified or project dismissed.

### Bounty-Critical Table Stakes

| Feature | Why Expected | Complexity | Bounty Alignment | Notes |
|---------|--------------|------------|-------------------|-------|
| 4 on-chain agent identities via Metaplex Core | $5K Metaplex bounty requires agents registered on-chain with MPL Core NFT + AgentIdentityV1 PDA | **HIGH** | Metaplex $5K | Each agent (Scout, Analyzer, Treasury, Governance) must be a minted Core NFT with an AgentIdentityV1 plugin. This is the highest-value bounty -- must work flawlessly |
| Agent-to-agent x402 micropayments | Demonstrates agents paying each other for services via HTTP 402 flow. Core to the "agent economy" narrative | **MEDIUM** | Solana $1.2K | Use Corbits/Faremeter SDK (`@faremeter/payment-solana`). Wrapped fetch pattern: agent hits another agent's endpoint, gets 402, pays USDC, retries with X-PAYMENT header |
| Scout agent web data discovery via Unbrowse | $1.5K Unbrowse bounty requires using their API at localhost:6969 for web data retrieval | **MEDIUM** | Unbrowse $1.5K | POST to `/v1/intent/resolve` with natural language intent. Unbrowse reverse-engineers APIs from browser traffic, returns structured data. Must show Scout actually finding real grant proposals |
| Treasury Manager LP positions on Meteora DLMM | $1K Meteora bounty requires actual DLMM position management on devnet | **MEDIUM** | Meteora $1K | Use `@meteora-ag/dlmm` SDK. Key ops: `initializePositionAndAddLiquidityByStrategy()`, `removeLiquidity()`, `claimAllRewards()`. Strategy types: SpotBalanced, Curve, BidAsk |
| Human Passport Embed for sybil resistance | $1.2K human.tech bounty. Drop-in embed component gating proposal submission | **LOW** | human.tech $1.2K | Import `@human.tech/passport-embed`, render on proposal submission page. Users verify identity, get Unique Humanity Score. ~15 min integration |
| ElevenLabs voice command interface | ElevenLabs credits bounty. Voice-driven agent interaction, not just TTS | **MEDIUM** | ElevenLabs credits | Use ElevenLabs Conversational AI platform with React SDK (`@elevenlabs/react`). Configure an agent with custom tools that trigger Scout/Analyzer/Treasury actions. Client tools pattern for triggering on-chain actions from voice commands |
| Working Solana devnet demo with real on-chain actions | Judges explicitly want "real systems, real demos, real code." Dashboards alone will not win | **HIGH** | Solana $1.2K, all bounties | Must show actual transactions on Solana Explorer: agent registration, token transfers, LP positions. Not mocked data |
| Next.js frontend dashboard | Visual proof of agent activity, treasury state, proposal pipeline for demo and judges | **MEDIUM** | All bounties (demo vehicle) | Shows agent identities, x402 payment history, treasury balance, Meteora LP positions, proposal pipeline. This is the demo surface |

### Functional Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Proposal evaluation with explained reasoning | Core to the "funding coordination" narrative. Agents must explain WHY they fund or reject | **LOW** | Proposal Analyzer calls Claude API with structured prompts. Returns scoring rubric + reasoning text. This is what makes it "intelligent" not just automated |
| Multi-agent coordination flow | Judges want to see agents actually coordinating, not just independent services | **MEDIUM** | Governance Agent orchestrates: Scout finds -> Analyzer evaluates -> Treasury funds. Must show the handoff chain working end-to-end |
| Treasury balance and fund tracking | Basic financial visibility. Users need to see how much is in the treasury and where it is allocated | **LOW** | Read Solana account balances, show token holdings, LP position values |
| Proposal submission workflow | Users need a way to submit proposals that agents evaluate. The "input" side of the system | **LOW** | Form UI gated by Human Passport. Stores proposal data for agent pipeline |

## Differentiators

Features that set the project apart. Not expected, but make judges say "wow."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Live voice-driven demo flow | Instead of clicking through UI, demo the entire funding cycle via voice commands. "Scout, find proposals" -> "Analyze this one" -> "Fund it." Judges remember voice demos | **MEDIUM** | ElevenLabs Conversational AI with custom tools that map to agent actions. Each voice command triggers real on-chain activity. This is the demo "wow factor" |
| On-chain agent reasoning trail | Every agent decision (fund/reject/defer) is recorded with reasoning hash on-chain via Metaplex Core Attributes plugin. Verifiable audit trail | **HIGH** | Use Core NFT Attributes plugin to store decision hashes. Links to full reasoning stored off-chain (IPFS or API). Judges love "verifiable AI" |
| Autonomous yield optimization | Treasury Manager doesn't just hold funds -- it actively manages DLMM positions based on market conditions, rebalancing to maximize yield on idle treasury | **HIGH** | Requires automated strategy selection (SpotBalanced vs Curve vs BidAsk based on volatility). Use `swapQuote()` and strategy parameters. Hard to get right in hackathon time |
| Frontier Tower building coordinator context | $500 bounty, but also contextual depth. RAG knowledge base of building data, floor treasuries, member matching | **MEDIUM** | Meteora $500 Frontier Tower bounty. RAG system with building-specific data. Agent knows about floors, residents, resources. Shows the system isn't generic -- it's adapted to its physical context |
| Agent payment analytics | Visualize the x402 payment graph between agents. Show which agent paid which, for what service, how much | **LOW** | Track x402 payments, render as a graph/flow diagram. Makes the agent economy tangible and visible to judges |
| Real-time agent status and activity feed | Live WebSocket updates showing what each agent is doing right now. "Scout is searching..." "Analyzer is evaluating..." | **MEDIUM** | Server-sent events or WebSocket from backend. Dashboard shows live agent states. Creates sense of autonomous activity during demo |
| Multi-strategy DLMM portfolio | Treasury Manager maintains positions across multiple token pairs, not just one. Shows portfolio-level thinking | **HIGH** | Multiple `DLMM.create()` instances across different pairs. Position tracking across all. Complex but impressive for Meteora judges |
| Governance voting simulation | Multiple agents "vote" on funding decisions with weighted inputs. Scout's discovery score + Analyzer's evaluation + Treasury's fund availability = collective decision | **MEDIUM** | Weighted scoring model where each agent contributes a score. Governance Agent aggregates and executes majority decision. Not full DAO governance (out of scope) but shows coordination |

## Anti-Features

Features to explicitly NOT build. Time sinks, scope creeps, or actively harmful for judging.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full DAO governance (SPL Governance / Realms) | Massive complexity, 20+ hours alone. Judges want agent coordination, not governance infrastructure | Simplified agent voting/scoring model. Governance Agent coordinates decisions programmatically, not through on-chain governance proposals |
| Mainnet deployment | Risk of losing real funds, regulatory concerns, complexity of mainnet USDC. Zero upside for hackathon demo | Devnet only. Use devnet faucet SOL and devnet token mints. Clearly label as devnet in demo |
| DBC token launch (Meteora Dynamic Bonding Curve) | Less documented than DLMM, different integration pattern, not core ask | Focus on DLMM LP management. That's what the Meteora bounty primarily evaluates |
| Custom token creation | Launching an "AGENTFUND" token adds no value for judges and distracts from agent coordination narrative | Use existing devnet tokens (SOL, devnet USDC) for treasury operations |
| Mobile app or responsive mobile design | Web-first is fine for hackathon. Mobile adds no judging value | Desktop-optimized Next.js dashboard. Projector/screen demo format |
| Multi-language voice support | English-only is fine. Multi-language adds complexity with zero hackathon ROI | English-only ElevenLabs agent. Pick one good voice |
| Production-grade error handling and retry logic | Over-engineering for a 20-hour build. Happy path is what judges see | Handle critical errors (Solana tx failures, API timeouts) gracefully. Log and show errors in UI rather than crash |
| Complex RBAC or user authentication | Not needed for demo. One admin user controlling agents is fine | Single wallet / admin mode. Human Passport handles sybil for proposal submitters |
| Agent-to-agent natural language chat | Tempting but wasteful. Agents should use structured API calls, not chat with each other | Structured JSON messaging between agents. Display agent communications in human-readable format on dashboard |
| Automated rebalancing loops | Running background jobs that continuously rebalance positions. Risk of devnet rate limits, transaction failures during demo | Manual/triggered rebalancing. Voice command: "Rebalance treasury" triggers one-time action |

## Feature Dependencies

```
Human Passport Embed -> Proposal Submission Form (Passport gates submissions)
Proposal Submission Form -> Scout Agent Discovery (Scout finds submitted proposals + web data)
Scout Agent Discovery -> Proposal Analyzer Evaluation (Analyzer needs proposals to evaluate)
Proposal Analyzer Evaluation -> Governance Decision (Governance needs evaluation scores)
Governance Decision -> Treasury Execution (Treasury executes funding based on decision)
Treasury Execution -> Meteora DLMM LP Management (Idle treasury funds go to LP)

Metaplex Agent Registration -> ALL agents (must register before agents can act)
x402 Micropayments -> Agent-to-Agent Communication (payments happen between agent calls)
ElevenLabs Voice -> ALL agent actions (voice triggers any agent action)
Next.js Dashboard -> ALL agent activity (dashboard displays everything)
Unbrowse -> Scout Agent (Scout's primary data source)
```

### Critical Path (build order):

```
Phase 1: Metaplex Agent Registration (foundation for everything)
    |
Phase 2: Individual Agent Logic (Scout/Unbrowse, Analyzer/Claude, Treasury/Meteora)
    |
Phase 3: x402 Inter-Agent Payments (agents pay each other)
    |
Phase 4: Governance Coordination (orchestrate multi-agent decisions)
    |
Phase 5: Dashboard + Voice Interface (demo surface)
    |
Phase 6: Human Passport + Frontier Tower (bonus bounties, easy integration)
```

## MVP Recommendation

**For a 20-hour solo build targeting 7 bounties, prioritize ruthlessly:**

### Must Ship (bounty-qualifying features):

1. **4 Metaplex Agent Registrations** -- $5K bounty. Get the on-chain identities working first. Everything else builds on this.
2. **Scout + Unbrowse integration** -- $1.5K bounty. POST to `/v1/intent/resolve` with grant discovery intents. Show real web data flowing in.
3. **Treasury Manager + Meteora DLMM** -- $1K bounty. Create one LP position, show it earning. `initializePositionAndAddLiquidityByStrategy()` with SpotBalanced.
4. **x402 agent-to-agent payment** -- Solana bounty qualifier. At least one x402 payment flow between two agents.
5. **Human Passport Embed** -- $1.2K bounty. Drop-in component, 15 minutes. Gate the proposal submission page.
6. **ElevenLabs voice commands** -- Credits bounty. Configure one Conversational AI agent with 3-4 custom tools mapping to agent actions.
7. **End-to-end demo flow** -- The 5-minute demo script must work smoothly. Voice -> Scout -> Analyze -> Fund -> Show LP -> Show payments.

### Should Ship (competitive advantage):

8. **Live agent activity feed** -- Makes the demo feel alive
9. **Agent payment analytics graph** -- Makes x402 tangible
10. **Frontier Tower context** -- $500 bounty, RAG knowledge base

### Defer (nice to have, don't sacrifice core for these):

11. **On-chain reasoning trail** -- Impressive but complex. Only if time permits.
12. **Autonomous yield optimization** -- Too risky for demo stability.
13. **Multi-strategy DLMM portfolio** -- Single pair is sufficient for bounty.

### Time Budget Estimate:

| Feature Block | Estimated Hours | Priority |
|---------------|----------------|----------|
| Metaplex Agent Registration (4 agents) | 3-4h | P0 |
| Scout + Unbrowse | 2-3h | P0 |
| Treasury + Meteora DLMM | 2-3h | P0 |
| x402 Agent Payments | 2h | P0 |
| Proposal Analyzer + Claude | 1-2h | P0 |
| Governance Coordination | 1-2h | P0 |
| Dashboard UI | 3-4h | P0 |
| ElevenLabs Voice | 2h | P0 |
| Human Passport Embed | 0.5h | P0 |
| Frontier Tower RAG | 1h | P1 |
| Integration & Demo Polish | 2-3h | P0 |
| **Total** | **~20-24h** | |

## Sources

- [Funding the Commons Hackathon](https://luma.com/ftchack-sf-2026) - Event details, tracks, prize pool
- [Metaplex Core](https://developers.metaplex.com/smart-contracts/core) - NFT standard for agent identities
- [Metaplex Developer Hub](https://developers.metaplex.com/) - Agent Identity Registry reference
- [x402 Protocol](https://www.x402.org/) - HTTP-native payments standard
- [x402 on Solana](https://solana.com/x402) - Solana-specific x402 integration
- [Corbits/Faremeter SDK](https://docs.corbits.dev/faremeter/wallet-integration) - Solana x402 SDK
- [Unbrowse GitHub](https://github.com/unbrowse-ai/unbrowse) - API-native browser skills for agents
- [Meteora DLMM SDK](https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/sdk-functions) - LP management functions
- [ElevenLabs React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react) - Conversational AI React integration
- [ElevenLabs Agents Platform](https://elevenlabs.io/docs/agents-platform/overview) - Voice agent architecture
- [Human Passport](https://docs.human.tech/tech/human-passport) - Sybil resistance and identity verification
- [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) - Toolkit for AI agents on Solana
- [Robot Money](https://www.robotmoney.net/) - Autonomous treasury reference architecture (competitor analysis)
- [Alchemy - Build Solana AI Agent](https://www.alchemy.com/blog/how-to-build-solana-ai-agents-in-2026) - Solana agent development patterns
