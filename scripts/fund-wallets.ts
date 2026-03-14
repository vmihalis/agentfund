/**
 * Fund all agent wallets and deployer with SOL and create USDC ATAs.
 *
 * Steps:
 * 1. Load or generate deployer keypair
 * 2. Airdrop SOL to deployer + 4 agents (if below 2 SOL)
 * 3. Create USDC Associated Token Accounts (fallback to DEMO_USDC)
 * 4. Save addresses.json with all public keys and ATA addresses
 *
 * Idempotent: re-running skips already-funded wallets and existing ATAs.
 */

import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { AGENT_ROLES, type AgentRole } from '../src/types/agents.js';
import { getConnection } from '../src/lib/solana/connection.js';
import { airdropSol } from '../src/lib/solana/airdrop.js';
import {
  createDemoUSDCMint,
  mintDemoUSDC,
  DEVNET_USDC_MINT,
} from '../src/lib/solana/token-accounts.js';
import { getAllWeb3Keypairs } from '../src/lib/keys.js';

const KEYS_DIR = path.join(process.cwd(), 'keys');
const MIN_SOL = 2;

// ---- Helpers ----

function loadOrGenerateDeployer(): Keypair {
  const filePath = path.join(KEYS_DIR, 'deployer.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const kp = Keypair.fromSecretKey(new Uint8Array(data));
    console.log(`[skip] deployer: ${kp.publicKey.toBase58()} (already exists)`);
    return kp;
  }

  const kp = Keypair.generate();
  fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`[new]  deployer: ${kp.publicKey.toBase58()}`);
  return kp;
}

function loadDemoUsdcMint(): PublicKey | null {
  const filePath = path.join(KEYS_DIR, 'demo-usdc-mint.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return new PublicKey(data.mint);
  }
  return null;
}

function saveDemoUsdcMint(mint: PublicKey): void {
  const filePath = path.join(KEYS_DIR, 'demo-usdc-mint.json');
  fs.writeFileSync(
    filePath,
    JSON.stringify({ mint: mint.toBase58() }, null, 2),
  );
}

// ---- Main ----

