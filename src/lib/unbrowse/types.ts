/**
 * Unbrowse API types for intent resolution.
 *
 * Request/response shapes for the /v1/intent/resolve endpoint,
 * plus configurable grant platform targets for Scout discovery.
 */

export interface UnbrowseRequest {
  intent: string;
  params?: { url?: string };
  context?: { url?: string };
}

export interface UnbrowseResponse {
  skill_id?: string;
  endpoint_id?: string;
  result?: unknown;
  available_endpoints?: unknown[];
  marketplace_match?: boolean;
  captured?: boolean;
}

/** A configurable grant platform target for Unbrowse intent resolution. */
export interface GrantTarget {
  url: string;
  intent: string;
}

/** Default grant platform targets for Solana ecosystem discovery. */
export const GRANT_TARGETS: GrantTarget[] = [
  {
    url: 'https://solana.org/grants',
    intent: 'find active Solana Foundation grant programs and funded projects',
  },
  {
    url: 'https://earn.superteam.fun/grants/',
    intent: 'list available Superteam grants with amounts and descriptions',
  },
  {
    url: 'https://dorahacks.io/grant/solana-1/buidl',
    intent: 'find funded projects from Solana DoraHacks grants',
  },
];
