/**
 * Agents module public API.
 *
 * Re-exports BaseAgent, all agent interfaces, and all stub implementations.
 */

export { BaseAgent } from './base-agent.js';
export type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from './types.js';
export { GovernanceAgent } from './governance-agent.js';
export type { FundingRequest } from './governance-agent.js';
export { AnalyzerAgent } from './analyzer-agent.js';
export { ScoutAgent } from './scout-agent.js';
export { StubScoutAgent } from './stubs/stub-scout.js';
export { StubAnalyzerAgent } from './stubs/stub-analyzer.js';
export { StubTreasuryAgent } from './stubs/stub-treasury.js';
