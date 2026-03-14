/**
 * Integration tests for collection creation (IDENT-04).
 *
 * Verifies that the "AgentFund Agents" collection exists on devnet
 * and contains the expected number of assets.
 *
 * Skips if keys/registration.json doesn't exist (scripts haven't run yet).
 */

import { describe, it, expect } from 'vitest';
import { publicKey } from '@metaplex-foundation/umi';
import { fetchCollection } from '@metaplex-foundation/mpl-core';
import fs from 'fs';
import path from 'path';
import { getTestUmi } from '../helpers/setup.js';

const KEYS_DIR = path.join(process.cwd(), 'keys');
const REGISTRATION_PATH = path.join(KEYS_DIR, 'registration.json');

interface RegistrationData {
  collection: string;
  agents: Record<string, { wallet: string; asset: string; pda: string; verified: boolean }>;
}

const registrationExists = fs.existsSync(REGISTRATION_PATH);

function loadRegistration(): RegistrationData {
  return JSON.parse(fs.readFileSync(REGISTRATION_PATH, 'utf-8'));
}

describe.skipIf(!registrationExists)('Collection Creation (IDENT-04)', () => {
  const registration = registrationExists ? loadRegistration() : null;
  const umi = getTestUmi();

  it('AgentFund Agents collection exists on devnet', async () => {
    if (!registration) return;

    const collection = await fetchCollection(
      umi,
      publicKey(registration.collection),
    );

    expect(collection).toBeTruthy();
    expect(collection.name).toBe('AgentFund Agents');
  });

  it('collection has correct number of assets (4)', async () => {
    if (!registration) return;

    const collection = await fetchCollection(
      umi,
      publicKey(registration.collection),
    );

    // MPL Core collections track the number of minted assets
    expect(collection.numMinted).toBe(4);
  });
});
