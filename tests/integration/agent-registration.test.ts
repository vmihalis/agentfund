/**
 * Integration tests for agent registration (IDENT-01).
 *
 * Verifies that each agent has:
 * - An MPL Core Asset on devnet
 * - The asset is in the AgentFund collection
 * - An AgentIdentityV1 PDA exists
 * - PDA derivation matches stored PDA address
 * - Identity PDA references the correct asset
 *
 * Skips if keys/registration.json doesn't exist (scripts haven't run yet).
 */

import { describe, it, expect } from 'vitest';
import { publicKey } from '@metaplex-foundation/umi';
import { fetchAsset } from '@metaplex-foundation/mpl-core';
import {
  fetchAgentIdentityV1,
  findAgentIdentityV1Pda,
  safeFetchAgentIdentityV1,
} from '@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/index.js';
import fs from 'fs';
import path from 'path';
import { AGENT_ROLES, type AgentRole } from '../../src/types/agents.js';
import { getTestUmi } from '../helpers/setup.js';

const KEYS_DIR = path.join(process.cwd(), 'keys');
const REGISTRATION_PATH = path.join(KEYS_DIR, 'registration.json');

interface RegistrationEntry {
  wallet: string;
  asset: string;
  pda: string;
  verified: boolean;
}

interface RegistrationData {
  collection: string;
  agents: Partial<Record<AgentRole, RegistrationEntry>>;
}

const registrationExists = fs.existsSync(REGISTRATION_PATH);

function loadRegistration(): RegistrationData {
  return JSON.parse(fs.readFileSync(REGISTRATION_PATH, 'utf-8'));
}

describe.skipIf(!registrationExists)('Agent Registration (IDENT-01)', () => {
  const registration = registrationExists ? loadRegistration() : null;
  const umi = getTestUmi();

  describe.each(AGENT_ROLES.map((r) => [r]))('%s', (role) => {
    it('has an MPL Core Asset on devnet', async () => {
      if (!registration) return;
      const entry = registration.agents[role as AgentRole];
      expect(entry).toBeTruthy();

      const asset = await fetchAsset(umi, publicKey(entry!.asset));
      expect(asset).toBeTruthy();
      expect(asset.publicKey).toBe(entry!.asset);
    });

    it('asset is in the AgentFund collection', async () => {
      if (!registration) return;
      const entry = registration.agents[role as AgentRole];
      expect(entry).toBeTruthy();

      const asset = await fetchAsset(umi, publicKey(entry!.asset));

      // MPL Core asset updateAuthority contains the collection reference
      expect(asset.updateAuthority).toBeTruthy();
      expect(asset.updateAuthority.type).toBe('Collection');
      if (asset.updateAuthority.type === 'Collection') {
        expect(asset.updateAuthority.address).toBe(registration.collection);
      }
    });

    it('has an AgentIdentityV1 PDA', async () => {
      if (!registration) return;
      const entry = registration.agents[role as AgentRole];
      expect(entry).toBeTruthy();

      const pda = findAgentIdentityV1Pda(umi, {
        asset: publicKey(entry!.asset),
      });
      const identity = await safeFetchAgentIdentityV1(umi, pda);

      expect(identity).not.toBeNull();
    });

    it('PDA derivation matches stored PDA address', async () => {
      if (!registration) return;
      const entry = registration.agents[role as AgentRole];
      expect(entry).toBeTruthy();

      const pda = findAgentIdentityV1Pda(umi, {
        asset: publicKey(entry!.asset),
      });

      // The derived PDA should match what was stored during registration
      expect(pda[0]).toBe(entry!.pda);
    });

    it('identity PDA references correct asset', async () => {
      if (!registration) return;
      const entry = registration.agents[role as AgentRole];
      expect(entry).toBeTruthy();

      const pda = findAgentIdentityV1Pda(umi, {
        asset: publicKey(entry!.asset),
      });
      const identity = await safeFetchAgentIdentityV1(umi, pda);

      expect(identity).not.toBeNull();
      expect(identity!.asset).toBe(entry!.asset);
    });
  });
});
