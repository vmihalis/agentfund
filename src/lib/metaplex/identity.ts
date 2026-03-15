/**
 * Agent identity registration and verification helpers.
 *
 * Wraps the mpl-agent-registry functions for registering and verifying
 * on-chain agent identities via AgentIdentityV1 PDAs.
 * All operations use Umi types exclusively.
 */

import {
  registerIdentityV1,
  findAgentIdentityV1Pda,
  fetchAgentIdentityV1,
  safeFetchAgentIdentityV1,
  type AgentIdentityV1,
} from '@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/index.js';
import { fetchAsset } from '@metaplex-foundation/mpl-core';
import { publicKey, type Umi, type PublicKey, type Pda } from '@metaplex-foundation/umi';

export interface RegisterAgentIdentityArgs {
  /** The Core Asset public key for this agent */
  assetAddress: PublicKey | string;
  /** The collection public key */
  collectionAddress: PublicKey | string;
  /** URI with agent registration metadata (REQUIRED) */
  agentRegistrationUri: string;
}

export interface VerificationResult {
  verified: boolean;
  pda: string;
  identity: AgentIdentityV1 | null;
}

/**
 * Register an agent identity on-chain.
 *
 * Creates an AgentIdentityV1 PDA bound to the Core Asset.
 * The Umi identity must be the collection authority.
 * agentRegistrationUri is REQUIRED by the on-chain program.
 *
 * Returns the PDA address as a tuple [PublicKey, bump].
 */
export async function registerAgentIdentity(
  umi: Umi,
  args: RegisterAgentIdentityArgs,
): Promise<Pda> {
  const assetPk =
    typeof args.assetAddress === 'string' ? publicKey(args.assetAddress) : args.assetAddress;
  const collectionPk =
    typeof args.collectionAddress === 'string'
      ? publicKey(args.collectionAddress)
      : args.collectionAddress;

  await registerIdentityV1(umi, {
    asset: assetPk,
    collection: collectionPk,
    agentRegistrationUri: args.agentRegistrationUri,
  }).sendAndConfirm(umi, { commitment: 'confirmed' });

  const pda = findAgentIdentityV1Pda(umi, { asset: assetPk });
  console.log(`Identity registered for asset ${assetPk} | PDA: ${pda[0]}`);

  return pda;
}

/**
 * Check if an agent has a registered identity (PDA exists on-chain).
 *
 * Returns true if the PDA exists and is valid, false otherwise.
 */
export async function isAgentRegistered(
  umi: Umi,
  assetAddress: PublicKey | string,
): Promise<boolean> {
  const assetPk =
    typeof assetAddress === 'string' ? publicKey(assetAddress) : assetAddress;

  const pda = findAgentIdentityV1Pda(umi, { asset: assetPk });
  const identity = await safeFetchAgentIdentityV1(umi, pda);

  return identity !== null;
}

/**
 * Full verification of an agent identity.
 *
 * 1. Derives the PDA from the asset public key
 * 2. Fetches the PDA account data
 * 3. Verifies the PDA's asset field matches the input
 * 4. Fetches the Core Asset to confirm binding
 *
 * Returns a verification result with the PDA address and identity data.
 */
export async function verifyAgentIdentity(
  umi: Umi,
  assetAddress: PublicKey | string,
): Promise<VerificationResult> {
  const assetPk =
    typeof assetAddress === 'string' ? publicKey(assetAddress) : assetAddress;

  // Step 1: Derive PDA
  const pda = findAgentIdentityV1Pda(umi, { asset: assetPk });

  // Step 2: Fetch PDA account (returns null if not registered)
  const identity = await safeFetchAgentIdentityV1(umi, pda);
  if (!identity) {
    return { verified: false, pda: pda[0], identity: null };
  }

  // Step 3: Verify the PDA's asset field points back to our asset
  if (identity.asset !== assetPk) {
    return { verified: false, pda: pda[0], identity };
  }

  // Step 4: Fetch the Core Asset to confirm it exists and is valid
  try {
    const coreAsset = await fetchAsset(umi, assetPk);
    // The asset exists and the PDA correctly references it
    return { verified: true, pda: pda[0], identity };
  } catch {
    return { verified: false, pda: pda[0], identity };
  }
}
