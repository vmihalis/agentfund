/**
 * Agent data mapping utilities.
 *
 * Extracted as pure functions for testability. The API route
 * calls these functions; tests validate data shapes without
 * needing the Next.js runtime.
 */

import type { AgentInfo } from './types';

/** Agent configuration matching src/types/agents.ts AGENT_CONFIGS exactly. */
export const AGENT_CONFIGS = {
  scout: {
    role: 'scout' as const,
    name: 'Scout Agent',
    description: 'Discovers grant proposals and funding opportunities via web data',
  },
  analyzer: {
    role: 'analyzer' as const,
    name: 'Proposal Analyzer',
    description: 'Evaluates proposals using AI with structured scoring',
  },
  treasury: {
    role: 'treasury' as const,
    name: 'Treasury Manager',
    description: 'Manages funds, executes transfers, and earns yield via DeFi',
  },
  governance: {
    role: 'governance' as const,
    name: 'Governance Agent',
    description: 'Coordinates the funding pipeline and makes allocation decisions',
  },
} as const;

export type AgentRole = keyof typeof AGENT_CONFIGS;

export const AGENT_ROLES: AgentRole[] = ['scout', 'analyzer', 'treasury', 'governance'];

/** Shape of the addresses.json file. */
export interface AddressesFile {
  deployer: string;
  agents: Record<string, { publicKey: string; ata: string | null }>;
  usdcMint: string | null;
  isDemoUSDC: boolean;
}

/**
 * Build a Solscan devnet URL for an address.
 */
export function buildSolscanUrl(publicKey: string): string {
  return `https://solscan.io/address/${publicKey}?cluster=devnet`;
}

/**
 * Map addresses.json data into AgentInfo array.
 *
 * @param addresses - Parsed addresses.json content
 * @returns Array of AgentInfo with Solscan links
 */
export function mapAgentInfos(addresses: AddressesFile): AgentInfo[] {
  return AGENT_ROLES.map((role) => {
    const config = AGENT_CONFIGS[role];
    const agentEntry = addresses.agents[role];
    const publicKey = agentEntry?.publicKey ?? 'unknown';

    return {
      role: config.role,
      name: config.name,
      description: config.description,
      publicKey,
      solscanUrl: buildSolscanUrl(publicKey),
    };
  });
}

/**
 * Build fallback AgentInfo array when addresses.json is unavailable.
 */
export function buildFallbackAgents(): AgentInfo[] {
  return AGENT_ROLES.map((role) => {
    const config = AGENT_CONFIGS[role];
    return {
      role: config.role,
      name: config.name,
      description: config.description,
      publicKey: 'unknown',
      solscanUrl: buildSolscanUrl('unknown'),
    };
  });
}
