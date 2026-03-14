/**
 * Tests for Unbrowse response parser and client.
 *
 * Covers:
 * - parseUnbrowseResult normalization of varying response shapes into Proposal[]
 * - parseAmount edge cases
 * - UnbrowseClient HTTP interactions (mocked fetch)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import implementation (will be created after RED phase)
import { parseUnbrowseResult } from '../../src/lib/unbrowse/parser.js';
import { UnbrowseClient } from '../../src/lib/unbrowse/client.js';

describe('parseUnbrowseResult', () => {
  it('returns Proposal[] from well-formed { result: [...] } data', () => {
    const raw = {
      result: [
        {
          title: 'Grant Alpha',
          description: 'A great project',
          amount: 5000,
          team: 'Team Alpha',
          url: 'https://example.com/alpha',
        },
        {
          title: 'Grant Beta',
          description: 'Another project',
          amount: 10000,
          team: 'Team Beta',
          url: 'https://example.com/beta',
        },
      ],
    };

    const proposals = parseUnbrowseResult(raw);

    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toMatchObject({
      title: 'Grant Alpha',
      description: 'A great project',
      requestedAmount: 5000,
      teamInfo: 'Team Alpha',
      sourceUrl: 'https://example.com/alpha',
    });
    expect(proposals[0].id).toMatch(/^unbrowse-/);
    expect(proposals[1].title).toBe('Grant Beta');
  });

  it('handles alternative field names: name, summary, requested_amount, team_info, link', () => {
    const raw = {
      result: [
        {
          name: 'Alt Name Grant',
          summary: 'Alt summary text',
          requested_amount: 7500,
          team_info: 'Alt team',
          link: 'https://alt.example.com',
        },
      ],
    };

    const proposals = parseUnbrowseResult(raw);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      title: 'Alt Name Grant',
      description: 'Alt summary text',
      requestedAmount: 7500,
      teamInfo: 'Alt team',
      sourceUrl: 'https://alt.example.com',
    });
  });

  it('handles funding_amount as alternative amount field', () => {
    const raw = {
      result: [
        {
          title: 'Funding Amount Grant',
          description: 'Test',
          funding_amount: 3000,
          team: 'Team C',
        },
      ],
    };

    const proposals = parseUnbrowseResult(raw);
    expect(proposals[0].requestedAmount).toBe(3000);
  });

  it('extracts results from nested .data key', () => {
    const raw = {
      data: [
        {
          title: 'Data Grant',
          description: 'From data key',
          amount: 1000,
          team: 'Data Team',
        },
      ],
    };

    const proposals = parseUnbrowseResult(raw);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].title).toBe('Data Grant');
  });

  it('extracts results from a direct array', () => {
    const raw = [
      {
        title: 'Direct Array Grant',
        description: 'Directly an array',
        amount: 2000,
        team: 'Array Team',
      },
    ];

    const proposals = parseUnbrowseResult(raw);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].title).toBe('Direct Array Grant');
  });

  it('returns empty array for malformed/empty input (null, undefined, {}, {result: null})', () => {
    expect(parseUnbrowseResult(null)).toEqual([]);
    expect(parseUnbrowseResult(undefined)).toEqual([]);
    expect(parseUnbrowseResult({})).toEqual([]);
    expect(parseUnbrowseResult({ result: null })).toEqual([]);
    expect(parseUnbrowseResult('')).toEqual([]);
    expect(parseUnbrowseResult(42)).toEqual([]);
  });

  it('filters out items with no title AND no name', () => {
    const raw = {
      result: [
        { title: 'Good Grant', description: 'ok', amount: 100, team: 'T' },
        { description: 'No title at all', amount: 200, team: 'T' },
      ],
    };

    const proposals = parseUnbrowseResult(raw);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].title).toBe('Good Grant');
  });

  it('parses string amounts like "5000" and "$5,000" into numbers', () => {
    const raw = {
      result: [
        { title: 'String Amount A', description: 'test', amount: '5000', team: 'T' },
        { title: 'String Amount B', description: 'test', amount: '$5,000', team: 'T' },
        { title: 'String Amount C', description: 'test', amount: '$12,500.50', team: 'T' },
      ],
    };

    const proposals = parseUnbrowseResult(raw);
    expect(proposals[0].requestedAmount).toBe(5000);
    expect(proposals[1].requestedAmount).toBe(5000);
    expect(proposals[2].requestedAmount).toBe(12500.5);
  });

  it('defaults missing amounts to 0', () => {
    const raw = {
      result: [
        { title: 'No Amount', description: 'test', team: 'T' },
      ],
    };

    const proposals = parseUnbrowseResult(raw);
    expect(proposals[0].requestedAmount).toBe(0);
  });

  it('handles NaN and invalid amount values gracefully', () => {
    const raw = {
      result: [
        { title: 'Bad Amount', description: 'test', amount: 'not-a-number', team: 'T' },
        { title: 'Null Amount', description: 'test', amount: null, team: 'T' },
      ],
    };

    const proposals = parseUnbrowseResult(raw);
    expect(proposals[0].requestedAmount).toBe(0);
    expect(proposals[1].requestedAmount).toBe(0);
  });

  it('defaults missing description to empty string', () => {
    const raw = {
      result: [{ title: 'No Desc', amount: 100, team: 'T' }],
    };

    const proposals = parseUnbrowseResult(raw);
    expect(proposals[0].description).toBe('');
  });

  it('defaults missing team info to "Unknown team"', () => {
    const raw = {
      result: [{ title: 'No Team', description: 'test', amount: 100 }],
    };

    const proposals = parseUnbrowseResult(raw);
    expect(proposals[0].teamInfo).toBe('Unknown team');
  });
});

describe('UnbrowseClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('resolveIntent', () => {
    it('sends POST to /v1/intent/resolve with correct body shape', async () => {
      const mockResponse = { result: [{ title: 'Test' }] };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new UnbrowseClient('http://localhost:6969');
      const result = await client.resolveIntent('find grants');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('http://localhost:6969/v1/intent/resolve');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.intent).toBe('find grants');
    });

    it('includes params and context when targetUrl is provided', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = new UnbrowseClient('http://localhost:6969');
      await client.resolveIntent('find grants', 'https://solana.org/grants');

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.params).toEqual({ url: 'https://solana.org/grants' });
      expect(body.context).toEqual({ url: 'https://solana.org/grants' });
    });

    it('throws on non-OK response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const client = new UnbrowseClient('http://localhost:6969');
      await expect(client.resolveIntent('find grants')).rejects.toThrow(/500/);
    });

    it('aborts after timeout', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, opts: { signal: AbortSignal }) => {
          return new Promise((_resolve, reject) => {
            // Listen for abort signal
            if (opts.signal) {
              opts.signal.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              });
            }
          });
        },
      );

      const client = new UnbrowseClient('http://localhost:6969', 50); // 50ms timeout
      await expect(client.resolveIntent('slow query')).rejects.toThrow();
    });

    it('includes Bearer token when UNBROWSE_API_KEY is set', async () => {
      process.env.UNBROWSE_API_KEY = 'test-api-key-123';

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = new UnbrowseClient('http://localhost:6969');
      await client.resolveIntent('find grants');

      const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer test-api-key-123');

      delete process.env.UNBROWSE_API_KEY;
    });
  });

  describe('healthCheck', () => {
    it('returns true on 200 response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
      });

      const client = new UnbrowseClient('http://localhost:6969');
      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

      const client = new UnbrowseClient('http://localhost:6969');
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    it('returns false on non-OK response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 503,
      });

      const client = new UnbrowseClient('http://localhost:6969');
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });
});
