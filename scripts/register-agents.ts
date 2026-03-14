/**
 * Register all 4 agents on Solana devnet.
 *
 * Steps:
 * A. Create "AgentFund Agents" collection (idempotent)
 * B. Create Core Asset NFTs for each agent (idempotent)
 * C. Register AgentIdentityV1 PDAs for each agent (idempotent)
 * D. Output summary and save registration.json
 *
 * Requires: fund-wallets.ts to have run first (deployer needs SOL).
 * Idempotent: re-running skips already-created collection, assets, and identities.
 */

import { Keypair } from '@solana/web3.js';
import { publicKey } from '@metaplex-foundation/umi';
import { fetchAsset, fetchCollection } from '@metaplex-foundation/mpl-core';
import fs from 'fs';
import path from 'path';
import { AGENT_ROLES, AGENT_CONFIGS, type AgentRole } from '../src/types/agents.js';
import { getUmi, setUmiIdentity } from '../src/lib/metaplex/umi.js';
import { createAgentCollection, fetchAgentCollection } from '../src/lib/metaplex/collection.js';
import { createAgentAsset } from '../src/lib/metaplex/agent-nft.js';
import {
  registerAgentIdentity,
  isAgentRegistered,
  verifyAgentIdentity,
} from '../src/lib/metaplex/identity.js';
import { getAllWeb3Keypairs } from '../src/lib/keys.js';
import { createSignerFromKeypair } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';

const KEYS_DIR = path.join(process.cwd(), 'keys');

// ---- Helpers ----