async function main() {
  console.log('=== Fund Wallets ===\n');

  const connection = getConnection();
  const deployer = loadOrGenerateDeployer();
  const agentKeypairs = getAllWeb3Keypairs();

  // Step 1: Fund all wallets with SOL
  console.log('\n--- Step 1: SOL Funding ---\n');

  const allWallets: Array<{ label: string; keypair: Keypair }> = [
    { label: 'deployer', keypair: deployer },
    ...AGENT_ROLES.map((role) => ({ label: role, keypair: agentKeypairs[role] })),
  ];

  for (const { label, keypair } of allWallets) {
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSol = balance / LAMPORTS_PER_SOL;
    console.log(`${label}: ${balanceSol.toFixed(4)} SOL`);

    if (balanceSol < MIN_SOL) {
      console.log(`  Below ${MIN_SOL} SOL, requesting airdrop...`);
      // Try 2 SOL first, fall back to 1 SOL if rate-limited
      let success = await airdropSol(connection, keypair.publicKey, 2);
      if (!success) {
        console.log(`  Retrying with 1 SOL...`);
        success = await airdropSol(connection, keypair.publicKey, 1);
      }
      if (success) {
        const newBalance = await connection.getBalance(keypair.publicKey);
        console.log(`  New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      } else {
        console.warn(`  WARNING: Airdrop failed for ${label}. May need manual funding via https://faucet.solana.com`);
      }
    }
  }

  // Step 2: Create USDC ATAs
  console.log('\n--- Step 2: USDC Token Accounts ---\n');

  // Check deployer has SOL to pay for token operations
  const deployerBalance = await connection.getBalance(deployer.publicKey);
  if (deployerBalance === 0) {
    console.warn('WARNING: Deployer has 0 SOL. Skipping token account creation.');
    console.warn('Fund deployer manually at https://faucet.solana.com then re-run.');

    // Still save partial addresses.json
    const addresses = {
      deployer: deployer.publicKey.toBase58(),
      agents: Object.fromEntries(
        AGENT_ROLES.map((role) => [
          role,
          {
            publicKey: agentKeypairs[role].publicKey.toBase58(),
            ata: null,
          },
        ]),
      ),
      usdcMint: null,
      isDemoUSDC: false,
    };
    const addressesPath = path.join(KEYS_DIR, 'addresses.json');
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`Partial addresses saved to ${addressesPath}`);
    console.log('\n=== Fund Wallets Complete (partial - needs SOL) ===');
    return;
  }

  let usdcMint: PublicKey;
  let isDemoUSDC = false;

  // Check for existing DEMO_USDC mint from prior run
  const existingDemoMint = loadDemoUsdcMint();
  if (existingDemoMint) {
    console.log(`Using existing DEMO_USDC mint: ${existingDemoMint.toBase58()}`);
    usdcMint = existingDemoMint;
    isDemoUSDC = true;
  } else {
    // Try official devnet USDC first
    try {
      const accountInfo = await connection.getAccountInfo(DEVNET_USDC_MINT);
      if (accountInfo) {
        console.log(`Using official devnet USDC: ${DEVNET_USDC_MINT.toBase58()}`);
        usdcMint = DEVNET_USDC_MINT;

        // Try creating an ATA to verify it works
        await getOrCreateAssociatedTokenAccount(
          connection,
          deployer,
          usdcMint,
          deployer.publicKey,
        );
        console.log('Official USDC ATA test: OK');
      } else {
        throw new Error('USDC mint account not found on devnet');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`Official USDC unavailable (${msg}), creating DEMO_USDC...`);

      usdcMint = await createDemoUSDCMint(connection, deployer);
      saveDemoUsdcMint(usdcMint);
      isDemoUSDC = true;
      console.log(`DEMO_USDC mint created: ${usdcMint.toBase58()}`);
    }
  }

  // Create ATAs for all 4 agents
  const atas: Record<string, string> = {};

  for (const role of AGENT_ROLES) {
    const agentPubkey = agentKeypairs[role].publicKey;
    console.log(`\nCreating ATA for ${role} (${agentPubkey.toBase58()})...`);

    try {
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        deployer,
        usdcMint,
        agentPubkey,
      );
      atas[role] = ata.address.toBase58();
      console.log(`  ATA: ${ata.address.toBase58()}`);

      // Mint DEMO_USDC if applicable
      if (isDemoUSDC) {
        const currentAmount = Number(ata.amount);
        if (currentAmount < 1_000_000_000) {
          // Less than 1000 tokens
          const mintAmount = 1000; // 1000 DEMO_USDC
          await mintDemoUSDC(connection, deployer, usdcMint, ata.address, mintAmount);
          console.log(`  Minted ${mintAmount} DEMO_USDC`);
        } else {
          console.log(
            `  Already has ${(currentAmount / 1_000_000).toFixed(2)} DEMO_USDC`,
          );
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  ERROR creating ATA for ${role}: ${msg}`);
    }
  }

  // Step 3: Save addresses.json
  console.log('\n--- Step 3: Save Addresses ---\n');

  const addresses = {
    deployer: deployer.publicKey.toBase58(),
    agents: Object.fromEntries(
      AGENT_ROLES.map((role) => [
        role,
        {
          publicKey: agentKeypairs[role].publicKey.toBase58(),
          ata: atas[role] || null,
        },
      ]),
    ),
    usdcMint: usdcMint.toBase58(),
    isDemoUSDC,
  };

  const addressesPath = path.join(KEYS_DIR, 'addresses.json');
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`Addresses saved to ${addressesPath}`);
  console.log(JSON.stringify(addresses, null, 2));

  console.log('\n=== Fund Wallets Complete ===');
}

main().catch((error) => {
  console.error('Fund wallets failed:', error);
  process.exit(1);
});
