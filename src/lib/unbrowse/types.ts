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
    url: 'https://github.com/search?q=solana+grant&type=repositories&s=updated&o=desc',
    intent: 'search repositories for solana grants with names descriptions and star counts',
  },
  {
    url: 'https://github.com/search?q=solana+defi+OR+solana+infrastructure&type=repositories&s=stars&o=desc',
    intent: 'search repositories for solana defi and infrastructure projects sorted by stars',
  },
  {
    url: 'https://github.com/trending/typescript?since=weekly',
    intent: 'get trending repositories with names descriptions and star counts',
  },
];
