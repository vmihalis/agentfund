/**
 * Unit tests for dashboard agent data mapping logic.
 *
 * Tests the pure functions in dashboard/src/lib/agents.ts
 * without needing the Next.js runtime.
 */

import { describe, it, expect } from 'vitest';
import {
  mapAgentInfos,
  buildFallbackAgents,
  buildSolscanUrl,
  AGENT_ROLES,
  type AddressesFile,
  type RegistrationFile,
} from '../../dashboard/src/lib/agents.js';

const MOCK_ADDRESSES: AddressesFile = {
  deployer: '7GuLR4JgmxsQJAGz3poeCy9Gsp2jUyWntwigZy4iLD8X',
  agents: {
    scout: { publicKey: 'EMKvtgEGf91t4voCE7bF4MgCYU46ubJiRjJn9jmRRcej', ata: null },
    analyzer: { publicKey: 'DeUfaAWhauYzPQNetQF8NHDFY8hiQXazE4HYBBAwFMfu', ata: null },
    treasury: { publicKey: '7vmyrNkxfegeT3146qr1mf9CZ3s8zYt1kfcgRrqgst9L', ata: null },
    governance: { publicKey: '2pVL2sZ4oMKh9J3tDHvrdfUxcf4JBVxi3F8pfzFUb2PB', ata: null },
  },
  usdcMint: null,
  isDemoUSDC: false,
};

describe('Dashboard Agents API', () => {
  describe('mapAgentInfos', () => {
    it('returns exactly 4 agents', () => {
      const agents = mapAgentInfos(MOCK_ADDRESSES);
      expect(agents).toHaveLength(4);
    });

    it('returns agents with all required fields', () => {
      const agents = mapAgentInfos(MOCK_ADDRESSES);
      for (const agent of agents) {
        expect(agent).toHaveProperty('role');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('description');
        expect(agent).toHaveProperty('publicKey');
        expect(agent).toHaveProperty('solscanUrl');
        expect(typeof agent.role).toBe('string');
        expect(typeof agent.name).toBe('string');
        expect(typeof agent.description).toBe('string');
        expect(typeof agent.publicKey).toBe('string');
        expect(typeof agent.solscanUrl).toBe('string');
      }
    });

    it('returns roles matching expected order', () => {
      const agents = mapAgentInfos(MOCK_ADDRESSES);
      const roles = agents.map((a) => a.role);
      expect(roles).toEqual(['scout', 'analyzer', 'treasury', 'governance']);
    });

    it('constructs Solscan URLs with devnet cluster', () => {
      const agents = mapAgentInfos(MOCK_ADDRESSES);
      for (const agent of agents) {
        expect(agent.solscanUrl).toContain('?cluster=devnet');
        expect(agent.solscanUrl).toContain('solscan.io/address/');
      }
    });

    it('maps correct public keys from addresses.json', () => {
      const agents = mapAgentInfos(MOCK_ADDRESSES);
      const scout = agents.find((a) => a.role === 'scout');
      expect(scout?.publicKey).toBe('EMKvtgEGf91t4voCE7bF4MgCYU46ubJiRjJn9jmRRcej');
    });

    it('includes Metaplex identity when registration data provided', () => {
      const registration: RegistrationFile = {
        collection: 'GiFvKqVPgErAVq33pEahede6HNvSPhpU4bRGWYAj5UTT',
        agents: {
          scout: {
            wallet: 'EMKvtgEGf91t4voCE7bF4MgCYU46ubJiRjJn9jmRRcej',
            asset: '5pnXE29npUpdz1eHKGGHiWkqxF4TnSWsBLDHQ1ErCBDt',
            pda: 'GFrGJiHtadUWVu3Vzt7cNwkCGAuLwRZiTGsg2wcfTe9r',
            verified: true,
          },
        },
      };
      const agents = mapAgentInfos(MOCK_ADDRESSES, registration);
      const scout = agents.find((a) => a.role === 'scout');
      expect(scout?.metaplex).toBeDefined();
      expect(scout?.metaplex?.verified).toBe(true);
      expect(scout?.metaplex?.assetAddress).toBe('5pnXE29npUpdz1eHKGGHiWkqxF4TnSWsBLDHQ1ErCBDt');
      expect(scout?.metaplex?.pdaAddress).toBe('GFrGJiHtadUWVu3Vzt7cNwkCGAuLwRZiTGsg2wcfTe9r');
      expect(scout?.metaplex?.collectionAddress).toBe('GiFvKqVPgErAVq33pEahede6HNvSPhpU4bRGWYAj5UTT');
      expect(scout?.metaplex?.assetUrl).toContain('solscan.io');
      expect(scout?.metaplex?.pdaUrl).toContain('solscan.io');
    });

    it('returns undefined metaplex when no registration provided', () => {
      const agents = mapAgentInfos(MOCK_ADDRESSES);
      for (const agent of agents) {
        expect(agent.metaplex).toBeUndefined();
      }
    });
  });

  describe('buildFallbackAgents', () => {
    it('returns 4 agents with unknown keys', () => {
      const agents = buildFallbackAgents();
      expect(agents).toHaveLength(4);
      for (const agent of agents) {
        expect(agent.publicKey).toBe('unknown');
      }
    });
  });

  describe('buildSolscanUrl', () => {
    it('constructs correct devnet URL', () => {
      const url = buildSolscanUrl('ABC123');
      expect(url).toBe('https://solscan.io/address/ABC123?cluster=devnet');
    });
  });

  describe('AGENT_ROLES', () => {
    it('contains exactly 4 roles', () => {
      expect(AGENT_ROLES).toHaveLength(4);
      expect(AGENT_ROLES).toEqual(['scout', 'analyzer', 'treasury', 'governance']);
    });
  });
});
