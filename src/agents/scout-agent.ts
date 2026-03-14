/**
 * ScoutAgent -- discovers grant proposals via Unbrowse intent resolution.
 *
 * Extends BaseAgent and implements IScoutAgent with a 3-layer fallback:
 * 1. Live Unbrowse API call (resolves intent against grant platform targets)
 * 2. Cached results from previous successful calls
 * 3. Hardcoded STUB_PROPOSALS (same data as StubScoutAgent)
 *
 * The pipeline never receives an empty array -- the stub layer guarantees
 * at least 3 proposals are always available.
 */

import { BaseAgent } from './base-agent.js';
import type { IScoutAgent } from './types.js';
import type { Proposal } from '../types/proposals.js';
import type { AgentEventBus } from '../events/event-types.js';
import { UnbrowseClient } from '../lib/unbrowse/client.js';
import { parseUnbrowseResult } from '../lib/unbrowse/parser.js';
import { GRANT_TARGETS } from '../lib/unbrowse/types.js';
import { STUB_PROPOSALS } from './stubs/stub-scout.js';

export class ScoutAgent extends BaseAgent implements IScoutAgent {
  private readonly unbrowseClient: UnbrowseClient;
  private cache: Proposal[] = [];

  constructor(bus: AgentEventBus, unbrowseClient?: UnbrowseClient) {
    super('scout', bus);
    this.unbrowseClient =
      unbrowseClient ??
      new UnbrowseClient(process.env.UNBROWSE_URL ?? 'http://localhost:6969');
  }

  async initialize(): Promise<void> {
    const healthy = await this.unbrowseClient.healthCheck();
    this.emitStatus(
      'initialized',
      healthy ? 'Unbrowse is available' : 'Unbrowse is unavailable, will use fallbacks',
    );
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'ScoutAgent stopped');
  }

  async discoverProposals(query: string): Promise<Proposal[]> {
    this.emitStatus('discovering', `Searching for proposals: ${query}`);

    // Layer 1: Try Unbrowse live across multiple grant targets
    const allProposals: Proposal[] = [];
    let unbrowseAvailable = false;

    for (const target of GRANT_TARGETS) {
      try {
        const raw = await this.unbrowseClient.resolveIntent(
          `${query} ${target.intent}`,
          target.url,
        );
        const parsed = parseUnbrowseResult(raw);
        allProposals.push(...parsed);
        unbrowseAvailable = true;
      } catch (err) {
        this.emitStatus(
          'unbrowse-unavailable',
          `Failed for ${target.url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Deduplicate by title (case-insensitive, keep first seen)
    const deduplicated = this.deduplicateByTitle(allProposals);

    if (deduplicated.length > 0) {
      this.cache = deduplicated;
      this.emitStatus('unbrowse-resolved', `Found ${deduplicated.length} proposals via Unbrowse`);
      return deduplicated;
    }

    // Layer 2: Return cached data from last successful call
    if (this.cache.length > 0) {
      this.emitStatus('using-cache', `Returning ${this.cache.length} cached proposals`);
      return [...this.cache];
    }

    // Layer 3: Return hardcoded stub data (same as StubScoutAgent)
    this.emitStatus('using-stub', 'Returning stub proposals');
    return [...STUB_PROPOSALS];
  }

  /** Deduplicate proposals by title (case-insensitive), keeping first occurrence. */
  private deduplicateByTitle(proposals: Proposal[]): Proposal[] {
    const seen = new Set<string>();
    return proposals.filter((p) => {
      const key = p.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
