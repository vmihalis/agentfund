'use client';

import { useState } from 'react';
import type { ActivityEntry } from '@/lib/activity';

/** Confidence bar for scores. */
function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-16 shrink-0">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-8 text-right">{value}/{max}</span>
    </div>
  );
}

/**
 * Expandable reasoning panel for activity entries.
 * Click to expand and see detailed scores, reasoning, and confidence.
 */
export function AgentReasoningPanel({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);

  // Only show expand for confidence/thinking entries
  if (entry.type !== 'confidence' && entry.type !== 'thinking') return null;

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left"
    >
      {expanded && entry.type === 'confidence' && entry.confidence !== undefined && (
        <div className="mt-2 p-2 rounded bg-gray-800/50 space-y-1.5">
          <ScoreBar label="Confidence" value={Math.round(entry.confidence * 10)} />
          <p className="text-[10px] text-gray-500 mt-1">{entry.message}</p>
        </div>
      )}
      {expanded && entry.type === 'thinking' && (
        <div className="mt-2 p-2 rounded bg-gray-800/50">
          <div className="flex items-center gap-2 mb-1">
            {entry.phase && (
              <span className={`text-[10px] uppercase tracking-wider ${
                entry.phase === 'concluding' ? 'text-green-500' :
                entry.phase === 'weighing' ? 'text-amber-500' : 'text-purple-500'
              }`}>
                {entry.phase}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400">{entry.message}</p>
        </div>
      )}
      <span className="text-[10px] text-gray-600 hover:text-gray-400 mt-1 inline-block">
        {expanded ? '▲ Collapse' : '▼ Expand reasoning'}
      </span>
    </button>
  );
}
