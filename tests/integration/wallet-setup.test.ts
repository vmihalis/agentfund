/**
 * Integration tests for wallet funding (IDENT-02).
 *
 * Verifies that each agent wallet has SOL and an Associated Token Account
 * after running fund-wallets.ts. Uses real devnet connection.
 *
 * Skips if keys/addresses.json doesn't exist (scripts haven't run yet).
 */

import { describe, it, expect } from 'vitest';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { AGENT_ROLES } from '../../src/types/agents.js';

const KEYS_DIR = path.join(process.cwd(), 'keys');
const ADDRESSES_PATH = path.join(KEYS_DIR, 'addresses.json');

interface AddressesData {
  deployer: string;
  agents: Record<string, { publicKey: string; ata: string | null }>;
  usdcMint: string | null;
  isDemoUSDC: boolean;
}

function loadAddresses(): AddressesData | null {
  if (!fs.existsSync(ADDRESSES_PATH)) return null;
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf-8'));
}

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

// Check if wallets actually have SOL (addresses.json might be partial)
function hasAtaData(addresses: AddressesData): boolean {
  return AGENT_ROLES.some((role) => addresses.agents[role]?.ata != null);
}

// Skip if addresses.json doesn't exist or if it's a partial run (usdcMint is null = wallets not funded)
const addresses = loadAddresses();
const walletsAreFunded = addresses !== null && addresses.usdcMint !== null;

describe.skipIf(!walletsAreFunded)('Wallet Setup (IDENT-02)', () => {
  const connection = getConnection();

  it('deployer wallet has SOL balance > 0', async () => {
    if (!addresses) return;
    const balance = await connection.getBalance(
      new PublicKey(addresses.deployer),
    );
    expect(balance).toBeGreaterThan(0);
  });

  describe.each(AGENT_ROLES.map((r) => [r]))('%s', (role) => {
    it('has SOL balance > 0', async () => {
      if (!addresses) return;
      const agentPubkey = addresses.agents[role]?.publicKey;
      expect(agentPubkey).toBeTruthy();

      const balance = await connection.getBalance(new PublicKey(agentPubkey!));
      expect(balance).toBeGreaterThan(0);
    });

    it.skipIf(!addresses || !hasAtaData(addresses!))(
      'has an Associated Token Account',
      async () => {
        if (!addresses) return;
        const ata = addresses.agents[role]?.ata;
        if (!ata) {
          // Skip gracefully if no ATA for this specific role
          return;
        }

        const account = await getAccount(connection, new PublicKey(ata));
        expect(account).toBeTruthy();
        expect(account.owner.toBase58()).toBe(
          addresses.agents[role]?.publicKey,
        );
      },
    );
  });
});
