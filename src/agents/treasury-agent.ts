/**
 * Real TreasuryAgent for on-chain Solana devnet operations.
 *
 * Replaces StubTreasuryAgent with real balance tracking (SOL + USDC),
 * SPL token transfers for governance-approved grants, Meteora DLMM
 * LP position management, and treasury status reporting.
 * Implements ITreasuryAgent interface.
 *
 * Phase 5: Treasury Manager Agent (TREAS-01 through TREAS-05).
 */

import fs from 'fs';
import path from 'path';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAccount,
  transfer,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import { BaseAgent } from './base-agent.js';
import type { ITreasuryAgent } from './types.js';
import type {
  FundingAllocation,
  TransactionResult,
  TreasuryBalance,
  LPPosition,
} from '../types/proposals.js';
import type { AgentEventBus } from '../events/event-types.js';
import { DEVNET_USDC_MINT } from '../lib/solana/index.js';
import { DlmmClient } from '../lib/meteora/dlmm-client.js';

/** Cached addresses.json data */
interface AddressesData {
  deployer: string;
  agents: Record<string, { publicKey: string; ata: string | null }>;
  usdcMint: string | null;
  isDemoUSDC: boolean;
}

/**
 * Approximate SOL price in USD for treasury valuation.
 * In production this would come from an oracle or price feed.
 */
const SOL_PRICE_USD = 150;

export class TreasuryAgent extends BaseAgent implements ITreasuryAgent {
  private addressesCache: AddressesData | null = null;
  private usdcMintCache: PublicKey | null = null;

  constructor(bus: AgentEventBus) {
    super('treasury', bus);
  }

