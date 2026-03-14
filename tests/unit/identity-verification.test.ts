/**
 * Unit tests for agent identity PDA derivation.
 *
 * Covers IDENT-03: Agent identities verifiable by any third party
 * via PDA derivation. These are pure local computation tests --
 * no devnet connection needed.
 */

import { describe, it, expect } from 'vitest';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplAgentIdentity } from '@metaplex-foundation/mpl-agent-registry';
import { findAgentIdentityV1Pda } from '@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/index.js';
import { generateSigner } from '@metaplex-foundation/umi';

function createTestUmi() {
  // No real RPC connection needed -- PDA derivation is local
  return createUmi('https://api.devnet.solana.com').use(mplAgentIdentity());
}

describe('AgentIdentityV1 PDA derivation', () => {
  it('returns a consistent PDA for the same asset pubkey', () => {
    const umi = createTestUmi();
    const asset = generateSigner(umi);

    const pda1 = findAgentIdentityV1Pda(umi, { asset: asset.publicKey });
    const pda2 = findAgentIdentityV1Pda(umi, { asset: asset.publicKey });

    expect(pda1[0]).toBe(pda2[0]);
    expect(pda1[1]).toBe(pda2[1]);
  });

  it('PDA derivation is deterministic (same input = same output)', () => {
    const umi1 = createTestUmi();
    const umi2 = createTestUmi();
    const asset = generateSigner(umi1);

    const pdaFromUmi1 = findAgentIdentityV1Pda(umi1, { asset: asset.publicKey });
    const pdaFromUmi2 = findAgentIdentityV1Pda(umi2, { asset: asset.publicKey });

    expect(pdaFromUmi1[0]).toBe(pdaFromUmi2[0]);
    expect(pdaFromUmi1[1]).toBe(pdaFromUmi2[1]);
  });

  it('different asset pubkeys produce different PDAs', () => {
    const umi = createTestUmi();
    const asset1 = generateSigner(umi);
    const asset2 = generateSigner(umi);

    const pda1 = findAgentIdentityV1Pda(umi, { asset: asset1.publicKey });
    const pda2 = findAgentIdentityV1Pda(umi, { asset: asset2.publicKey });

    expect(pda1[0]).not.toBe(pda2[0]);
  });

  it('PDA is a valid public key string', () => {
    const umi = createTestUmi();
    const asset = generateSigner(umi);

    const pda = findAgentIdentityV1Pda(umi, { asset: asset.publicKey });

    // PDA address should be a base58 string
    expect(typeof pda[0]).toBe('string');
    expect(pda[0].length).toBeGreaterThan(30);
    expect(pda[0].length).toBeLessThanOrEqual(44);

    // Bump should be a number between 0 and 255
    expect(typeof pda[1]).toBe('number');
    expect(pda[1]).toBeGreaterThanOrEqual(0);
    expect(pda[1]).toBeLessThanOrEqual(255);
  });
});
