/**
 * ScoutAgent -- discovers grant proposals via Unbrowse web data + Claude AI structuring.
 *
 * Extends BaseAgent and implements IScoutAgent with a 3-layer approach:
 * 1. Unbrowse scrapes real web data from grant platforms (in parallel)
 * 2. Claude AI structures raw web data into typed Proposal objects
 * 3. Falls back to cached or stub data if both fail
 *
 * Features:
 * - Parallel scraping of all sources via Promise.allSettled
 * - Dynamic query expansion via Claude for targeted searches
 * - Source quality ranking by data richness
 * - Thinking events for reasoning visibility
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { IScoutAgent } from './types.js';
import type { Proposal } from '../types/proposals.js';
import type { AgentEventBus } from '../events/event-types.js';
import { UnbrowseClient } from '../lib/unbrowse/client.js';
import { GRANT_TARGETS, type GrantTarget } from '../lib/unbrowse/types.js';
import { STUB_PROPOSALS } from './stubs/stub-scout.js';

const ProposalSchema = z.object({
  title: z.string(),
  description: z.string(),
  requestedAmount: z.number(),
  teamInfo: z.string(),
});

/** Source data with quality metadata for ranking. */
interface SourceResult {
  url: string;
  data: string;
  charCount: number;
  hasJson: boolean;
}

export class ScoutAgent extends BaseAgent implements IScoutAgent {
  private readonly unbrowseClient: UnbrowseClient;
  private readonly anthropic: Anthropic | null;
  private cache: Proposal[] = [];
  private unbrowseAvailable = false;

  constructor(bus: AgentEventBus, unbrowseClient?: UnbrowseClient, anthropicClient?: Anthropic) {
    super('scout', bus);
    this.unbrowseClient =
      unbrowseClient ??
      new UnbrowseClient(process.env.UNBROWSE_URL ?? 'http://localhost:6969');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.anthropic = anthropicClient ?? (apiKey ? new Anthropic({ apiKey }) : null);
  }

