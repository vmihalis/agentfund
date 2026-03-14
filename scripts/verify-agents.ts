/**
 * Diagnostic verification of all agents on-chain.
 *
 * Reads registration data from keys/registration.json and verifies:
 * 1. Wallet SOL balance > 0
 * 2. ATA exists and has token balance
 * 3. Core Asset exists on-chain
 * 4. AgentIdentityV1 PDA exists and is verified
 *
 * Prints a PASS/FAIL summary for each agent.
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { publicKey } from '@metaplex-foundation/umi';
import { fetchAsset } from '@metaplex-foundation/mpl-core';
import fs from 'fs';
import path from 'path';
import { AGENT_ROLES, type AgentRole } from '../src/types/agents.js';
import { getConnection } from '../src/lib/solana/connection.js';
import { getUmi } from '../src/lib/metaplex/umi.js';
import { verifyAgentIdentity } from '../src/lib/metaplex/identity.js';

const KEYS_DIR = path.join(process.cwd(), 'keys');

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

interface AddressesData {
  deployer: string;
  agents: Record<string, { publicKey: string; ata: string | null }>;
  usdcMint: string | null;
  isDemoUSDC: boolean;
}

type CheckResult = 'PASS' | 'FAIL' | 'SKIP';

async function main() {
  console.log('=== Verify Agents ===\n');

  // Load registration data
  const registrationPath = path.join(KEYS_DIR, 'registration.json');
  if (!fs.existsSync(registrationPath)) {
    console.error('ERROR: keys/registration.json not found. Run register-agents first.');
    process.exit(1);
  }

  const registration: RegistrationData = JSON.parse(
    fs.readFileSync(registrationPath, 'utf-8'),
  );

  // Load addresses data (optional, for ATA checks)
  const addressesPath = path.join(KEYS_DIR, 'addresses.json');
  let addresses: AddressesData | null = null;
  if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));
  }

  const connection = getConnection();
  const umi = getUmi();

  let totalPassed = 0;
  let totalAgents = 0;

  for (const role of AGENT_ROLES) {
    const entry = registration.agents[role];
    if (!entry) {
      console.log(`${role}: NOT REGISTERED\n`);
      continue;
    }

    totalAgents++;
    const checks: Record<string, CheckResult> = {};
    let allPassed = true;

    console.log(`--- ${role} ---`);
    console.log(`  Wallet: ${entry.wallet}`);
    console.log(`  Asset:  ${entry.asset}`);
    console.log(`  PDA:    ${entry.pda}`);

    // Check 1: Wallet SOL balance > 0
    try {
      const balance = await connection.getBalance(new PublicKey(entry.wallet));
      const balanceSol = balance / LAMPORTS_PER_SOL;
      checks['SOL Balance'] = balanceSol > 0 ? 'PASS' : 'FAIL';
      console.log(`  SOL Balance: ${balanceSol.toFixed(4)} SOL [${checks['SOL Balance']}]`);
    } catch (error) {
      checks['SOL Balance'] = 'FAIL';
      console.log(`  SOL Balance: ERROR [FAIL]`);
    }

    // Check 2: ATA exists and has token balance
    if (addresses?.agents[role]?.ata) {
      try {
        const ata = new PublicKey(addresses.agents[role].ata!);
        const account = await getAccount(connection, ata);
        const tokenBalance = Number(account.amount) / 1_000_000;
        checks['Token ATA'] = tokenBalance > 0 ? 'PASS' : 'FAIL';
        console.log(`  Token ATA: ${tokenBalance.toFixed(2)} tokens [${checks['Token ATA']}]`);
      } catch {
        checks['Token ATA'] = 'FAIL';
        console.log(`  Token ATA: ERROR [FAIL]`);
      }
    } else {
      checks['Token ATA'] = 'SKIP';
      console.log(`  Token ATA: no ATA configured [SKIP]`);
    }

    // Check 3: Core Asset exists on-chain
    try {
      const asset = await fetchAsset(umi, publicKey(entry.asset));
      checks['Core Asset'] = asset ? 'PASS' : 'FAIL';
      console.log(`  Core Asset: ${asset.name} [${checks['Core Asset']}]`);
    } catch {
      checks['Core Asset'] = 'FAIL';
      console.log(`  Core Asset: not found [FAIL]`);
    }

    // Check 4: AgentIdentityV1 PDA exists
    try {
      const result = await verifyAgentIdentity(umi, publicKey(entry.asset));
      checks['Identity PDA'] = result.verified ? 'PASS' : 'FAIL';
      console.log(`  Identity PDA: ${result.verified ? 'verified' : 'not verified'} [${checks['Identity PDA']}]`);
    } catch {
      checks['Identity PDA'] = 'FAIL';
      console.log(`  Identity PDA: ERROR [FAIL]`);
    }

    // Determine overall status (SKIP doesn't count as fail)
    const criticalChecks = ['SOL Balance', 'Core Asset', 'Identity PDA'];
    const agentPassed = criticalChecks.every(
      (check) => checks[check] === 'PASS',
    );

    if (agentPassed) {
      totalPassed++;
    } else {
      allPassed = false;
    }

    console.log(`  Overall: ${agentPassed ? 'PASS' : 'FAIL'}\n`);
  }

  // Summary
  console.log('=== Summary ===\n');
  console.log(`Collection: ${registration.collection}`);
  console.log(`Agents verified: ${totalPassed}/${totalAgents}`);

  if (totalPassed === totalAgents && totalAgents === 4) {
    console.log('\nAll 4 agents fully verified on devnet!');
  } else if (totalPassed === 0) {
    console.log('\nNo agents verified. Run fund-wallets and register-agents first.');
  } else {
    console.log(`\n${totalPassed} of ${totalAgents} agents passed. Check failures above.`);
  }
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
