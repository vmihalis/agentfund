# Phase 10: Devnet Bootstrap & Missing Verification - Research

**Researched:** 2026-03-14
**Domain:** Solana devnet operations, on-chain state creation, formal verification
**Confidence:** HIGH

## Summary

Phase 10 is a **gap closure phase** that requires no new code. All implementation scripts and test infrastructure already exist from Phases 1, 3, and 6. The phase has two distinct workstreams: (1) funding and executing existing devnet scripts to create on-chain state (IDENT-01 through IDENT-04, PAY-02), and (2) creating a formal VERIFICATION.md for Phase 3's Scout Agent (SCOUT-01 through SCOUT-03) which was completed but never verified.

The root cause for all IDENT gaps is a single operational issue: the Solana devnet public faucet (`api.devnet.solana.com`) returned HTTP 429 during the original Phase 1 execution, leaving all wallets at 0 SOL. The scripts (`fund-wallets.ts`, `register-agents.ts`, `verify-agents.ts`) are fully implemented, tested offline, and idempotent. Once the deployer wallet (`7GuLR4JgmxsQJAGz3poeCy9Gsp2jUyWntwigZy4iLD8X`) has SOL, the entire chain executes without code changes.

**Primary recommendation:** Fund the deployer via the web faucet at https://faucet.solana.com (5 SOL, 2x/hour) or a provider-specific faucet, then run `pnpm run fund-wallets && pnpm run register-agents && pnpm run verify-agents`. For Phase 3 verification, create `03-VERIFICATION.md` by running the existing unit tests and documenting the evidence (256 tests pass, 33 of which are ScoutAgent/parser tests).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IDENT-01 | 4 AI agents registered on-chain via Metaplex Agent Registry (MPL Core NFT + AgentIdentityV1 PDA each) | `register-agents.ts` exists and is verified correct; creates collection, 4 Core Assets, 4 PDAs. Needs funded deployer. |
| IDENT-02 | Each agent has its own Solana keypair, funded wallet, and ATA for devnet USDC | 4 keypairs exist in `keys/`. `fund-wallets.ts` handles SOL airdrop, DEMO_USDC mint, ATA creation. Needs faucet access. |
| IDENT-03 | Agent identities verifiable by any third party via PDA derivation | `verifyAgentIdentity()` in `src/lib/metaplex/identity.ts` implements full PDA derivation + verification. 4/4 offline unit tests pass. Needs on-chain state from IDENT-01. |
| IDENT-04 | MPL Core NFT collection created for AgentFund agent group | `createAgentCollection()` in `src/lib/metaplex/collection.ts` creates "AgentFund Agents" collection. Called by `register-agents.ts`. Needs funded deployer. |
| SCOUT-01 | Scout agent discovers grant proposals via Unbrowse intent resolution | `ScoutAgent.discoverProposals()` calls Unbrowse `/v1/intent/resolve`. 13 unit tests verify. Needs VERIFICATION.md. |
| SCOUT-02 | Scout calls Unbrowse `/v1/intent/resolve` with natural language intents | `UnbrowseClient.resolveIntent()` sends POST with intent + target URL. 8 client tests verify. Needs VERIFICATION.md. |
| SCOUT-03 | Scout returns structured proposal data to Governance Agent | `parseUnbrowseResult()` normalizes Unbrowse responses into typed `Proposal[]`. 20 parser tests verify. Needs VERIFICATION.md. |
| PAY-02 | At least one agent-to-agent x402 payment with real on-chain USDC transfer on devnet | `tests/integration/x402-payment.test.ts` has 3 tests; 1 passes (402 shape), 2 skip due to unfunded ATAs. Needs funded wallets from IDENT-02. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @solana/web3.js | 1.98.4 | Solana RPC, transactions, keypairs | Standard Solana JS SDK |
| @solana/spl-token | 0.4.14 | SPL token operations (ATAs, minting, transfers) | Official SPL token library |
| @metaplex-foundation/mpl-core | 1.8.0 | Metaplex Core NFT operations (collection, assets) | Official Metaplex Core SDK |
| @metaplex-foundation/mpl-agent-registry | 0.2.0 | Agent identity registration (AgentIdentityV1 PDAs) | Only library for Metaplex Agent Registry |
| @metaplex-foundation/umi | 1.5.1 | Metaplex framework layer | Required by all mpl-* packages |
| @metaplex-foundation/umi-bundle-defaults | 1.5.1 | Umi default plugins (RPC, serializers) | Standard Umi setup |
| @metaplex-foundation/umi-web3js-adapters | 1.5.1 | Bridge between Umi and web3.js types | Required for dual-layer architecture |
| vitest | 4.1.0 | Test framework | Already configured project-wide |

