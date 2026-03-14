/**
 * Agent Core Asset helpers.
 *
 * Creates MPL Core Assets (NFTs) for individual agents within
 * the AgentFund collection. All operations use Umi types exclusively.
 */

import {
  create,
  fetchAsset,
  fetchCollection,
  type AssetV1,
} from '@metaplex-foundation/mpl-core';
import { generateSigner, publicKey, type Umi, type PublicKey, type Signer } from '@metaplex-foundation/umi';

export interface CreateAgentAssetArgs {
  /** Display name for the agent NFT */
  name: string;
  /** Metadata URI (data URI or HTTPS URL) */
  uri: string;
  /** The agent wallet's public key (Umi format) that will own the NFT */
  owner: PublicKey | string;
  /** The collection public key to add this asset to */
  collectionAddress: PublicKey | string;
}

/**
 * Create an MPL Core Asset for an agent in the collection.
 *
 * The Umi identity must be the collection authority (deployer).
 * The agent's wallet is set as the asset owner.
 * Returns the asset signer for reference.
 */
export async function createAgentAsset(
  umi: Umi,
  args: CreateAgentAssetArgs,
): Promise<Signer> {
  const assetSigner = generateSigner(umi);
  const ownerPk = typeof args.owner === 'string' ? publicKey(args.owner) : args.owner;
  const collectionPk =
    typeof args.collectionAddress === 'string'
      ? publicKey(args.collectionAddress)
      : args.collectionAddress;

  // Fetch the collection to pass to create()
  const collection = await fetchCollection(umi, collectionPk);

  await create(umi, {
    asset: assetSigner,
    collection,
    name: args.name,
    uri: args.uri,
    owner: ownerPk,
  }).sendAndConfirm(umi);

  // Verify the asset was created
  const asset = await fetchAsset(umi, assetSigner.publicKey);
  console.log(`Asset created: ${asset.publicKey} | Owner: ${asset.owner} | Name: ${asset.name}`);

  return assetSigner;
}

/**
 * Fetch an existing Core Asset by its public key.
 */
export async function fetchAgentAsset(
  umi: Umi,
  address: PublicKey | string,
): Promise<AssetV1> {
  const pk = typeof address === 'string' ? publicKey(address) : address;
  return fetchAsset(umi, pk);
}
