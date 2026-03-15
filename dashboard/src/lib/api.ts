/**
 * Fetch helpers for dashboard API routes.
 *
 * All authenticated endpoints use authFetch which attaches
 * the Bearer token automatically from localStorage.
 */

import type { AgentInfo, TreasuryData, PaymentRecord, PipelineProposal, VoiceResult } from './types';
import { authFetch } from './auth';

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

/**
 * Send a text command to the voice server (auth required).
 */
export async function sendCommand(text: string): Promise<VoiceResult> {
  const res = await authFetch('/api/voice/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (res.status === 401) throw new Error('Session expired. Please login again.');
  if (!res.ok) throw new Error('Voice server unavailable');
  return (await res.json()) as VoiceResult;
}

/**
 * Clear server-side conversation history and caches (auth required).
 */
export async function clearChatHistory(): Promise<void> {
  await authFetch('/api/voice/clear', { method: 'POST' });
}

/**
 * Fetch pipeline proposals.
 */
export async function fetchProposals(): Promise<PipelineProposal[]> {
  try {
    const res = await fetch('/api/proposals');
    if (!res.ok) return [];
    return (await res.json()) as PipelineProposal[];
  } catch {
    return [];
  }
}
