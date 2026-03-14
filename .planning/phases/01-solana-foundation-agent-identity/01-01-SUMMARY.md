---
phase: 01-solana-foundation-agent-identity
plan: 01
subsystem: infra
tags: [solana, metaplex, umi, web3js, mpl-core, mpl-agent-registry, typescript, pnpm, vitest]

# Dependency graph
requires: []
provides:
  - Dual-layer key management bridge (Umi + web3.js from same keypair bytes)
  - Singleton Umi instance with mplCore and mplAgentIdentity plugins
  - Singleton web3.js Connection for runtime Solana operations
  - MPL Core collection, agent-nft, and identity registration helpers
  - SPL token account creation and DEMO_USDC fallback helpers
  - 4 agent keypairs (scout, analyzer, treasury, governance)
  - AgentRole type and AGENT_CONFIGS constant
  - PDA derivation unit tests (IDENT-03 offline verification)
affects: [01-02, 02-agent-architecture, 03-scout, 04-analyzer, 05-treasury, 06-x402]

# Tech tracking
tech-stack:
  added: ["@solana/web3.js@1.98.4", "@solana/spl-token@0.4.14", "@metaplex-foundation/umi@1.5.1", "@metaplex-foundation/umi-bundle-defaults@1.5.1", "@metaplex-foundation/umi-web3js-adapters@1.5.1", "@metaplex-foundation/mpl-core@1.8.0", "@metaplex-foundation/mpl-agent-registry@0.2.0", "@metaplex-foundation/mpl-toolbox@0.10.0", "bs58@6.0.0", "dotenv@17.3.1", "typescript@5.4.5", "tsx@4.21.0", "vitest@4.1.0"]
  patterns: ["Dual-layer key management bridge", "Singleton Umi instance", "Singleton web3.js Connection", "Umi/web3.js isolation boundary", "Deep import for mpl-agent-registry identity API"]

key-files:
  created:
    - src/lib/keys.ts
    - src/lib/metaplex/umi.ts
    - src/lib/metaplex/collection.ts
    - src/lib/metaplex/agent-nft.ts
    - src/lib/metaplex/identity.ts
    - src/lib/metaplex/index.ts
    - src/lib/solana/connection.ts
    - src/lib/solana/token-accounts.ts
    - src/lib/solana/index.ts
    - src/types/agents.ts
    - scripts/generate-keys.ts
    - vitest.config.ts
    - tests/helpers/setup.ts
    - tests/unit/identity-verification.test.ts
  modified:
    - package.json
    - tsconfig.json

key-decisions:
  - "mpl-agent-registry identity API requires deep import path (dist/src/generated/identity/) because top-level index only re-exports plugin and program IDs"
  - "Used pnpm onlyBuiltDependencies for esbuild (required by tsx) instead of approve-builds interactive flow"

patterns-established:
  - "Pattern 1: Dual-layer key bridge -- keys.ts is the ONLY file importing both Umi and web3.js types"
  - "Pattern 2: Umi singleton -- getUmi() creates once, reuses everywhere in Metaplex layer"
  - "Pattern 3: Connection singleton -- getConnection() creates once, reuses everywhere in Solana layer"
  - "Pattern 4: Module isolation -- src/lib/metaplex/ uses only Umi types, src/lib/solana/ uses only web3.js types"

requirements-completed: [IDENT-02, IDENT-03]

# Metrics
duration: 7min
completed: 2026-03-14
---

# Phase 1 Plan 01: Project Init & Library Modules Summary

