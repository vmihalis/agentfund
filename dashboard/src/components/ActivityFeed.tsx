'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchActivity, type ActivityEntry } from '@/lib/activity';

/** Color mapping for entry type badges. */
const TYPE_COLORS: Record<string, string> = {
  status: 'bg-blue-600',
  step: 'bg-cyan-600',
  decision: 'bg-yellow-600',
  funded: 'bg-green-600',
  error: 'bg-red-600',
};

/** Format a timestamp as relative time (e.g., "2s ago", "5m ago"). */
function relativeTime(timestamp: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/**
 * Live activity feed component with 2-second polling.
 *
 * Self-contained: no props required. Fetches from /api/activity
 * and displays entries in reverse chronological order (newest first).
 */
export function ActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const lastTimestampRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function poll() {
      const newEntries = await fetchActivity(lastTimestampRef.current);
      if (!active) return;

      if (newEntries.length > 0) {
        setEntries((prev) => {
          const merged = [...prev, ...newEntries];
          // Keep last 100 entries
          return merged.slice(-100);
        });
        const maxTs = Math.max(...newEntries.map((e) => e.timestamp));
        lastTimestampRef.current = maxTs;
      }
    }

    // Initial fetch
    poll();

    // Poll every 2 seconds
    const interval = setInterval(poll, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Display in reverse chronological order (newest first)
  const sorted = [...entries].reverse();

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center text-xs text-gray-500">
        No activity yet. Run a pipeline command to see agent events.
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900">
      <ul className="divide-y divide-gray-800/50">
        {sorted.map((entry) => (
          <li key={entry.id} className="flex items-start gap-2 px-3 py-2">
            {/* Type badge */}
            <span
              className={`mt-0.5 inline-block shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-white ${TYPE_COLORS[entry.type] ?? 'bg-gray-600'}`}
            >
              {entry.type}
            </span>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                {entry.agent && (
                  <span className="text-xs font-medium text-cyan-400">
                    {entry.agent}
                  </span>
                )}
                <span className="text-xs text-gray-300 truncate">{entry.message}</span>
              </div>
              {entry.txSignature && (
                <a
                  href={`https://solscan.io/tx/${entry.txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-500 hover:text-cyan-400"
                >
                  tx ↗
                </a>
              )}
            </div>

            {/* Timestamp */}
            <span className="shrink-0 text-xs text-gray-600">
              {relativeTime(entry.timestamp)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
