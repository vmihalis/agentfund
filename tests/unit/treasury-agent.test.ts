/**
 * Tests for TreasuryAgent (TREAS-01, TREAS-02, TREAS-05).
 *
 * Verifies that getBalance returns real-format SOL and USDC balances,
 * executeFunding produces transaction signatures for "fund" actions,
 * handles errors gracefully, and emits agent:status events.
 * All Solana interactions are mocked -- no real devnet calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TypedEventBus } from '../../src/events/event-bus.js';
import type { AgentEvents } from '../../src/events/event-types.js';
import type { ITreasuryAgent } from '../../src/agents/types.js';
import type { FundingAllocation } from '../../src/types/proposals.js';

// --- Mocks ---

const mockTreasuryKeypair = Keypair.generate();
const mockGovernanceKeypair = Keypair.generate();

// Mock the keys module
vi.mock('../../src/lib/keys.js', () => {
  const mockKeypairs: Record<string, Keypair> = {
    scout: Keypair.generate(),
    analyzer: Keypair.generate(),
    treasury: mockTreasuryKeypair,
    governance: mockGovernanceKeypair,
  };
  return {
    getWeb3Keypair: (role: string) => mockKeypairs[role],
  };
});

// Mock the solana connection module
const mockGetBalance = vi.fn();
vi.mock('../../src/lib/solana/index.js', () => ({
  getConnection: () => ({
    rpcEndpoint: 'https://mock.devnet.solana.com',
    getBalance: mockGetBalance,
  }),
  DEVNET_USDC_MINT: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
}));

// Mock @solana/spl-token
const mockGetAccount = vi.fn();
const mockTransfer = vi.fn();
const mockGetOrCreateATA = vi.fn();

vi.mock('@solana/spl-token', () => {
  return {
    getAccount: mockGetAccount,
    transfer: mockTransfer,
    getOrCreateAssociatedTokenAccount: mockGetOrCreateATA,
    getAssociatedTokenAddressSync: vi.fn().mockReturnValue(
      new PublicKey('11111111111111111111111111111111'),
    ),
    TokenAccountNotFoundError: class TokenAccountNotFoundError extends Error {
      constructor() {
        super('TokenAccountNotFoundError');
        this.name = 'TokenAccountNotFoundError';
      }
    },
  };
});

// Mock fs for addresses.json
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      readFileSync: vi.fn((filePath: string, encoding?: string) => {
        if (typeof filePath === 'string' && filePath.includes('addresses.json')) {
          return JSON.stringify({
            deployer: '7GuLR4JgmxsQJAGz3poeCy9Gsp2jUyWntwigZy4iLD8X',
            agents: {
              scout: { publicKey: 'EMKvtgEGf91t4voCE7bF4MgCYU46ubJiRjJn9jmRRcej', ata: null },
              analyzer: { publicKey: 'DeUfaAWhauYzPQNetQF8NHDFY8hiQXazE4HYBBAwFMfu', ata: null },
              treasury: { publicKey: mockTreasuryKeypair.publicKey.toBase58(), ata: null },
              governance: { publicKey: mockGovernanceKeypair.publicKey.toBase58(), ata: null },
            },
            usdcMint: null,
            isDemoUSDC: false,
          });
        }
        return actual.readFileSync(filePath, encoding as any);
      }),
    },
  };
});

// --- Test Data ---

const fundAllocation: FundingAllocation = {
  proposalId: 'prop-1',
  proposalTitle: 'Test Grant Proposal',
  action: 'fund',
  amount: 1000,
  reasoning: 'High quality proposal with strong team',
};

const rejectAllocation: FundingAllocation = {
  proposalId: 'prop-2',
  proposalTitle: 'Rejected Proposal',
  action: 'reject',
  reasoning: 'Does not meet funding criteria',
};

const noAmountAllocation: FundingAllocation = {
  proposalId: 'prop-3',
  proposalTitle: 'No Amount Proposal',
  action: 'fund',
  reasoning: 'Missing amount',
};

describe('TreasuryAgent (TREAS-01, TREAS-02, TREAS-05)', () => {
  let bus: TypedEventBus<AgentEvents>;
  let agent: ITreasuryAgent & { initialize: () => Promise<void>; shutdown: () => Promise<void>; publicKey: PublicKey };

  beforeEach(async () => {
    vi.clearAllMocks();
    bus = new TypedEventBus<AgentEvents>();

    // Default mock: 5 SOL balance
    mockGetBalance.mockResolvedValue(5 * LAMPORTS_PER_SOL);

    // Default mock: USDC ATA with 10000 USDC (10000 * 1_000_000 base units)
    mockGetAccount.mockResolvedValue({
      address: new PublicKey('11111111111111111111111111111111'),
      amount: BigInt(10000 * 1_000_000),
      mint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    });

    // Default mock: transfer returns a signature
    mockTransfer.mockResolvedValue('mock-tx-signature-abc123');

    // Default mock: getOrCreateATA returns account
    mockGetOrCreateATA.mockResolvedValue({
      address: new PublicKey('11111111111111111111111111111111'),
    });

    // Dynamic import to get module after mocks are set up
    const { TreasuryAgent } = await import('../../src/agents/treasury-agent.js');
    agent = new TreasuryAgent(bus) as any;
    await agent.initialize();
  });

  it('implements ITreasuryAgent interface', () => {
    const treasuryInterface: ITreasuryAgent = agent;
    expect(treasuryInterface).toBeDefined();
    expect(typeof agent.getBalance).toBe('function');
    expect(typeof agent.executeFunding).toBe('function');
  });

  it('getBalance returns solBalance, usdcBalance, and totalValueUsd', async () => {
    const balance = await agent.getBalance();

    expect(balance.solBalance).toBe(5);
    expect(balance.usdcBalance).toBe(10000);
    // totalValueUsd = usdcBalance + solBalance * 150 = 10000 + 750 = 10750
    expect(balance.totalValueUsd).toBe(10750);
  });

  it('getBalance returns 0 USDC when ATA does not exist', async () => {
    // Import the mock error class
    const { TokenAccountNotFoundError } = await import('@solana/spl-token');
    mockGetAccount.mockRejectedValue(new TokenAccountNotFoundError());

    const balance = await agent.getBalance();

    expect(balance.solBalance).toBe(5);
    expect(balance.usdcBalance).toBe(0);
    expect(balance.totalValueUsd).toBe(750); // 0 + 5 * 150
  });

  it('getBalance includes lpPositions (empty array)', async () => {
    const balance = await agent.getBalance();

    expect(balance.lpPositions).toBeDefined();
    expect(balance.lpPositions).toEqual([]);
  });

  it('executeFunding with action "fund" calls SPL transfer and returns success', async () => {
    const result = await agent.executeFunding(fundAllocation);

    expect(result.success).toBe(true);
    expect(result.signature).toBe('mock-tx-signature-abc123');
    expect(mockTransfer).toHaveBeenCalledOnce();
  });

  it('executeFunding with action "reject" returns success without transfer', async () => {
    const result = await agent.executeFunding(rejectAllocation);

    expect(result.success).toBe(true);
    expect(mockTransfer).not.toHaveBeenCalled();
  });

  it('executeFunding with no amount returns failure', async () => {
    const result = await agent.executeFunding(noAmountAllocation);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No amount specified');
  });

  it('executeFunding catches transfer errors and returns failure', async () => {
    mockTransfer.mockRejectedValue(new Error('Insufficient funds'));

    const result = await agent.executeFunding(fundAllocation);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient funds');
  });

  it('emits agent:status events during funding', async () => {
    const statusEvents: Array<{ agent: string; status: string; detail?: string }> = [];
    bus.on('agent:status', (event) => {
      statusEvents.push(event);
    });

    await agent.executeFunding(fundAllocation);

    const fundingEvent = statusEvents.find((e) => e.status === 'funding');
    expect(fundingEvent).toBeDefined();
    expect(fundingEvent!.agent).toBe('treasury');

    const fundedEvent = statusEvents.find((e) => e.status === 'funded');
    expect(fundedEvent).toBeDefined();
  });

  it('emits funding-failed status on transfer error', async () => {
    mockTransfer.mockRejectedValue(new Error('Transfer failed'));

    const statusEvents: Array<{ agent: string; status: string; detail?: string }> = [];
    bus.on('agent:status', (event) => {
      statusEvents.push(event);
    });

    await agent.executeFunding(fundAllocation);

    const failedEvent = statusEvents.find((e) => e.status === 'funding-failed');
    expect(failedEvent).toBeDefined();
    expect(failedEvent!.agent).toBe('treasury');
  });

  it('getStatus returns full TreasuryBalance including empty lpPositions', async () => {
    const balance = await agent.getBalance();

    expect(balance).toEqual({
      solBalance: 5,
      usdcBalance: 10000,
      totalValueUsd: 10750,
      lpPositions: [],
    });
  });
});
