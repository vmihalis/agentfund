/**
 * Text command parser -- maps natural language text to VoiceCommand.
 *
 * Uses keyword-based intent matching (case-insensitive) to extract
 * the user's intent and parameters from free-form text input.
 * This provides the text fallback path that produces the same
 * VoiceCommand format as the ElevenLabs voice path.
 *
 * @module voice/text-parser
 */

import type { VoiceCommand } from './voice-types.js';

/**
 * Parse a natural language text command into a VoiceCommand.
 *
 * Intent matching rules (first match wins):
 * - "fund" | "approve" => fundProject
 * - "analyze" | "evaluate" => analyzeProposal
 * - "treasury" | "balance" | "check" => checkTreasury
 * - "find" + ("proposal" | "grant") | "search" => findProposals
 * - Default: findProposals with query = text
 *
 * @param text - Raw user text input
 * @returns Parsed VoiceCommand with intent and extracted params
 */
export function parseTextCommand(text: string): VoiceCommand {
  const lower = text.toLowerCase().trim();

  // Fund / approve intent
  if (/\b(fund|approve)\b/.test(lower)) {
    return {
      intent: 'fundProject',
      params: {
        proposalId: extractId(text),
        amount: extractAmount(text),
      },
    };
  }

  // Analyze / evaluate intent
  if (/\b(analyze|evaluate)\b/.test(lower)) {
    return {
      intent: 'analyzeProposal',
      params: {
        proposalId: extractId(text),
      },
    };
  }

  // Treasury / balance / check intent
  if (/\b(treasury|balance|check)\b/.test(lower)) {
    return {
      intent: 'checkTreasury',
      params: {},
    };
  }

  // Find proposals / search intent
  if (/\b(find|search|discover)\b/.test(lower) || /\b(proposal|grant)\b/.test(lower)) {
    return {
      intent: 'findProposals',
      params: { query: text },
    };
  }

  // Default: findProposals with query = original text
  return {
    intent: 'findProposals',
    params: { query: text },
  };
}

/**
 * Extract an ID from text.
 *
 * Looks for the word after keywords like "proposal", "project", or "analyze".
 * Falls back to the last capitalized/alphanumeric token.
 */
function extractId(text: string): string {
  const skipWords = /^(the|a|an|with|for|about|this|that|of|in|on|to|proposal|project|analyze|evaluate|approve|fund|new|our|my)$/i;

  // Split into tokens and find the first non-keyword, non-skip-word token
  // that appears after an intent/object keyword
  const tokens = text.split(/\s+/);
  let seenKeyword = false;

  for (const token of tokens) {
    const clean = token.replace(/[.,!?;:]+$/, '');
    if (/^(proposal|project|analyze|evaluate|approve|fund)$/i.test(clean)) {
      seenKeyword = true;
      continue;
    }
    if (seenKeyword && !skipWords.test(clean) && clean.length > 0) {
      // Skip pure numbers (those are amounts, not IDs)
      if (/^\d+$/.test(clean)) continue;
      return clean;
    }
  }

  // Fallback: look for any uppercase or alphanumeric token that looks like an ID
  const idLike = tokens.find(
    (t) => /^[A-Z][A-Za-z0-9-]+$/.test(t) || /^[a-z]+-\d+$/.test(t),
  );
  if (idLike) return idLike;

  return '';
}

/**
 * Extract a monetary amount from text.
 *
 * Looks for dollar amounts ($N) or plain numbers.
 */
function extractAmount(text: string): string {
  // Match $N or $N,NNN patterns
  const dollar = text.match(/\$([0-9,]+(?:\.\d+)?)/);
  if (dollar) return dollar[1].replace(/,/g, '');

  // Match standalone numbers (not part of an ID)
  const numbers = text.match(/\b(\d{2,}(?:\.\d+)?)\b/);
  if (numbers) return numbers[1];

  return '';
}
