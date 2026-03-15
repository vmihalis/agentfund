/**
 * ScoutAgent -- discovers grant proposals via Unbrowse web data + Claude AI structuring.
 *
 * Extends BaseAgent and implements IScoutAgent with a 3-layer approach:
 * 1. Unbrowse scrapes real web data from grant platforms
 * 2. Claude AI structures raw web data into typed Proposal objects
 * 3. Falls back to cached or stub data if both fail
 *
 * The pipeline never receives an empty array -- the stub layer guarantees
 * at least 3 proposals are always available.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { IScoutAgent } from './types.js';
import type { Proposal } from '../types/proposals.js';
import type { AgentEventBus } from '../events/event-types.js';
import { UnbrowseClient } from '../lib/unbrowse/client.js';
import { GRANT_TARGETS } from '../lib/unbrowse/types.js';
import { STUB_PROPOSALS } from './stubs/stub-scout.js';

const ProposalSchema = z.object({
  title: z.string(),
  description: z.string(),
  requestedAmount: z.number(),
  teamInfo: z.string(),
});

export class ScoutAgent extends BaseAgent implements IScoutAgent {
  private readonly unbrowseClient: UnbrowseClient;
  private readonly anthropic: Anthropic | null;
  private cache: Proposal[] = [];

  constructor(bus: AgentEventBus, unbrowseClient?: UnbrowseClient, anthropicClient?: Anthropic) {
    super('scout', bus);
    this.unbrowseClient =
      unbrowseClient ??
      new UnbrowseClient(process.env.UNBROWSE_URL ?? 'http://localhost:6969');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.anthropic = anthropicClient ?? (apiKey ? new Anthropic({ apiKey }) : null);
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

    // Layer 1: Unbrowse web scraping (disabled — set UNBROWSE_ENABLED=1 to activate)
    if (process.env.UNBROWSE_ENABLED === '1') {
      const rawWebData: string[] = [];

      for (const target of GRANT_TARGETS) {
        try {
          console.log(`[Scout] Unbrowse: scraping ${target.url}...`);
          this.emitStatus('unbrowse-scraping', `Scraping ${target.url} via Unbrowse`);
          const raw = await this.unbrowseClient.resolveIntent(
            `${query} ${target.intent}`,
            target.url,
          );
          const text = JSON.stringify(raw).slice(0, 3000);
          rawWebData.push(`[${target.url}]: ${text}`);
          console.log(`[Scout] Unbrowse: got ${text.length} chars from ${target.url}`);
          this.emitStatus('unbrowse-resolved', `Scraped data from ${target.url}`);
        } catch (err) {
          console.log(`[Scout] Unbrowse: failed for ${target.url}: ${err instanceof Error ? err.message : String(err)}`);
          this.emitStatus(
            'unbrowse-unavailable',
            `${target.url}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Use Claude to structure the raw web data into proposals
      if (rawWebData.length > 0 && this.anthropic) {
        try {
          console.log(`[Scout] Claude: structuring ${rawWebData.length} web sources into proposals...`);
          this.emitStatus('ai-structuring', `Claude AI structuring ${rawWebData.length} web sources into proposals`);
          const proposals = await this.structureWithClaude(query, rawWebData);
          if (proposals.length > 0) {
            this.cache = proposals;
            console.log(`[Scout] Claude: structured ${proposals.length} proposals`);
            this.emitStatus('ai-structured', `Structured ${proposals.length} proposals from live web data`);
            return proposals;
          }
        } catch (err) {
          console.log(`[Scout] Claude structuring failed: ${err instanceof Error ? err.message : String(err)}`);
          this.emitStatus(
            'ai-fallback',
            `Claude structuring failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // Layer 2: Try Claude with just the query
    if (this.anthropic) {
      try {
        console.log('[Scout] Claude: discovering proposals from AI knowledge...');
        this.emitStatus('ai-discovering', 'Claude AI discovering proposals from ecosystem knowledge');
        const proposals = await this.discoverWithClaude(query);
        if (proposals.length > 0) {
          this.cache = proposals;
          console.log(`[Scout] Claude: discovered ${proposals.length} proposals`);
          this.emitStatus('ai-discovered', `Discovered ${proposals.length} proposals via AI`);
          return proposals;
        }
      } catch {
        // Fall through to cache/stubs
      }
    }

    // Layer 3: Return cached data from last successful call
    if (this.cache.length > 0) {
      this.emitStatus('using-cache', `Returning ${this.cache.length} cached proposals`);
      return [...this.cache];
    }

    // Layer 4: Return hardcoded stub data
    this.emitStatus('using-stub', 'Returning stub proposals');
    return [...STUB_PROPOSALS];
  }

  /**
   * Use Claude to structure raw Unbrowse web data into typed proposals.
   */
  private async structureWithClaude(query: string, rawData: string[]): Promise<Proposal[]> {
    if (!this.anthropic) return [];

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a grant proposal scout. Extract or infer 3-5 realistic grant proposals from this web data scraped from Solana ecosystem grant platforms.

User query: "${query}"

Raw web data:
${rawData.join('\n\n')}

Return ONLY a JSON array of proposals. Each proposal must have:
- title: string (project name)
- description: string (1-2 sentence description)
- requestedAmount: number (USD amount, realistic for crypto grants: $5000-$50000)
- teamInfo: string (team description)

If the web data is too sparse, use it as context clues and generate realistic Solana ecosystem proposals that could plausibly exist on these platforms. Return raw JSON array, no markdown.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as unknown[];

    const now = Date.now();
    return parsed
      .map((item, idx) => {
        const result = ProposalSchema.safeParse(item);
        if (!result.success) return null;
        return {
          id: `scout-${now}-${idx}`,
          ...result.data,
        } as Proposal;
      })
      .filter((p): p is Proposal => p !== null);
  }

  /**
   * Use Claude to discover proposals from its knowledge when Unbrowse is unavailable.
   */
  private async discoverWithClaude(query: string): Promise<Proposal[]> {
    if (!this.anthropic) return [];

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a grant proposal scout for the Solana ecosystem. Generate 3-4 realistic grant proposals that match this query: "${query}"

These should be plausible proposals that could exist on platforms like Superteam Earn, Solana Foundation Grants, or DoraHacks. Make them varied (different sizes, different focus areas).

Return ONLY a JSON array. Each proposal must have:
- title: string (project name)
- description: string (1-2 sentence description)
- requestedAmount: number (USD, range $5000-$50000)
- teamInfo: string (team description)

Return raw JSON array, no markdown.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as unknown[];

    const now = Date.now();
    return parsed
      .map((item, idx) => {
        const result = ProposalSchema.safeParse(item);
        if (!result.success) return null;
        return {
          id: `scout-${now}-${idx}`,
          ...result.data,
        } as Proposal;
      })
      .filter((p): p is Proposal => p !== null);
  }
}
