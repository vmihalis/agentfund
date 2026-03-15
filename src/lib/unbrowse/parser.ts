/**
 * Unbrowse response parser with Zod validation.
 *
 * Normalizes varying Unbrowse response shapes into typed Proposal[] objects.
 * Handles multiple field name conventions (including GitHub API format),
 * nested response structures, and string/number amount formats.
 */

import { z } from 'zod';
import type { Proposal } from '../../types/proposals.js';

/**
 * Flexible Zod schema accepting multiple field name variations
 * from Unbrowse response data (including GitHub API fields).
 */
const UnbrowseProposalSchema = z.object({
  // Standard fields
  title: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  amount: z.union([z.number(), z.string()]).nullable().optional(),
  requested_amount: z.union([z.number(), z.string()]).nullable().optional(),
  funding_amount: z.union([z.number(), z.string()]).nullable().optional(),
  team: z.string().optional(),
  team_info: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  // GitHub API fields
  full_name: z.string().optional(),
  html_url: z.string().optional(),
  stargazers_count: z.number().optional(),
  stars: z.union([z.number(), z.string()]).optional(),
  language: z.string().optional(),
  topics: z.array(z.string()).optional(),
  owner: z.object({ login: z.string() }).passthrough().optional(),
  open_issues_count: z.number().optional(),
  forks_count: z.number().optional(),
}).passthrough();

/**
 * Parse a raw amount value (string or number) into a numeric value.
 * Strips $ signs and commas from string amounts. Returns 0 for invalid values.
 */
export function parseAmount(val: unknown): number {
  if (val === null || val === undefined) return 0;

  if (typeof val === 'number') {
    return Number.isNaN(val) ? 0 : val;
  }

  if (typeof val === 'string') {
    // Strip $ and commas, then parse
    const cleaned = val.replace(/[$,]/g, '').trim();
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? 0 : num;
  }

  return 0;
}

/**
 * Extract a result array from varying Unbrowse response shapes.
 *
 * Checks: raw.result (array), raw.result (single object wrapped),
 * raw.data (array), direct array, or wraps single object in array.
 */
export function extractResultArray(raw: unknown): unknown[] {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    if (Array.isArray(raw)) return raw;
    return [];
  }

  // Direct array
  if (Array.isArray(raw)) return raw;

  const obj = raw as Record<string, unknown>;

  // Check .result
  if ('result' in obj && obj.result !== null && obj.result !== undefined) {
    if (Array.isArray(obj.result)) return obj.result;
    if (typeof obj.result === 'object') return [obj.result];
  }

  // Check .data
  if ('data' in obj && obj.data !== null && obj.data !== undefined) {
    if (Array.isArray(obj.data)) return obj.data;
    if (typeof obj.data === 'object') return [obj.data];
  }

  return [];
}

/**
 * Parse raw Unbrowse response data into a typed Proposal[].
 *
 * Extracts the result array, validates each item with Zod,
 * normalizes field names, generates IDs, and filters invalid entries.
 */
export function parseUnbrowseResult(raw: unknown): Proposal[] {
  const data = extractResultArray(raw);
  if (data.length === 0) return [];

  const now = Date.now();

  const results: Proposal[] = [];

  for (let idx = 0; idx < data.length; idx++) {
    const parsed = UnbrowseProposalSchema.safeParse(data[idx]);
    if (!parsed.success) continue;

    const d = parsed.data;

    // Support GitHub API format (full_name, html_url, stargazers_count, etc.)
    const isGitHubRepo = !!(d.full_name || d.html_url || d.stargazers_count !== undefined);

    const title = d.title ?? d.name ?? d.full_name;
    if (!title) continue; // Filter items with no title and no name

    let description = d.description ?? d.summary ?? '';
    if (isGitHubRepo) {
      const parts: string[] = [];
      if (d.description) parts.push(d.description);
      if (d.language) parts.push(`Language: ${d.language}`);
      const stars = d.stargazers_count ?? parseAmount(d.stars);
      if (stars) parts.push(`Stars: ${stars}`);
      if (d.topics?.length) parts.push(`Topics: ${d.topics.join(', ')}`);
      if (d.forks_count) parts.push(`Forks: ${d.forks_count}`);
      description = parts.join('. ');
    }

    const amount = parseAmount(d.amount ?? d.requested_amount ?? d.funding_amount);
    const teamInfo =
      d.team ?? d.team_info ?? (d.owner?.login ? `GitHub org: ${d.owner.login}` : 'Unknown team');
    const sourceUrl = d.html_url ?? d.url ?? d.link;

    const proposal: Proposal = {
      id: `unbrowse-${now}-${idx}`,
      title,
      description,
      requestedAmount: amount,
      teamInfo,
    };

    if (sourceUrl) {
      proposal.sourceUrl = sourceUrl;
    }

    results.push(proposal);
  }

  return results;
}