function loadDeployer(): Keypair {
  const filePath = path.join(KEYS_DIR, 'deployer.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('Deployer keypair not found. Run fund-wallets.ts first.');
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

function loadJson<T>(filename: string): T | null {
  const filePath = path.join(KEYS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function saveJson(filename: string, data: unknown): void {
  const filePath = path.join(KEYS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ---- Main ----

async function main() {
  console.log('=== Register Agents ===\n');

  const deployer = loadDeployer();
  const agentKeypairs = getAllWeb3Keypairs();

  // Initialize Umi with deployer as identity (collection authority)
  const umi = getUmi();
  const deployerUmiKeypair = fromWeb3JsKeypair(deployer);
  const deployerSigner = createSignerFromKeypair(umi, deployerUmiKeypair);
  setUmiIdentity(deployerSigner);

  console.log(`Deployer: ${deployer.publicKey.toBase58()}`);

  // ---- Step A: Create Collection (idempotent) ----
  console.log('\n--- Step A: Collection ---\n');

  let collectionAddress: string;
  const savedCollection = loadJson<{ address: string }>('collection.json');

  if (savedCollection) {
    // Verify collection still exists on devnet
    try {
      const collection = await fetchAgentCollection(umi, savedCollection.address);
      collectionAddress = savedCollection.address;
      console.log(`[skip] Collection exists: ${collectionAddress} (${collection.name})`);
    } catch {
      console.log('Saved collection not found on devnet, creating new one...');
      const collectionSigner = await createAgentCollection(umi);
      collectionAddress = collectionSigner.publicKey as string;
      saveJson('collection.json', { address: collectionAddress });
      console.log(`[new]  Collection: ${collectionAddress}`);
    }
  } else {
    const collectionSigner = await createAgentCollection(umi);
    collectionAddress = collectionSigner.publicKey as string;
    saveJson('collection.json', { address: collectionAddress });
    console.log(`[new]  Collection: ${collectionAddress}`);
  }

  // ---- Step B: Create Agent Core Assets (idempotent) ----
  console.log('\n--- Step B: Core Assets ---\n');

  type AssetsRecord = Partial<Record<AgentRole, string>>;
  const savedAssets: AssetsRecord = loadJson<AssetsRecord>('assets.json') ?? {};

  for (const role of AGENT_ROLES) {
    const config = AGENT_CONFIGS[role];
    const agentPubkey = agentKeypairs[role].publicKey.toBase58();

    if (savedAssets[role]) {
      // Verify asset still exists on devnet
      try {
        const asset = await fetchAsset(umi, publicKey(savedAssets[role]!));
        console.log(`[skip] ${role}: asset ${savedAssets[role]} (${asset.name})`);
        continue;
      } catch {
        console.log(`Saved asset for ${role} not found on devnet, creating new one...`);
      }
    }

    // Create metadata URI
    const metadata = {
      name: config.name,
      role,
      description: config.description,
    };
    const uri = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;

    console.log(`Creating asset for ${role} (owner: ${agentPubkey})...`);

    const assetSigner = await createAgentAsset(umi, {
      name: config.name,
      uri,
      owner: publicKey(agentPubkey),
      collectionAddress: publicKey(collectionAddress),
    });

    savedAssets[role] = assetSigner.publicKey as string;
    saveJson('assets.json', savedAssets);
    console.log(`[new]  ${role}: asset ${savedAssets[role]}`);
  }

  // ---- Step C: Register Identities (idempotent) ----
  console.log('\n--- Step C: Identity Registration ---\n');

  type RegistrationEntry = {
    wallet: string;
    asset: string;
    pda: string;
    verified: boolean;
  };
  type RegistrationData = {
    collection: string;
    agents: Partial<Record<AgentRole, RegistrationEntry>>;
  };

  const registrationData: RegistrationData = {
    collection: collectionAddress,
    agents: {},
  };

  for (const role of AGENT_ROLES) {
    const assetAddress = savedAssets[role];
    if (!assetAddress) {
      console.error(`ERROR: No asset address for ${role}. Skipping registration.`);
      continue;
    }

    const assetPk = publicKey(assetAddress);
    const agentPubkey = agentKeypairs[role].publicKey.toBase58();

    // Check if already registered
    const alreadyRegistered = await isAgentRegistered(umi, assetPk);
    if (alreadyRegistered) {
      console.log(`[skip] ${role}: already registered`);

      // Still verify and record data
      const result = await verifyAgentIdentity(umi, assetPk);
      registrationData.agents[role] = {
        wallet: agentPubkey,
        asset: assetAddress,
        pda: result.pda as string,
        verified: result.verified,
      };
      console.log(`  PDA: ${result.pda} | Verified: ${result.verified}`);
      continue;
    }

    // Register identity
    console.log(`Registering identity for ${role}...`);

    const capabilities = getCapabilities(role);
    const registrationMetadata = {
      name: AGENT_CONFIGS[role].name,
      role,
      version: '1.0.0',
      capabilities,
    };
    const agentRegistrationUri = `data:application/json,${encodeURIComponent(
      JSON.stringify(registrationMetadata),
    )}`;

    const pda = await registerAgentIdentity(umi, {
      assetAddress: assetPk,
      collectionAddress: publicKey(collectionAddress),
      agentRegistrationUri,
    });

    // Verify registration
    const result = await verifyAgentIdentity(umi, assetPk);
    registrationData.agents[role] = {
      wallet: agentPubkey,
      asset: assetAddress,
      pda: pda[0] as string,
      verified: result.verified,
    };
    console.log(`[new]  ${role}: PDA ${pda[0]} | Verified: ${result.verified}`);
  }

  // ---- Step D: Summary ----
  console.log('\n--- Summary ---\n');

  for (const role of AGENT_ROLES) {
    const entry = registrationData.agents[role];
    if (entry) {
      console.log(`${role}:`);
      console.log(`  Wallet: ${entry.wallet}`);
      console.log(`  Asset:  ${entry.asset}`);
      console.log(`  PDA:    ${entry.pda}`);
      console.log(`  Verified: ${entry.verified}`);
    } else {
      console.log(`${role}: NOT REGISTERED`);
    }
  }

  saveJson('registration.json', registrationData);
  console.log(`\nRegistration data saved to keys/registration.json`);

  console.log('\n=== Register Agents Complete ===');
}

/**
 * Get role-specific capabilities for the agent registration metadata.
 */
function getCapabilities(role: AgentRole): string[] {
  switch (role) {
    case 'scout':
      return ['web-search', 'data-discovery', 'proposal-sourcing'];
    case 'analyzer':
      return ['proposal-evaluation', 'risk-scoring', 'ai-analysis'];
    case 'treasury':
      return ['fund-management', 'token-transfers', 'defi-yield'];
    case 'governance':
      return ['pipeline-coordination', 'allocation-decisions', 'voting'];
  }
}

main().catch((error) => {
  console.error('Registration failed:', error);
  process.exit(1);
});