**TypeScript project with dual-layer Umi/web3.js architecture, 4 agent keypairs, Metaplex identity helpers, and PDA derivation unit tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-14T19:30:32Z
- **Completed:** 2026-03-14T19:38:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Complete TypeScript project initialized with all Solana and Metaplex dependencies
- 4 agent keypairs generated (scout, analyzer, treasury, governance) in keys/ directory
- Dual-layer key management bridge providing both Umi signers and web3.js Keypairs from same key material
- Metaplex module with collection creation, agent NFT minting, and identity registration/verification helpers
- Solana module with singleton Connection, ATA creation, and DEMO_USDC fallback
- Umi/web3.js isolation boundary enforced and verified (zero cross-imports)
- PDA derivation unit tests passing (4/4) for offline identity verification (IDENT-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Project initialization, dependencies, keypair generation, and type definitions** - `177240a` (feat)
2. **Task 2: Library modules -- keys bridge, Metaplex layer, Solana layer, and test scaffold** - `a608cd0` (feat)

## Files Created/Modified
- `package.json` - Project config with ESM, pnpm, all dependencies
- `tsconfig.json` - Strict TypeScript with ES2022, NodeNext resolution
- `.gitignore` - Excludes node_modules, dist, keys, .env
- `.env.example` - RPC URL and cluster config template
- `src/types/agents.ts` - AgentRole type, AGENT_ROLES array, AGENT_CONFIGS record
- `scripts/generate-keys.ts` - Idempotent keypair generation for all 4 agents
- `src/lib/keys.ts` - THE bridge: getWeb3Keypair, getUmiSigner, getAllWeb3Keypairs
- `src/lib/metaplex/umi.ts` - Singleton Umi with mplCore + mplAgentIdentity plugins
- `src/lib/metaplex/collection.ts` - createAgentCollection, fetchAgentCollection
- `src/lib/metaplex/agent-nft.ts` - createAgentAsset, fetchAgentAsset
- `src/lib/metaplex/identity.ts` - registerAgentIdentity, isAgentRegistered, verifyAgentIdentity
- `src/lib/metaplex/index.ts` - Barrel re-export of Metaplex public API
- `src/lib/solana/connection.ts` - Singleton web3.js Connection
- `src/lib/solana/token-accounts.ts` - ATA creation, balance check, DEMO_USDC mint/distribute
- `src/lib/solana/index.ts` - Barrel re-export of Solana public API
- `vitest.config.ts` - Test config with 60s timeout for devnet calls
- `tests/helpers/setup.ts` - Shared test Umi, Connection, and keypair loading
- `tests/unit/identity-verification.test.ts` - PDA derivation determinism tests

## Decisions Made
- **mpl-agent-registry deep import:** The top-level package index only exports plugins and program IDs. The identity API (registerIdentityV1, findAgentIdentityV1Pda, etc.) must be imported from `@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/index.js`. This is a quirk of the 3-day-old v0.2.0 package where generated code is not fully re-exported at the barrel level.
- **esbuild build approval:** Used `pnpm.onlyBuiltDependencies` in package.json to allow esbuild build scripts (required by tsx) without interactive prompts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] mpl-agent-registry identity exports not at top level**
- **Found during:** Task 2 (identity.ts creation)
- **Issue:** `registerIdentityV1`, `findAgentIdentityV1Pda`, `fetchAgentIdentityV1`, `safeFetchAgentIdentityV1` are not re-exported from the package root. The top-level index only exports `mplAgentIdentity` plugin and `IDENTITY_ID`.
- **Fix:** Used deep import path `@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/index.js` for all identity API imports.
- **Files modified:** src/lib/metaplex/identity.ts, tests/unit/identity-verification.test.ts
- **Verification:** TypeScript compiles cleanly, unit tests pass
- **Committed in:** a608cd0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Import path change only -- no architectural or behavioral deviation.

## Issues Encountered
None beyond the import path issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All library modules ready for Plan 02 (registration and funding scripts)
- Keys generated and loadable via both Umi and web3.js APIs
- Metaplex module ready for collection creation, NFT minting, and identity registration
- Solana module ready for wallet funding and ATA creation
- Agent wallets need devnet SOL funding (Plan 02 scope)

## Self-Check: PASSED

All 14 source files verified present. Both task commits (177240a, a608cd0) found in git log. All 4 keypair files exist in keys/. TypeScript compiles with zero errors. 4/4 unit tests pass.

---
*Phase: 01-solana-foundation-agent-identity*
*Completed: 2026-03-14*