  async initialize(): Promise<void> {
    // Pre-load addresses and USDC mint
    this.loadAddresses();
    this.usdcMintCache = this.getUsdcMint();

    // Check if DLMM pool is configured
    const poolConfigured = this.hasDlmmPool();
    if (poolConfigured) {
      this.emitStatus('initialized', 'TreasuryAgent ready (DLMM pool configured)');
    } else {
      this.emitStatus('initialized', 'TreasuryAgent ready (no DLMM pool)');
    }
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'TreasuryAgent stopped');
  }

  async getBalance(): Promise<TreasuryBalance> {
    const conn = this.connection;

    // Query SOL balance
    const lamports = await conn.getBalance(this.publicKey);
    const solBalance = lamports / LAMPORTS_PER_SOL;

    // Query USDC balance via ATA
    let usdcBalance = 0;
    try {
      const usdcMint = this.getUsdcMint();
      const ataAddress = getAssociatedTokenAddressSync(usdcMint, this.publicKey);
      const account = await getAccount(conn, ataAddress);
      usdcBalance = Number(account.amount) / 1_000_000; // USDC has 6 decimals
    } catch (error: unknown) {
      if (error instanceof TokenAccountNotFoundError) {
        // ATA does not exist yet -- balance is 0
        usdcBalance = 0;
      } else {
        // Re-throw unexpected errors
        throw error;
      }
    }

    const totalValueUsd = usdcBalance + solBalance * SOL_PRICE_USD;

    // Query LP positions (graceful degradation -- empty on error)
    let lpPositions: LPPosition[] = [];
    try {
      lpPositions = await this.getLPPositions();
    } catch {
      // DLMM failure should not break treasury balance reporting
      lpPositions = [];
    }

    return {
      solBalance,
      usdcBalance,
      totalValueUsd,
      lpPositions,
    };
  }

  async executeFunding(allocation: FundingAllocation): Promise<TransactionResult> {
    // No-op for non-fund actions
    if (allocation.action !== 'fund') {
      return { success: true };
    }

    // Validate amount
    if (!allocation.amount) {
      return { success: false, error: 'No amount specified' };
    }

    this.emitStatus('funding', `Executing: ${allocation.proposalTitle}`);

    try {
      const conn = this.connection;
      const usdcMint = this.getUsdcMint();

      // Get or create source ATA (treasury's USDC account)
      const sourceAta = await getOrCreateAssociatedTokenAccount(
        conn,
        this.keypair,
        usdcMint,
        this.publicKey,
      );

      // Get recipient public key (demo: governance agent)
      const recipientPubkey = this.getRecipientPubkey();

      // Get or create destination ATA (recipient's USDC account)
      const destAta = await getOrCreateAssociatedTokenAccount(
        conn,
        this.keypair,
        usdcMint,
        recipientPubkey,
      );

      // Amount in USDC base units (6 decimals)
      const amountBaseUnits = allocation.amount * 1_000_000;

      // Execute SPL transfer
      const signature = await transfer(
        conn,
        this.keypair,
        sourceAta.address,
        destAta.address,
        this.keypair,
        amountBaseUnits,
      );

      this.emitStatus('funded', `${allocation.proposalTitle}: ${signature}`);

      return {
        success: true,
        signature: String(signature),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitStatus('funding-failed', `${allocation.proposalTitle}: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Create a new DLMM LP position with idle treasury funds.
   * Creates the pool first if it doesn't exist.
   */
  async createLPPosition(
    xAmount: number,
    yAmount: number,
  ): Promise<TransactionResult> {
    try {
      const dlmmClient = new DlmmClient(this.connection, 'devnet');
      let poolAddress = this.loadDlmmPoolAddress();

      // Create pool if not found
      if (!poolAddress) {
        const usdcMint = this.getUsdcMint();
        const solMint = new PublicKey('So11111111111111111111111111111111111111112');
        const createResult = await dlmmClient.createPool(
          solMint,
          usdcMint,
          this.keypair,
        );
        if (!createResult.success || !createResult.data) {
          return { success: false, error: createResult.error || 'Pool creation failed' };
        }
        poolAddress = createResult.data.poolAddress;
      }

      const result = await dlmmClient.addLiquidity(
        new PublicKey(poolAddress),
        this.keypair,
        xAmount,
        yAmount,
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        signature: result.signatures?.[0],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Remove all liquidity from a specific DLMM position.
   */
  async removeLPPosition(positionAddress: string): Promise<TransactionResult> {
    try {
      const poolAddress = this.loadDlmmPoolAddress();
      if (!poolAddress) {
        return { success: false, error: 'No DLMM pool configured' };
      }

      const dlmmClient = new DlmmClient(this.connection, 'devnet');
      const result = await dlmmClient.removeLiquidity(
        new PublicKey(poolAddress),
        new PublicKey(positionAddress),
        this.keypair,
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        signature: result.signatures?.[0],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Get all LP positions for the treasury in the configured DLMM pool.
   * Returns empty array if no pool is configured or on error.
   */
  async getLPPositions(): Promise<LPPosition[]> {
    try {
      const poolAddress = this.loadDlmmPoolAddress();
      if (!poolAddress) {
        return [];
      }

      const dlmmClient = new DlmmClient(this.connection, 'devnet');
      const positions = await dlmmClient.getPositions(
        new PublicKey(poolAddress),
        this.publicKey,
      );

      // Map DlmmPosition to LPPosition
      return positions.map((pos) => ({
        poolAddress: pos.poolAddress,
        positionAddress: pos.positionAddress,
        tokenX: '', // Would need pool info query for full data
        tokenY: '',
        liquidityShare: pos.liquidityShares.length,
        unclaimedFees: 0, // Would need fee query
      }));
    } catch {
      return [];
    }
  }

  /**
   * Check if a DLMM pool is configured (keys/dlmm-pool.json exists).
   */
  private hasDlmmPool(): boolean {
    const filePath = path.join(process.cwd(), 'keys', 'dlmm-pool.json');
    return fs.existsSync(filePath);
  }

  /**
   * Load the DLMM pool address from keys/dlmm-pool.json.
   * Returns null if file doesn't exist.
   */
  private loadDlmmPoolAddress(): string | null {
    try {
      const filePath = path.join(process.cwd(), 'keys', 'dlmm-pool.json');
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.poolAddress || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the USDC mint address, falling back to DEVNET_USDC_MINT if not set.
   */
  private getUsdcMint(): PublicKey {
    if (this.usdcMintCache) {
      return this.usdcMintCache;
    }

    const addresses = this.loadAddresses();
    if (addresses.usdcMint) {
      this.usdcMintCache = new PublicKey(addresses.usdcMint);
      return this.usdcMintCache;
    }

    // Fallback to devnet USDC
    this.usdcMintCache = DEVNET_USDC_MINT;
    return this.usdcMintCache;
  }

  /**
   * Get recipient public key for funding transfers.
   * For demo purposes, uses the governance agent's public key.
   * In production, this would come from the proposal data.
   */
  private getRecipientPubkey(): PublicKey {
    const addresses = this.loadAddresses();
    const governancePubkey = addresses.agents.governance?.publicKey;
    if (governancePubkey) {
      return new PublicKey(governancePubkey);
    }
    // Fallback: use deployer
    return new PublicKey(addresses.deployer);
  }

  /**
   * Load and cache addresses.json from keys directory.
   */
  private loadAddresses(): AddressesData {
    if (this.addressesCache) {
      return this.addressesCache;
    }

    const filePath = path.join(process.cwd(), 'keys', 'addresses.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    this.addressesCache = JSON.parse(data) as AddressesData;
    return this.addressesCache;
  }
}
