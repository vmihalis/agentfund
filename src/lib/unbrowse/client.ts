/**
 * HTTP client wrapper for the Unbrowse intent resolution API.
 *
 * Encapsulates /v1/intent/resolve POST calls with timeout, auth,
 * and health checking. Designed for constructor injection into ScoutAgent.
 */

export class UnbrowseClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl = 'http://localhost:6969', timeoutMs = 90000) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Resolve a natural language intent via Unbrowse.
   *
   * @param intent - Natural language description of what to find
   * @param targetUrl - Optional URL to target for data extraction
   * @returns Raw Unbrowse response (caller must parse)
   * @throws On non-OK HTTP response or timeout
   */
  async resolveIntent(intent: string, targetUrl?: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const apiKey = process.env.UNBROWSE_API_KEY;
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Strip trailing slashes — Unbrowse returns "Invalid URL" with them
      const cleanUrl = targetUrl?.replace(/\/+$/, '');

      const res = await fetch(`${this.baseUrl}/v1/intent/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          intent,
          context: cleanUrl ? { url: cleanUrl } : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Unbrowse returned ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Check if Unbrowse is reachable and healthy.
   *
   * @returns true if Unbrowse responds with 200, false otherwise (never throws)
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