  async initialize(): Promise<void> {
    this.unbrowseAvailable = await this.unbrowseClient.healthCheck();
    this.emitStatus(
      'initialized',
      this.unbrowseAvailable ? 'Unbrowse is available' : 'Unbrowse is unavailable, will use fallbacks',
    );
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'ScoutAgent stopped');
  }

  async discoverProposals(query: string): Promise<Proposal[]> {
    this.emitStatus('discovering', `Searching for proposals: ${query}`);

    // Build targets: static + dynamic expansion
    const allTargets = [...GRANT_TARGETS];
    if (this.anthropic) {
      const expanded = await this.expandQuery(query);
      allTargets.push(...expanded);
    }

    this.emitThinking('considering', `Preparing to scrape ${allTargets.length} sources in parallel for query "${query}"`);

    // Layer 1: Unbrowse web scraping (parallel via Promise.allSettled)
    if (this.unbrowseAvailable) {
      const scrapeResults = await Promise.allSettled(
        allTargets.map(target => this.scrapeSource(query, target))
      );

      const sources: SourceResult[] = [];
      for (let i = 0; i < scrapeResults.length; i++) {
        const result = scrapeResults[i];
        const target = allTargets[i];
        if (result.status === 'fulfilled' && result.value) {
          sources.push(result.value);
          this.emitThinking('weighing',
            result.value.charCount > 500
              ? `Rich data from ${target.url} (${result.value.charCount} chars) — good signal`
              : `Sparse results from ${target.url} (${result.value.charCount} chars) — limited data`
          );
        } else {
          const reason = result.status === 'rejected'
            ? (result.reason instanceof Error ? result.reason.message : String(result.reason))
            : 'no data';
          this.emitStatus('unbrowse-unavailable', `${target.url}: ${reason}`);
        }
      }

      // Rank sources by quality
      if (sources.length > 0) {
        const ranked = this.rankSources(sources);
        const rawWebData = ranked.map(s => `[${s.url}]: ${s.data}`);

        this.emitThinking('weighing',
          `Ranked ${sources.length} sources by data quality. Best: ${ranked[0].url} (${ranked[0].charCount} chars${ranked[0].hasJson ? ', has JSON' : ''})`
        );

        // Use Claude to structure the raw web data into proposals
        if (this.anthropic) {
          try {
            console.log(`[Scout] Claude: structuring ${rawWebData.length} web sources into proposals...`);
            this.emitStatus('ai-structuring', `Claude AI structuring ${rawWebData.length} web sources into proposals`);
            const proposals = await this.structureWithClaude(query, rawWebData);
            if (proposals.length > 0) {
              this.cache = proposals;
              console.log(`[Scout] Claude: structured ${proposals.length} proposals`);
              this.emitStatus('ai-structured', `Structured ${proposals.length} proposals from live web data`);
              this.emitThinking('concluding', `Discovered ${proposals.length} proposals from ${rawWebData.length} web sources`);
              this.emitConfidence('discovered proposals', proposals.length >= 3 ? 0.85 : 0.6,
                `Found ${proposals.length} proposals — ${proposals.length >= 3 ? 'good coverage' : 'limited results, may need broader search'}`);
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
   * Scrape a single source via Unbrowse. Returns null on failure.
   */
  private async scrapeSource(query: string, target: GrantTarget): Promise<SourceResult | null> {
    try {
      console.log(`[Scout] Unbrowse: scraping ${target.url}...`);
      this.emitStatus('unbrowse-scraping', `Scraping ${target.url} via Unbrowse`);
      const raw = await this.unbrowseClient.resolveIntent(
        `${query} ${target.intent}`,
        target.url,
      );
      const text = JSON.stringify(raw).slice(0, 3000);
      console.log(`[Scout] Unbrowse: got ${text.length} chars from ${target.url}`);
      this.emitStatus('unbrowse-resolved', `Scraped data from ${target.url}`);

      return {
        url: target.url,
        data: text,
        charCount: text.length,
        hasJson: text.startsWith('{') || text.startsWith('['),
      };
    } catch (err) {
      console.log(`[Scout] Unbrowse: failed for ${target.url}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  /**
   * Use Claude to generate 3-5 targeted search URLs from a user query.
   * These are scraped in parallel alongside the static GRANT_TARGETS.
   */
  private async expandQuery(query: string): Promise<GrantTarget[]> {
    if (!this.anthropic) return [];

    try {
      this.emitThinking('considering', `Expanding search query "${query}" into targeted searches`);

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Given this grant search query: "${query}"

Generate 2-3 additional GitHub search URLs that would help find relevant projects. Each URL should target a different aspect of the query.

Return ONLY a JSON array of objects with "url" and "intent" fields. Example:
[{"url": "https://github.com/search?q=...", "intent": "search for..."}]

Return raw JSON array, no markdown.`,
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as GrantTarget[];

      if (Array.isArray(parsed) && parsed.length > 0) {
        this.emitThinking('weighing', `Expanded query into ${parsed.length} additional search targets`);
        return parsed.slice(0, 3); // Cap at 3
      }
    } catch {
      // Silent fallback — expansion is optional
    }
    return [];
  }

  /**
   * Rank sources by data richness: char count, JSON validity, presence of key fields.
   * Returns sources sorted best-first.
   */
  private rankSources(sources: SourceResult[]): SourceResult[] {
    return [...sources].sort((a, b) => {
      // Prefer sources with JSON structure
      if (a.hasJson !== b.hasJson) return a.hasJson ? -1 : 1;
      // Then by character count
      return b.charCount - a.charCount;
    });
  }

  /**
   * Handle questions from other agents (e.g., Analyzer asking for more data).
   */
  async handleQuestion(question: string, context?: Record<string, unknown>): Promise<string> {
    // If asked to fetch more data for a specific project
    if (question.toLowerCase().includes('github data') || question.toLowerCase().includes('find')) {
      const projectName = context?.projectName as string || question.replace(/.*for\s+/i, '').trim();
      if (this.unbrowseAvailable) {
        try {
          const searchUrl = `https://github.com/search?q=${encodeURIComponent(projectName)}&type=repositories&s=stars&o=desc`;
          const raw = await this.unbrowseClient.resolveIntent(
            `search repositories for ${projectName} with descriptions stars and languages`,
            searchUrl,
          );
          return JSON.stringify(raw).slice(0, 2000);
        } catch {
          return `Could not fetch GitHub data for "${projectName}" — Unbrowse unavailable`;
        }
      }
      return `Cannot fetch GitHub data — Unbrowse is not available`;
    }
    return `I can help find project data. Try asking me to "find GitHub data for [project name]"`;
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
        content: `You are a grant proposal scout for a Solana ecosystem fund. Analyze this web data (which may include GitHub repositories, grant listings, or project pages) and extract 3-5 promising project proposals worth funding.

User query: "${query}"

Raw web data:
${rawData.join('\n\n')}

For each project, synthesize the available data into a funding proposal. Use GitHub metadata (stars, language, topics, description) to assess project quality and estimate reasonable grant amounts.

Return ONLY a JSON array of proposals. Each proposal must have:
- title: string (project name)
- description: string (1-2 sentence description of what the project does and why it's worth funding)
- requestedAmount: number (USD amount, realistic for crypto grants: $5000-$50000, based on project scope/maturity)
- teamInfo: string (team/org info — use GitHub org name, contributor count, or any team data available)

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
