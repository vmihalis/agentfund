/**
 * Fetch helpers for dashboard API routes.
 *
 * Each function fetches from a relative API URL and returns
 * typed data with error handling (returns empty/default on failure).
 */

import type { AgentInfo, TreasuryData, PaymentRecord } from './types';

/**
 * Fetch all agent identities with public keys and Solscan links.
 */
export async function fetchAgents(): Promise<AgentInfo[]> {
  try {
    const res = await fetch('/api/agents');
    if (!res.ok) return [];
    return (await res.json()) as AgentInfo[];
  } catch {
    return [];
  }
}

/**
 * Fetch treasury balance data (SOL, USDC, total USD, LP positions).
 */
export async function fetchTreasury(): Promise<TreasuryData> {
  const fallback: TreasuryData = {
    solBalance: 0,
    usdcBalance: 0,
    totalValueUsd: 0,
    lpPositions: [],
  };
  try {
    const res = await fetch('/api/treasury');
    if (!res.ok) return fallback;
    return (await res.json()) as TreasuryData;
  } catch {
    return fallback;
  }
}

/**
 * Fetch x402 payment history records.
 */
export async function fetchPayments(): Promise<PaymentRecord[]> {
  try {
    const res = await fetch('/api/payments');
    if (!res.ok) return [];
    return (await res.json()) as PaymentRecord[];
  } catch {
    return [];
  }
}
