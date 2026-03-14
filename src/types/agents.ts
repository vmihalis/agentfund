/**
 * Agent role definitions and config types.
 *
 * The four agents in the AgentFund system, each with a distinct
 * responsibility in the autonomous funding pipeline.
 */

export const AGENT_ROLES = ['scout', 'analyzer', 'treasury', 'governance'] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  metadataUri?: string;
}

export const AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  scout: {
    role: 'scout',
    name: 'Scout Agent',
    description: 'Discovers grant proposals and funding opportunities via web data',
  },
  analyzer: {
    role: 'analyzer',
    name: 'Proposal Analyzer',
    description: 'Evaluates proposals using AI with structured scoring',
  },
  treasury: {
    role: 'treasury',
    name: 'Treasury Manager',
    description: 'Manages funds, executes transfers, and earns yield via DeFi',
  },
  governance: {
    role: 'governance',
    name: 'Governance Agent',
    description: 'Coordinates the funding pipeline and makes allocation decisions',
  },
};
