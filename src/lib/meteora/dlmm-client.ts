/**
 * Meteora DLMM pool interaction wrapper.
 *
 * Wraps the @meteora-ag/dlmm SDK for creating pools, adding/removing
 * liquidity, and querying positions. All methods handle errors gracefully
 * and never throw -- they return DlmmResult with success/error fields.
 *
 * Phase 5 Plan 2: TREAS-03, TREAS-04.
 */

import fs from 'fs';
import path from 'path';
import {
  type Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import DLMM, { StrategyType, ActivationType } from '@meteora-ag/dlmm';
import BN from 'bn.js';
import type { DlmmPosition, DlmmPoolInfo, DlmmResult } from './types.js';

/** Number of bins on each side of the active bin for LP positions. */
const BINS_EACH_SIDE = 10;

/** Default bin step for pool creation (0.10% per bin). */
const DEFAULT_BIN_STEP = 10;

/** Center bin ID for pool creation. */
const DEFAULT_ACTIVE_ID = 8388608;

/** Default fee in basis points (0.25%). */
const DEFAULT_FEE_BPS = 25;

export class DlmmClient {
  private readonly connection: Connection;
  private readonly cluster: 'devnet' | 'mainnet-beta';

  constructor(connection: Connection, cluster: 'devnet' | 'mainnet-beta') {
    this.connection = connection;
    this.cluster = cluster;
  }

  /**
   * Create a new DLMM pool with the given token pair.
   * Saves pool address to keys/dlmm-pool.json.
   */
  async createPool(
    tokenX: PublicKey,
    tokenY: PublicKey,
    creator: Keypair,
  ): Promise<DlmmResult<{ poolAddress: string }>> {
    try {
      const binStep = new BN(DEFAULT_BIN_STEP);
      const activeId = new BN(DEFAULT_ACTIVE_ID);
      const feeBps = new BN(DEFAULT_FEE_BPS);
      const activationPoint = new BN(0); // Immediate activation

      const tx = await DLMM.createCustomizablePermissionlessLbPair(
        this.connection,
        binStep,
        tokenX,
        tokenY,
        activeId,
        feeBps,
        ActivationType.Timestamp,
        false, // no alpha vault
        creator.publicKey,
        activationPoint,
        false, // no creator control
        { cluster: this.cluster },
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [creator],
      );

      // Discover pool address after creation
      const poolKey = await DLMM.getCustomizablePermissionlessLbPairIfExists(
        this.connection,
        tokenX,
        tokenY,
        { cluster: this.cluster },
      );

      const poolAddress = poolKey instanceof PublicKey
        ? poolKey.toBase58()
        : String(poolKey);

      // Persist pool address
      this.savePoolAddress(poolAddress);

      return {
        success: true,
        data: { poolAddress },
        signatures: [String(signature)],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Add liquidity to a DLMM pool using SpotBalanced strategy.
   * Creates a new position keypair and saves it to keys/dlmm-positions/.
   */
  async addLiquidity(
    poolAddress: PublicKey,
    user: Keypair,
    xAmount: number,
    yAmount: number,
  ): Promise<DlmmResult<{ positionAddress: string }>> {
    try {
      const dlmmPool = await DLMM.create(this.connection, poolAddress, {
        cluster: this.cluster,
      });

      const activeBin = await dlmmPool.getActiveBin();
      const positionKeypair = Keypair.generate();

      const strategy = {
        strategyType: StrategyType.Spot,
        minBinId: activeBin.binId - BINS_EACH_SIDE,
        maxBinId: activeBin.binId + BINS_EACH_SIDE,
      };

      const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: positionKeypair.publicKey,
        totalXAmount: new BN(xAmount),
        totalYAmount: new BN(yAmount),
        strategy,
        user: user.publicKey,
        slippage: 1,
      });

      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [user, positionKeypair],
      );

      // Persist position keypair
      this.savePositionKeypair(positionKeypair);

      return {
        success: true,
        data: { positionAddress: positionKeypair.publicKey.toBase58() },
        signatures: [String(signature)],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Remove 100% liquidity from a position with shouldClaimAndClose.
   * Sends all returned transactions sequentially.
   */
  async removeLiquidity(
    poolAddress: PublicKey,
    positionPubkey: PublicKey,
    user: Keypair,
  ): Promise<DlmmResult> {
    try {
      const dlmmPool = await DLMM.create(this.connection, poolAddress, {
        cluster: this.cluster,
      });

      // Get position info to determine bin range
      const positions = await dlmmPool.getPositionsByUserAndLbPair(user.publicKey);
      const position = positions.userPositions.find(
        (p: any) => p.publicKey.toBase58() === positionPubkey.toBase58(),
      );

      // Derive bin range from position or use defaults
      let fromBinId = DEFAULT_ACTIVE_ID - BINS_EACH_SIDE;
      let toBinId = DEFAULT_ACTIVE_ID + BINS_EACH_SIDE;

      if (position?.positionData?.positionBinData?.length) {
        const binData = position.positionData.positionBinData;
        fromBinId = binData[0].binId;
        toBinId = binData[binData.length - 1].binId;
      }

      const txs = await dlmmPool.removeLiquidity({
        user: user.publicKey,
        position: positionPubkey,
        fromBinId,
        toBinId,
        bps: new BN(10000), // 100%
        shouldClaimAndClose: true,
      });

      // Handle single tx or array of txs
      const txArray = Array.isArray(txs) ? txs : [txs];
      const signatures: string[] = [];

      for (const tx of txArray) {
        const sig = await sendAndConfirmTransaction(
          this.connection,
          tx,
          [user],
        );
        signatures.push(String(sig));
      }

      return {
        success: true,
        signatures,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Get all positions for a user in a specific pool.
   * Returns empty array on error (graceful degradation).
   */
  async getPositions(
    poolAddress: PublicKey,
    userPubkey: PublicKey,
  ): Promise<DlmmPosition[]> {
    try {
      const dlmmPool = await DLMM.create(this.connection, poolAddress, {
        cluster: this.cluster,
      });

      const result = await dlmmPool.getPositionsByUserAndLbPair(userPubkey);

      return result.userPositions.map((pos: any) => ({
        positionAddress: pos.publicKey.toBase58(),
        poolAddress: poolAddress.toBase58(),
        binIds: pos.positionData.positionBinData.map((b: any) => b.binId),
        liquidityShares: pos.positionData.positionBinData.map(
          (b: any) => String(b.positionLiquidity),
        ),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get pool info including active bin, bin step, and token mints.
   * Returns null if pool is not found (graceful degradation).
   */
  async getPoolInfo(poolAddress: PublicKey): Promise<DlmmPoolInfo | null> {
    try {
      const dlmmPool = await DLMM.create(this.connection, poolAddress, {
        cluster: this.cluster,
      });

      const activeBin = await dlmmPool.getActiveBin();

      return {
        poolAddress: poolAddress.toBase58(),
        tokenX: dlmmPool.lbPair.tokenXMint.toBase58(),
        tokenY: dlmmPool.lbPair.tokenYMint.toBase58(),
        activeBinId: activeBin.binId,
        binStep: dlmmPool.lbPair.binStep,
      };
    } catch {
      return null;
    }
  }

  /**
   * Persist pool address to keys/dlmm-pool.json.
   */
  private savePoolAddress(poolAddress: string): void {
    try {
      const keysDir = path.join(process.cwd(), 'keys');
      if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
      }
      const filePath = path.join(keysDir, 'dlmm-pool.json');
      fs.writeFileSync(filePath, JSON.stringify({ poolAddress }, null, 2));
    } catch {
      // Non-critical: log but don't fail the operation
    }
  }

  /**
   * Persist position keypair to keys/dlmm-positions/{pubkey}.json.
   */
  private savePositionKeypair(keypair: Keypair): void {
    try {
      const positionsDir = path.join(process.cwd(), 'keys', 'dlmm-positions');
      if (!fs.existsSync(positionsDir)) {
        fs.mkdirSync(positionsDir, { recursive: true });
      }
      const filePath = path.join(
        positionsDir,
        `${keypair.publicKey.toBase58()}.json`,
      );
      fs.writeFileSync(
        filePath,
        JSON.stringify(Array.from(keypair.secretKey)),
      );
    } catch {
      // Non-critical: log but don't fail the operation
    }
  }
}
