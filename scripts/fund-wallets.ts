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

import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
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

/**
 * Transfer SOL from deployer to an agent wallet.
 * Used as fallback when devnet faucet is rate-limited (HTTP 429).
 */
async function transferSolFromDeployer(
  connection: ReturnType<typeof getConnection>,
  deployer: Keypair,
  recipient: PublicKey,
  amountSol: number,
): Promise<boolean> {
  try {
    console.log(`  Transferring ${amountSol} SOL from deployer to ${recipient.toBase58()}...`);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: deployer.publicKey,
        toPubkey: recipient,
        lamports: amountSol * LAMPORTS_PER_SOL,
      }),
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [deployer]);
    console.log(`  Transfer confirmed: ${sig}`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  Transfer failed: ${msg}`);
    return false;
  }
}

// ---- Main ----

async function main() {
  console.log('=== Fund Wallets ===\n');

  const connection = getConnection();
  const deployer = loadOrGenerateDeployer();
  const agentKeypairs = getAllWeb3Keypairs();

  // Step 1: Fund all wallets with SOL
  console.log('\n--- Step 1: SOL Funding ---\n');

  // Fund deployer first (airdrop only -- cannot self-transfer)
  const deployerBalance = await connection.getBalance(deployer.publicKey);
  const deployerSol = deployerBalance / LAMPORTS_PER_SOL;
  console.log(`deployer: ${deployerSol.toFixed(4)} SOL`);

  if (deployerSol < MIN_SOL) {
    console.log(`  Below ${MIN_SOL} SOL, requesting airdrop...`);
    let success = await airdropSol(connection, deployer.publicKey, 2);
    if (!success) {
      console.log(`  Retrying with 1 SOL...`);
      success = await airdropSol(connection, deployer.publicKey, 1);
    }
    if (success) {
      const newBalance = await connection.getBalance(deployer.publicKey);
      console.log(`  New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    } else {
      console.warn('  WARNING: Airdrop failed for deployer. May need manual funding via https://faucet.solana.com');
    }
  }

  // Fund agent wallets: try airdrop first, fall back to deployer transfer
  const AGENT_SOL_AMOUNT = 0.5; // Each agent gets 0.5 SOL (enough for tx fees)
  for (const role of AGENT_ROLES) {
    const keypair = agentKeypairs[role];
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSol = balance / LAMPORTS_PER_SOL;
    console.log(`${role}: ${balanceSol.toFixed(4)} SOL`);

    if (balanceSol < 0.1) {
      console.log(`  Below 0.1 SOL, requesting airdrop...`);
      let success = await airdropSol(connection, keypair.publicKey, 2);
      if (!success) {
        console.log(`  Retrying with 1 SOL...`);
        success = await airdropSol(connection, keypair.publicKey, 1);
      }
      if (!success) {
        // Fallback: transfer SOL from deployer
        console.log(`  Airdrop failed, falling back to deployer transfer...`);
        success = await transferSolFromDeployer(connection, deployer, keypair.publicKey, AGENT_SOL_AMOUNT);
      }
      if (success) {
        const newBalance = await connection.getBalance(keypair.publicKey);
        console.log(`  New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      } else {
        console.warn(`  WARNING: Could not fund ${role}. Both airdrop and transfer failed.`);
      }
    }
  }

  // Step 2: Create USDC ATAs
  console.log('\n--- Step 2: USDC Token Accounts ---\n');

  // Check deployer has SOL to pay for token operations
  const deployerBalanceForTokens = await connection.getBalance(deployer.publicKey);
  if (deployerBalanceForTokens === 0) {
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
  let isDemoUSDC = true;

  // Always use DEMO_USDC so we can mint tokens for testing.
  // Official devnet USDC exists but we cannot mint from it,
  // making it unusable for x402 payment integration tests.
  const existingDemoMint = loadDemoUsdcMint();
  if (existingDemoMint) {
    console.log(`Using existing DEMO_USDC mint: ${existingDemoMint.toBase58()}`);
    usdcMint = existingDemoMint;
  } else {
    console.log('Creating DEMO_USDC mint (deployer as mint authority)...');
    usdcMint = await createDemoUSDCMint(connection, deployer);
    saveDemoUsdcMint(usdcMint);
    console.log(`DEMO_USDC mint created: ${usdcMint.toBase58()}`);
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
