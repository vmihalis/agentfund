/**
 * Tests for DlmmClient (TREAS-03, TREAS-04).
 *
 * Verifies that DlmmClient wraps Meteora DLMM SDK operations:
 * pool creation, liquidity add/remove, position querying, pool info,
 * and graceful error handling. All Meteora SDK and Solana interactions
 * are mocked -- no real devnet calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import type { DlmmPosition, DlmmPoolInfo, DlmmResult } from '../../src/lib/meteora/types.js';

// --- Hoisted mock functions (available before vi.mock factories) ---

const {
  mockSendAndConfirmTransaction,
  mockGetActiveBin,
  mockInitializePositionAndAddLiquidityByStrategy,
  mockRemoveLiquidity,
  mockGetPositionsByUserAndLbPair,
  mockDlmmCreate,
  mockCreateCustomizablePermissionlessLbPair,
  mockGetCustomizablePermissionlessLbPairIfExists,
  mockGetBalance,
  mockWriteFileSync,
  mockExistsSync,
  mockMkdirSync,
  mockReadFileSync,
} = vi.hoisted(() => ({
  mockSendAndConfirmTransaction: vi.fn(),
  mockGetActiveBin: vi.fn(),
  mockInitializePositionAndAddLiquidityByStrategy: vi.fn(),
  mockRemoveLiquidity: vi.fn(),
  mockGetPositionsByUserAndLbPair: vi.fn(),
  mockDlmmCreate: vi.fn(),
  mockCreateCustomizablePermissionlessLbPair: vi.fn(),
  mockGetCustomizablePermissionlessLbPairIfExists: vi.fn(),
  mockGetBalance: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

// --- Mock modules ---

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js');
  return {
    ...actual,
    sendAndConfirmTransaction: mockSendAndConfirmTransaction,
  };
});

vi.mock('@meteora-ag/dlmm', () => {
  // Can't use PublicKey here (hoisted above imports), use a lazy approach
  return {
    default: {
      create: (...args: any[]) => mockDlmmCreate(...args),
      createCustomizablePermissionlessLbPair: (...args: any[]) =>
        mockCreateCustomizablePermissionlessLbPair(...args),
      getCustomizablePermissionlessLbPairIfExists: (...args: any[]) =>
        mockGetCustomizablePermissionlessLbPairIfExists(...args),
    },
    StrategyType: { Spot: 0 },
    ActivationType: { Timestamp: 0 },
  };
});

const mockTreasuryKeypair = Keypair.generate();

vi.mock('../../src/lib/keys.js', () => ({
  getWeb3Keypair: () => mockTreasuryKeypair,
}));

vi.mock('../../src/lib/solana/index.js', async () => {
  const { PublicKey: PK } = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js');
  return {
    getConnection: () => ({
      rpcEndpoint: 'https://mock.devnet.solana.com',
      getBalance: mockGetBalance,
    }),
    DEVNET_USDC_MINT: new PK('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      writeFileSync: mockWriteFileSync,
      existsSync: mockExistsSync,
      mkdirSync: mockMkdirSync,
      readFileSync: mockReadFileSync,
    },
  };
});

// --- Tests ---

describe('DlmmClient (TREAS-03, TREAS-04)', () => {
  let DlmmClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mock returns
    mockSendAndConfirmTransaction.mockResolvedValue('mock-dlmm-tx-sig');
    mockGetBalance.mockResolvedValue(5_000_000_000);
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');

    // Mock pool creation returns a transaction
    mockCreateCustomizablePermissionlessLbPair.mockResolvedValue({
      serialize: () => new Uint8Array(),
    });

    // Mock discovering pool address after creation
    mockGetCustomizablePermissionlessLbPairIfExists.mockResolvedValue(
      new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe'),
    );

    // Mock pool instance
    const poolInstance = {
      getActiveBin: mockGetActiveBin,
      initializePositionAndAddLiquidityByStrategy: mockInitializePositionAndAddLiquidityByStrategy,
      removeLiquidity: mockRemoveLiquidity,
      getPositionsByUserAndLbPair: mockGetPositionsByUserAndLbPair,
      pubkey: new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe'),
      lbPair: {
        tokenXMint: new PublicKey('So11111111111111111111111111111111111111112'),
        tokenYMint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
        binStep: 10,
      },
    };
    mockDlmmCreate.mockResolvedValue(poolInstance);

    // Mock getActiveBin
    mockGetActiveBin.mockResolvedValue({
      binId: 8388608,
      price: '1.0',
    });

    // Mock initializePositionAndAddLiquidityByStrategy returns a transaction
    mockInitializePositionAndAddLiquidityByStrategy.mockResolvedValue({
      serialize: () => new Uint8Array(),
    });

    // Mock removeLiquidity returns array of transactions
    mockRemoveLiquidity.mockResolvedValue([
      { serialize: () => new Uint8Array() },
    ]);

    // Mock getPositionsByUserAndLbPair
    const mockPositionPubkey = Keypair.generate().publicKey;
    mockGetPositionsByUserAndLbPair.mockResolvedValue({
      userPositions: [
        {
          publicKey: mockPositionPubkey,
          positionData: {
            positionBinData: [
              { binId: 8388598, positionLiquidity: '100' },
              { binId: 8388599, positionLiquidity: '200' },
            ],
          },
        },
      ],
    });

    // Dynamic import after mocks
    const mod = await import('../../src/lib/meteora/dlmm-client.js');
    DlmmClient = mod.DlmmClient;
  });

  describe('createPool', () => {
    it('creates a DLMM pool and returns pool address + tx signature', async () => {
      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const tokenX = new PublicKey('So11111111111111111111111111111111111111112');
      const tokenY = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

      const result: DlmmResult<{ poolAddress: string }> = await client.createPool(tokenX, tokenY, mockTreasuryKeypair);

      expect(result.success).toBe(true);
      expect(result.data?.poolAddress).toBeTruthy();
      expect(result.signatures).toBeDefined();
      expect(result.signatures!.length).toBeGreaterThan(0);
      expect(mockCreateCustomizablePermissionlessLbPair).toHaveBeenCalled();
    });

    it('handles pool creation errors gracefully', async () => {
      mockCreateCustomizablePermissionlessLbPair.mockRejectedValue(new Error('Pool creation failed'));

      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const tokenX = new PublicKey('So11111111111111111111111111111111111111112');
      const tokenY = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

      const result = await client.createPool(tokenX, tokenY, mockTreasuryKeypair);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pool creation failed');
    });
  });

  describe('addLiquidity', () => {
    it('creates an LP position with SpotBalanced strategy and returns position address + tx signature', async () => {
      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');

      const result: DlmmResult<{ positionAddress: string }> = await client.addLiquidity(
        poolAddress,
        mockTreasuryKeypair,
        1_000_000,
        1_000_000,
      );

      expect(result.success).toBe(true);
      expect(result.data?.positionAddress).toBeTruthy();
      expect(result.signatures).toBeDefined();
      expect(result.signatures!.length).toBeGreaterThan(0);
      expect(mockInitializePositionAndAddLiquidityByStrategy).toHaveBeenCalled();
    });

    it('handles addLiquidity errors gracefully', async () => {
      mockInitializePositionAndAddLiquidityByStrategy.mockRejectedValue(
        new Error('Insufficient balance'),
      );

      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');

      const result = await client.addLiquidity(poolAddress, mockTreasuryKeypair, 1_000_000, 1_000_000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });
  });

  describe('removeLiquidity', () => {
    it('removes 100% liquidity from a position with shouldClaimAndClose and returns tx signatures', async () => {
      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');
      const positionPubkey = Keypair.generate().publicKey;

      const result: DlmmResult = await client.removeLiquidity(
        poolAddress,
        positionPubkey,
        mockTreasuryKeypair,
      );

      expect(result.success).toBe(true);
      expect(result.signatures).toBeDefined();
      expect(result.signatures!.length).toBeGreaterThan(0);
      expect(mockRemoveLiquidity).toHaveBeenCalled();
    });

    it('handles removeLiquidity errors gracefully', async () => {
      mockRemoveLiquidity.mockRejectedValue(new Error('Position not found'));

      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');
      const positionPubkey = Keypair.generate().publicKey;

      const result = await client.removeLiquidity(poolAddress, positionPubkey, mockTreasuryKeypair);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Position not found');
    });
  });

  describe('getPositions', () => {
    it('returns array of position data for a user+pool pair', async () => {
      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');

      const positions: DlmmPosition[] = await client.getPositions(
        poolAddress,
        mockTreasuryKeypair.publicKey,
      );

      expect(positions).toBeInstanceOf(Array);
      expect(positions.length).toBeGreaterThan(0);
      expect(positions[0].positionAddress).toBeTruthy();
      expect(positions[0].poolAddress).toBe(poolAddress.toBase58());
      expect(positions[0].binIds).toBeInstanceOf(Array);
      expect(positions[0].liquidityShares).toBeInstanceOf(Array);
    });

    it('returns empty array when no positions exist', async () => {
      mockGetPositionsByUserAndLbPair.mockResolvedValue({
        userPositions: [],
      });

      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');

      const positions = await client.getPositions(poolAddress, mockTreasuryKeypair.publicKey);

      expect(positions).toEqual([]);
    });
  });

  describe('getPoolInfo', () => {
    it('returns active bin, bin step, and token pair info', async () => {
      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');

      const info: DlmmPoolInfo | null = await client.getPoolInfo(poolAddress);

      expect(info).not.toBeNull();
      expect(info!.poolAddress).toBe(poolAddress.toBase58());
      expect(info!.activeBinId).toBe(8388608);
      expect(info!.binStep).toBe(10);
      expect(info!.tokenX).toBeTruthy();
      expect(info!.tokenY).toBeTruthy();
    });

    it('returns null when pool is not found', async () => {
      mockDlmmCreate.mockRejectedValue(new Error('Account not found'));

      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');

      const info = await client.getPoolInfo(poolAddress);

      expect(info).toBeNull();
    });
  });

  describe('error handling', () => {
    it('all methods return error results and never throw', async () => {
      // Force all SDK methods to throw
      mockCreateCustomizablePermissionlessLbPair.mockRejectedValue(new Error('SDK error'));
      mockDlmmCreate.mockRejectedValue(new Error('SDK error'));

      const client = new DlmmClient(
        { rpcEndpoint: 'https://mock.devnet.solana.com', getBalance: mockGetBalance } as any,
        'devnet',
      );

      const tokenX = new PublicKey('So11111111111111111111111111111111111111112');
      const tokenY = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
      const poolAddress = new PublicKey('DLMMonGZa4bNWkpjsFqhvwxZ6Pqafyqrza33i8oWHCNe');
      const positionPubkey = Keypair.generate().publicKey;

      // None of these should throw
      const createResult = await client.createPool(tokenX, tokenY, mockTreasuryKeypair);
      expect(createResult.success).toBe(false);

      const addResult = await client.addLiquidity(poolAddress, mockTreasuryKeypair, 100, 100);
      expect(addResult.success).toBe(false);

      const removeResult = await client.removeLiquidity(poolAddress, positionPubkey, mockTreasuryKeypair);
      expect(removeResult.success).toBe(false);

      // getPositions returns empty on error
      const positions = await client.getPositions(poolAddress, mockTreasuryKeypair.publicKey);
      expect(positions).toEqual([]);

      // getPoolInfo returns null on error
      const info = await client.getPoolInfo(poolAddress);
      expect(info).toBeNull();
    });
  });
});
