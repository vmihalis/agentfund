/**
 * Activity feed types and fetch helper for the dashboard.
 *
 * Mirrors the ActivityEntry shape from src/events/activity-log.ts
 * but is independent of root src/ module resolution (Next.js boundary).
 */

/** A single activity log entry from the agent event bus. */
export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: 'status' | 'step' | 'decision' | 'funded' | 'error';
  agent?: string;
  message: string;
  detail?: Record<string, unknown>;
  txSignature?: string;
}

/**
 * Fetch activity entries from the dashboard API route.
 *
 * @param since - Only return entries with timestamp > since (ms epoch)
 * @returns Array of activity entries (empty on error for graceful degradation)
 */
export async function fetchActivity(since = 0): Promise<ActivityEntry[]> {
  try {
    const res = await fetch(`/api/activity?since=${since}`);
    if (!res.ok) return [];
    return (await res.json()) as ActivityEntry[];
  } catch {
    return [];
  }
}
