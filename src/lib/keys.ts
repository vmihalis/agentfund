/**
 * Dual-layer key management bridge.
 *
 * THE ONLY file that imports from both Umi and web3.js.
 * Loads raw keypair bytes from disk and provides both
 * Umi signers and web3.js Keypairs from the same key material.
 */

import { Keypair } from '@solana/web3.js';
import { createSignerFromKeypair, type KeypairSigner } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { getUmi } from './metaplex/umi.js';
import { AGENT_ROLES, type AgentRole } from '../types/agents.js';
import fs from 'fs';
import path from 'path';

// Re-export AgentRole for convenience
export type { AgentRole } from '../types/agents.js';

/**
 * Load raw keypair bytes from the JSON file for a given role.
 */
function loadKeypairBytes(role: AgentRole): Uint8Array {
  const filePath = path.join(process.cwd(), 'keys', `${role}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return new Uint8Array(data);
}

/**
 * Get a web3.js Keypair for an agent role.
 * Use this for all @solana/web3.js operations (transfers, SPL, etc).
 */
export function getWeb3Keypair(role: AgentRole): Keypair {
  return Keypair.fromSecretKey(loadKeypairBytes(role));
}

/**
 * Get a Umi KeypairSigner for an agent role.
 * Use this for all Metaplex/Umi operations (NFTs, identity registration, etc).
 */
export function getUmiSigner(role: AgentRole): KeypairSigner {
  const umi = getUmi();
  const web3Keypair = getWeb3Keypair(role);
  const umiKeypair = fromWeb3JsKeypair(web3Keypair);
  return createSignerFromKeypair(umi, umiKeypair);
}

/**
 * Get all 4 agent web3.js Keypairs as a record.
 */
export function getAllWeb3Keypairs(): Record<AgentRole, Keypair> {
  const result = {} as Record<AgentRole, Keypair>;
  for (const role of AGENT_ROLES) {
    result[role] = getWeb3Keypair(role);
  }
  return result;
}