### No New Libraries Needed

This phase requires zero new dependencies. All implementation code exists. The only external requirement is SOL from a devnet faucet.

## Architecture Patterns

### Existing Script Execution Chain

```
Fund Deployer (manual/faucet)
  |
  v
pnpm run fund-wallets
  |- Load deployer keypair from keys/deployer.json
  |- Airdrop 2 SOL to deployer + 4 agents (with retry)
  |- Create/find USDC mint (official devnet USDC or DEMO_USDC)
  |- Create ATAs for all 4 agents
  |- Save keys/addresses.json (complete state)
  |
  v
pnpm run register-agents
  |- Load deployer, set as Umi identity
  |- Create "AgentFund Agents" collection (idempotent, saves collection.json)
  |- Mint 4 Core Assets (idempotent, saves assets.json per step)
  |- Register 4 AgentIdentityV1 PDAs (idempotent, checks isAgentRegistered)
  |- Save keys/registration.json
  |
  v
pnpm run verify-agents
  |- Load registration.json + addresses.json
  |- For each agent: check SOL balance, ATA, Core Asset, Identity PDA
  |- Print PASS/FAIL per check, summary "Agents verified: X/4"
```

### Existing File State Management

All scripts use a JSON state file pattern for idempotency:

| File | Created By | Contains | Purpose |
|------|-----------|----------|---------|
| `keys/deployer.json` | `fund-wallets.ts` | Deployer secret key | Fee payer for all on-chain ops |
| `keys/addresses.json` | `fund-wallets.ts` | Agent pubkeys, ATAs, USDC mint | State tracking for wallet setup |
| `keys/demo-usdc-mint.json` | `fund-wallets.ts` | DEMO_USDC mint address | Idempotent mint recovery |
| `keys/collection.json` | `register-agents.ts` | Collection address | Idempotent collection recovery |
| `keys/assets.json` | `register-agents.ts` | Per-agent Core Asset addresses | Idempotent asset recovery |
| `keys/registration.json` | `register-agents.ts` | Full registration data (wallet, asset, PDA, verified) | Final state for verify-agents |

### Dual-Layer Architecture (Umi / web3.js)

The project enforces strict separation:
- `src/lib/metaplex/` -- Umi types only (collection, agent-nft, identity, umi)
- `src/lib/solana/` -- web3.js types only (connection, token-accounts, airdrop)
- `src/lib/keys.ts` -- sole bridge file using `fromWeb3JsKeypair` adapter

Scripts import from both layers but never mix types within a single module.

### Phase 3 Verification Pattern

