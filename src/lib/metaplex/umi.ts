/**
 * Singleton Umi instance for all Metaplex operations.
 *
 * Initializes Umi with mplCore and mplAgentIdentity plugins.
 * All Metaplex operations should use this shared instance.
 */

import 'dotenv/config';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { mplAgentIdentity } from '@metaplex-foundation/mpl-agent-registry';
import { signerIdentity, type Signer, type Umi } from '@metaplex-foundation/umi';

let _umi: Umi | null = null;

/**
 * Get or create the shared Umi instance.
 * Connects to Solana devnet by default, configurable via SOLANA_RPC_URL.
 */
export function getUmi(): Umi {
  if (!_umi) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    _umi = createUmi(rpcUrl)
      .use(mplCore())
      .use(mplAgentIdentity());
  }
  return _umi;
}

/**
 * Set the identity (signer) for Umi operations.
 * Call this before each agent's Metaplex operations.
 */
export function setUmiIdentity(signer: Signer): Umi {
  const umi = getUmi();
  umi.use(signerIdentity(signer));
  return umi;
}

/**
 * Reset the Umi instance (useful for testing).
 */
export function resetUmi(): void {
  _umi = null;
}
