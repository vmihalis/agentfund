/**
 * LLM-powered text command parser.
 *
 * Uses Claude to understand natural language and extract intent + params.
 * Falls back to keyword matching if Claude is unavailable.
 *
 * @module voice/text-parser
 */

import Anthropic from '@anthropic-ai/sdk';
import type { VoiceCommand, VoiceIntent } from './voice-types.js';

const VALID_INTENTS: VoiceIntent[] = ['findProposals', 'analyzeProposal', 'fundProject', 'checkTreasury'];

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Parse user text into a VoiceCommand using Claude.
 * Falls back to keyword matching if Claude is unavailable.
 */
export async function parseTextCommand(text: string): Promise<VoiceCommand> {
  const anthropic = getClient();
  if (anthropic) {
    try {
      return await parseWithClaude(anthropic, text);
    } catch {
      // Fall back to keyword parser
    }
  }
  return parseWithKeywords(text);
}

async function parseWithClaude(anthropic: Anthropic, text: string): Promise<VoiceCommand> {
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: `You route user messages to the right agent in an autonomous AI treasury system.
Reply with ONLY a JSON object: {"intent": "...", "params": {...}}

Available intents:
- "checkTreasury" — user asks about balance, money, funds, holdings, how much they have. params: {}
- "findProposals" — user wants to discover/search for grant proposals or projects. params: {"query": "what they want to find"}
- "analyzeProposal" — user wants to evaluate/score/review a specific proposal. params: {"proposalId": "name or id if mentioned"}
- "fundProject" — user wants to send money/fund/approve/pay a project. params: {"amount": "number if mentioned", "proposalId": "the EXACT project name the user wants to fund, if they specified one"}
- "chat" — user is chatting, greeting, asking questions, or anything else. params: {"text": "their message"}

Reply with raw JSON only. No markdown, no explanation.`,
    messages: [{ role: 'user', content: text }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as { intent: string; params: Record<string, string> };

  // Validate intent
  if (VALID_INTENTS.includes(parsed.intent as VoiceIntent)) {
    return { intent: parsed.intent as VoiceIntent, params: parsed.params ?? {} };
  }

  // "chat" intent — return as-is, router will handle it
  return { intent: parsed.intent as any, params: parsed.params ?? {} };
}

/**
 * Fallback keyword-based parser when Claude is unavailable.
 */
function parseWithKeywords(text: string): VoiceCommand {
  const lower = text.toLowerCase().trim();

  if (/\b(treasury|balance|money|wallet|how much|funds|holdings)\b/.test(lower)) {
    return { intent: 'checkTreasury', params: {} };
  }

  if (/\b(fund|approve|send|pay|allocate|distribute)\b/.test(lower)) {
    return {
      intent: 'fundProject',
      params: { proposalId: extractId(text), amount: extractAmount(text) },
    };
  }

  if (/\b(analyze|evaluate|score|review|assess)\b/.test(lower)) {
    return { intent: 'analyzeProposal', params: { proposalId: extractId(text) } };
  }

  if (/\b(find|search|discover|look|browse|proposal|grant)\b/.test(lower)) {
    return { intent: 'findProposals', params: { query: text } };
  }

  return { intent: 'chat' as any, params: { text } };
}

function extractId(text: string): string {
  const skipWords = /^(the|a|an|with|for|about|this|that|of|in|on|to|proposal|project|fund|send|pay|new|our|my|best|top|one|ones|it|them|all|dollars?|usd|usdc)$/i;
  const tokens = text.split(/\s+/);
  let seenKeyword = false;
  for (const token of tokens) {
    const clean = token.replace(/[.,!?;:]+$/, '');
    if (/^(proposal|project|fund|send|pay)$/i.test(clean)) { seenKeyword = true; continue; }
    if (seenKeyword && !skipWords.test(clean) && clean.length > 0) {
      if (/^\d+$/.test(clean)) continue;
      return clean;
    }
  }
  return '';
}

function extractAmount(text: string): string {
  const dollar = text.match(/\$([0-9,]+(?:\.\d+)?)/);
  if (dollar) return dollar[1].replace(/,/g, '');
  const wordAmount = text.match(/\b(\d+(?:\.\d+)?)\s*(?:dollars?|usd|usdc)\b/i);
  if (wordAmount) return wordAmount[1];
  const numbers = text.match(/\b(\d{2,}(?:\.\d+)?)\b/);
  if (numbers) return numbers[1];
  return '';
}
