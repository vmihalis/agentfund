/**
 * MPL Core collection helpers.
 *
 * Creates and fetches the AgentFund agent collection.
 * All operations use Umi types exclusively.
 */

import {
  createCollection,
  fetchCollection,
  type CollectionV1,
} from '@metaplex-foundation/mpl-core';
import { generateSigner, publicKey, type Umi, type PublicKey, type Signer } from '@metaplex-foundation/umi';

/**
 * Create the "AgentFund Agents" MPL Core collection.
 *
 * Returns the collection signer (caller should save the public key
 * for use in subsequent asset creation).
 */
export async function createAgentCollection(umi: Umi): Promise<Signer> {
  const collectionSigner = generateSigner(umi);

  const metadata = {
    name: 'AgentFund Agents',
    description: 'On-chain AI agent identities for AgentFund',
  };

  const uri = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;

  await createCollection(umi, {
    collection: collectionSigner,
    name: 'AgentFund Agents',
    uri,
  }).sendAndConfirm(umi);

  console.log('Collection created:', collectionSigner.publicKey);

  return collectionSigner;
}

/**
 * Fetch an existing collection by its public key.
 */
export async function fetchAgentCollection(
  umi: Umi,
  address: PublicKey | string,
): Promise<CollectionV1> {
  const pk = typeof address === 'string' ? publicKey(address) : address;
  return fetchCollection(umi, pk);
}