The project uses a standard VERIFICATION.md format (see Phase 1 and Phase 6 as examples). For Phase 3, verification involves:
1. Confirming artifacts exist and are substantive
2. Verifying key links (imports/exports) are wired
3. Running unit tests as evidence
4. Mapping each requirement to code evidence
5. Checking for anti-patterns (TODO/FIXME/stubs)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Devnet SOL acquisition | Custom faucet wrapper | Web faucet at faucet.solana.com + existing airdrop.ts retry logic | Rate limits are RPC-level; web faucet has separate limits |
| Token account creation | Manual instruction building | `getOrCreateAssociatedTokenAccount` from @solana/spl-token | Handles idempotency, rent calculation, and edge cases |
| PDA derivation | Manual seed hashing | `findAgentIdentityV1Pda` from mpl-agent-registry | Program-specific seed structure |
| USDC on devnet | Official Circle USDC (can't mint) | DEMO_USDC custom mint with deployer as authority | Already implemented with fallback pattern |
| Verification report | Ad-hoc checking | Existing verify-agents.ts script | Already checks SOL, ATA, Core Asset, PDA per agent |

## Common Pitfalls

### Pitfall 1: Devnet Faucet Rate Limiting (429)
**What goes wrong:** The public Solana devnet RPC at `api.devnet.solana.com` aggressively rate-limits `requestAirdrop` calls. All 5 wallet airdrops failed in Phase 1.
**Why it happens:** Public RPC endpoints have per-IP rate limits. Sending 5 airdrop requests in sequence triggers the limit.
**How to avoid:**
  1. **Primary:** Use the web faucet at https://faucet.solana.com (5 SOL, 2x per hour, separate rate limit from RPC). Fund deployer first, then run `fund-wallets.ts` which airdrops to agents.
  2. **Alternative:** Use provider-specific RPC with built-in faucet (Helius free tier, QuickNode faucet at faucet.quicknode.com/solana/devnet).
  3. **Alternative:** Set `SOLANA_RPC_URL` env var to a provider RPC endpoint with higher airdrop limits.
  4. **Alternative:** Use Solana CLI: `solana airdrop 2 <address> --url devnet` (different rate limit bucket).
**Warning signs:** HTTP 429 in airdrop.ts retry logs, `addresses.json` with null ATAs.

### Pitfall 2: USDC Mint Availability on Devnet
**What goes wrong:** Circle's official devnet USDC mint (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) may not be distributable -- you can create ATAs against it but cannot mint new tokens.
**Why it happens:** The official USDC devnet mint is controlled by Circle; only they can mint. On devnet, the account may not even exist.
**How to avoid:** Already handled -- `fund-wallets.ts` implements a DEMO_USDC fallback. If official USDC is unavailable, it creates a custom 6-decimal SPL token with deployer as mint authority and mints 1000 tokens per agent.
**Warning signs:** `isDemoUSDC: true` in addresses.json (expected and acceptable for demo).

### Pitfall 3: Transaction Size Limits with Metaplex
**What goes wrong:** Registering agent identity involves creating a Core Asset + registering AgentIdentityV1 PDA. Each operation is a separate transaction.
**Why it happens:** Solana transactions have a 1232-byte limit. Complex Metaplex operations must be split.
**How to avoid:** Already handled -- `register-agents.ts` performs each step (collection, assets, identities) as separate transactions with intermediate state saves (assets.json, collection.json). If a step fails, re-running skips completed steps.
**Warning signs:** Transaction too large errors (should not happen with current script design).

### Pitfall 4: Partial State from Interrupted Runs
**What goes wrong:** If `fund-wallets.ts` or `register-agents.ts` is interrupted mid-execution, JSON state files may be partially written.
**Why it happens:** Scripts save state incrementally (e.g., assets.json after each agent, not all at once).
**How to avoid:** Already handled -- all scripts check existing state before acting. `register-agents.ts` verifies saved addresses against devnet before skipping. `fund-wallets.ts` checks balances before airdroping. Re-running is always safe.
**Warning signs:** `addresses.json` with some null and some non-null ATAs.

### Pitfall 5: Missing Phase 3 VERIFICATION.md
**What goes wrong:** Phase 3 (Scout Agent) was completed and has a SUMMARY but no VERIFICATION.md, leaving SCOUT-01, SCOUT-02, SCOUT-03 as "orphaned" requirements.
**Why it happens:** The verification step was skipped during Phase 3 execution.
**How to avoid:** Create `03-VERIFICATION.md` in the Phase 3 directory following the project's standard format. Evidence is available from: 33 unit tests (13 ScoutAgent + 20 parser), source files exist and are substantive, key links verified in SUMMARY.
**Warning signs:** N/A -- this is a documentation gap, not a code gap.

## Code Examples

All code already exists. Key reference points for the planner:

### Deployer Funding (Manual Step)
```bash
# Option 1: Web faucet (recommended)
# Visit https://faucet.solana.com
# Paste: 7GuLR4JgmxsQJAGz3poeCy9Gsp2jUyWntwigZy4iLD8X
# Request 5 SOL (can do 2x per hour)

# Option 2: Solana CLI
solana airdrop 2 7GuLR4JgmxsQJAGz3poeCy9Gsp2jUyWntwigZy4iLD8X --url devnet

# Option 3: Provider faucet (QuickNode)
# Visit https://faucet.quicknode.com/solana/devnet
# Paste deployer address

# Verify funding:
solana balance 7GuLR4JgmxsQJAGz3poeCy9Gsp2jUyWntwigZy4iLD8X --url devnet
```

### Script Execution Chain
```bash
# Source: scripts/fund-wallets.ts, register-agents.ts, verify-agents.ts
# All scripts are idempotent -- safe to re-run

# Step 1: Fund all wallets + create ATAs
pnpm run fund-wallets

# Step 2: Register agents on-chain
pnpm run register-agents

# Step 3: Verify everything
pnpm run verify-agents

# Step 4: Run integration tests (should now pass)
pnpm test -- tests/integration/wallet-setup.test.ts
pnpm test -- tests/integration/agent-registration.test.ts
pnpm test -- tests/integration/collection-creation.test.ts

# Step 5: Run x402 payment integration test (PAY-02)
pnpm test -- tests/integration/x402-payment.test.ts
```

### Expected addresses.json After Successful Funding
```json
{
  "deployer": "7GuLR4JgmxsQJAGz3poeCy9Gsp2jUyWntwigZy4iLD8X",
  "agents": {
    "scout": { "publicKey": "EMKvtgEGf91t4voCE7bF4MgCYU46ubJiRjJn9jmRRcej", "ata": "<non-null>" },
    "analyzer": { "publicKey": "DeUfaAWhauYzPQNetQF8NHDFY8hiQXazE4HYBBAwFMfu", "ata": "<non-null>" },
    "treasury": { "publicKey": "7vmyrNkxfegeT3146qr1mf9CZ3s8zYt1kfcgRrqgst9L", "ata": "<non-null>" },
    "governance": { "publicKey": "2pVL2sZ4oMKh9J3tDHvrdfUxcf4JBVxi3F8pfzFUb2PB", "ata": "<non-null>" }
  },
  "usdcMint": "<non-null>",
  "isDemoUSDC": true
}
```

### Phase 3 VERIFICATION.md Evidence Sources
```
Source files (all verified in 03-01-SUMMARY.md):
  - src/lib/unbrowse/types.ts    -- UnbrowseRequest, UnbrowseResponse, GRANT_TARGETS
  - src/lib/unbrowse/client.ts   -- UnbrowseClient.resolveIntent(), healthCheck()
  - src/lib/unbrowse/parser.ts   -- parseUnbrowseResult(), Zod schema
  - src/agents/scout-agent.ts    -- ScoutAgent extends BaseAgent implements IScoutAgent

Tests (all passing):
  - tests/unit/unbrowse-parser.test.ts  -- 20 tests (parser normalization, client HTTP)
  - tests/unit/scout-agent.test.ts      -- 13 tests (fallback chain, events, lifecycle)

Key links verified:
  - scout-agent.ts -> UnbrowseClient (constructor injection)
  - scout-agent.ts -> parseUnbrowseResult (response parsing)
  - scout-agent.ts -> STUB_PROPOSALS (fallback data)
  - scout-agent.ts implements IScoutAgent (type-level + runtime test)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `requestAirdrop` via public RPC | Web faucet + provider faucets | 2024+ | Public RPC rate limits make programmatic airdrop unreliable |
| Official devnet USDC | DEMO_USDC custom mint | Always for devnet | Can't mint from Circle's devnet USDC; custom mint gives full control |
| mpl-agent-registry deep imports | Still required (`dist/src/generated/identity/index.js`) | v0.2.0 | Top-level exports don't include identity functions; deep import is the pattern |

**Note on mpl-agent-registry v0.2.0:** This is a very new package (3 days old at project start). The deep import path `@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/index.js` is required because the top-level `index.ts` only exports plugins and program IDs, not the identity registration functions. This has been verified in Phase 1 and works correctly.

## Open Questions

1. **Devnet faucet availability at execution time**
   - What we know: The web faucet at faucet.solana.com supports 5 SOL, 2x per hour. QuickNode and Helius also offer faucets.
   - What's unclear: Whether rate limits will be hit again (depends on current devnet load and IP)
   - Recommendation: Try web faucet first. If blocked, use Solana CLI with `-u` flag pointing to a different RPC. Keep provider faucets as backup. The scripts handle partial state gracefully, so even partial funding progress is preserved.

2. **x402 payment test flakiness on devnet**
   - What we know: The integration test (`x402-payment.test.ts`) submits a real SPL transfer and waits for confirmation. Devnet confirmation times vary.
   - What's unclear: Whether 60s test timeout (from vitest.config.ts) is sufficient for the full 402->pay->verify cycle
   - Recommendation: The timeout should be adequate (devnet confirmations are typically 1-5s). If flaky, increase test timeout for that specific file.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm vitest run tests/integration/wallet-setup.test.ts tests/integration/agent-registration.test.ts tests/integration/collection-creation.test.ts tests/integration/x402-payment.test.ts --reporter=verbose` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDENT-01 | 4 agents registered as MPL Core NFTs with AgentIdentityV1 PDAs | integration | `pnpm vitest run tests/integration/agent-registration.test.ts --reporter=verbose` | Yes (20 tests, currently skipped) |
| IDENT-02 | Each agent has funded wallet and ATA | integration | `pnpm vitest run tests/integration/wallet-setup.test.ts --reporter=verbose` | Yes (8 tests, currently skipped) |
| IDENT-03 | Identities verifiable via PDA derivation | unit + integration | `pnpm vitest run tests/unit/identity-verification.test.ts tests/integration/agent-registration.test.ts --reporter=verbose` | Yes (4 unit pass, 20 integration skipped) |
| IDENT-04 | MPL Core NFT collection created | integration | `pnpm vitest run tests/integration/collection-creation.test.ts --reporter=verbose` | Yes (2 tests, currently skipped) |
| SCOUT-01 | Scout discovers proposals via Unbrowse | unit | `pnpm vitest run tests/unit/scout-agent.test.ts --reporter=verbose` | Yes (13 tests, all pass) |
| SCOUT-02 | Scout calls /v1/intent/resolve | unit | `pnpm vitest run tests/unit/unbrowse-parser.test.ts --reporter=verbose` | Yes (20 tests, all pass) |
| SCOUT-03 | Scout returns structured proposal data | unit | `pnpm vitest run tests/unit/scout-agent.test.ts -t "returns parsed proposals" --reporter=verbose` | Yes (passes) |
| PAY-02 | Agent-to-agent x402 payment on devnet | integration | `pnpm vitest run tests/integration/x402-payment.test.ts --reporter=verbose` | Yes (1 pass, 2 skipped) |

### Sampling Rate
- **Per task commit:** Quick run command (integration tests for IDENT + PAY-02)
- **Per wave merge:** `pnpm test` (full 289-test suite)
- **Phase gate:** All integration tests pass (no skips) + full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- all test files already exist. The tests are correctly structured with `describe.skipIf` guards that will automatically run once preconditions (funded wallets, registration.json) are met. No new test infrastructure needed.

## Sources

### Primary (HIGH confidence)
- Project source code: `scripts/fund-wallets.ts`, `scripts/register-agents.ts`, `scripts/verify-agents.ts` -- read and verified
- Project source code: `src/lib/metaplex/identity.ts`, `src/lib/solana/airdrop.ts`, `src/lib/solana/token-accounts.ts` -- read and verified
- Project test suite: 256 tests pass, 33 skip (all skips are devnet-dependent integration tests)
- Phase 1 VERIFICATION.md: gaps analysis with root cause (faucet 429)
- Phase 6 VERIFICATION.md: PAY-02 "NEEDS HUMAN" status documented
- v1.0 Milestone Audit: comprehensive gap analysis identifying all 8 unsatisfied requirements
- Phase 3 SUMMARY: confirms all Scout code is complete, 33 tests added

### Secondary (MEDIUM confidence)
- [Solana faucet documentation](https://solana.com/developers/guides/getstarted/solana-token-airdrop-and-faucets) -- faucet options and rate limits
- [Helius devnet faucet](https://www.helius.dev/blog/solana-faucet) -- provider-specific faucet (paid plans)
- [QuickNode devnet faucet](https://faucet.quicknode.com/solana/devnet) -- provider-specific faucet (free)

### Tertiary (LOW confidence)
None -- all findings verified against project source code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified working in Phases 1, 3, 6
- Architecture: HIGH - all scripts exist, are idempotent, and have been code-reviewed in Phase 1 verification
- Pitfalls: HIGH - root cause (faucet 429) confirmed by Phase 1 VERIFICATION.md and milestone audit
- Devnet faucet availability: MEDIUM - web faucet should work but depends on external service

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- no library updates needed, only operational execution)
