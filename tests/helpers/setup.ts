/**
 * Shared test utilities.
 *
 * Provides configured Umi and Connection instances for tests,
 * plus helper functions for loading test keypairs.
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { mplAgentIdentity } from '@metaplex-foundation/mpl-agent-registry';
import { Connection } from '@solana/web3.js';
import { getWeb3Keypair, type AgentRole } from '../../src/lib/keys.js';
import { AGENT_ROLES } from '../../src/types/agents.js';
import type { Umi } from '@metaplex-foundation/umi';

export { AGENT_ROLES };

const TEST_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

/**
 * Create a Umi instance for tests.
 * Uses devnet by default.
 */
export function getTestUmi(): Umi {
  return createUmi(TEST_RPC_URL)
    .use(mplCore())
    .use(mplAgentIdentity());
}

/**
 * Create a web3.js Connection for tests.
 */
export function getTestConnection(): Connection {
  return new Connection(TEST_RPC_URL, 'confirmed');
}

/**
 * Load a test keypair with better error messages.
 */
export function loadTestKeypair(role: AgentRole) {
  try {
    return getWeb3Keypair(role);
  } catch (error) {
    throw new Error(
      `Failed to load keypair for role "${role}". ` +
      `Ensure keys/${role}.json exists. Run: pnpm generate-keys\n` +
      `Original error: ${error instanceof Error ? error.message : error}`
    );
  }
}
