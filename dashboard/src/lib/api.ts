/**
 * Fetch helpers for dashboard API routes.
 *
 * Each function fetches from a relative API URL and returns
 * typed data with error handling (returns empty/default on failure).
 */

import type { AgentInfo, TreasuryData, PaymentRecord, PipelineProposal, VoiceResult } from './types';

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
 * Fetch ElevenLabs signed URL for voice conversation.
 */
export async function fetchSignedUrl(): Promise<{ signedUrl: string }> {
  const res = await fetch('/api/voice/signed-url');
  if (!res.ok) throw new Error('Voice server unavailable');
  return (await res.json()) as { signedUrl: string };
}

/**
 * Send a text command to the voice server.
 */
export async function sendCommand(text: string): Promise<VoiceResult> {
  const res = await fetch('/api/voice/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Voice server unavailable');
  return (await res.json()) as VoiceResult;
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
