/**
 * Generate Solana keypairs for all 4 agents.
 *
 * Creates individual keypair JSON files in keys/ directory.
 * Idempotent: skips keypair generation if file already exists.
 */

import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { AGENT_ROLES } from '../src/types/agents.js';

const KEYS_DIR = path.join(process.cwd(), 'keys');

// Ensure keys/ directory exists
fs.mkdirSync(KEYS_DIR, { recursive: true });

for (const role of AGENT_ROLES) {
  const filePath = path.join(KEYS_DIR, `${role}.json`);

  if (fs.existsSync(filePath)) {
    // Load existing keypair and show its public key
    const existing = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(filePath, 'utf-8')))
    );
    console.log(`[skip] ${role}: ${existing.publicKey.toBase58()} (already exists)`);
    continue;
  }

  const keypair = Keypair.generate();
  const secretKeyArray = Array.from(keypair.secretKey);

  fs.writeFileSync(filePath, JSON.stringify(secretKeyArray));
  console.log(`[new]  ${role}: ${keypair.publicKey.toBase58()}`);
}

console.log('\nAll agent keypairs ready in keys/');
