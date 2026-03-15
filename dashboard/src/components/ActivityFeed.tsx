'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { type ActivityEntry } from '@/lib/activity';

/** Agent display config: label + color. */
const AGENT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  scout: { label: 'Scout', color: 'text-emerald-400', icon: '🔍' },
  analyzer: { label: 'Analyzer', color: 'text-violet-400', icon: '📊' },
  governance: { label: 'Governance', color: 'text-amber-400', icon: '⚖️' },
  treasury: { label: 'Treasury', color: 'text-cyan-400', icon: '💰' },
};

/** Active filter for the feed. */
export type ActivityFilter = 'all' | 'thinking' | 'conversations' | 'decisions';

/** Map raw status strings to human-readable descriptions. */
function humanizeMessage(entry: ActivityEntry): { text: string; category: 'info' | 'action' | 'result' | 'payment' | 'error' | 'thinking' | 'question' | 'answer' | 'confidence' } {
  // New event types
  if (entry.type === 'thinking') return { text: entry.message, category: 'thinking' };
  if (entry.type === 'question') return { text: entry.message, category: 'question' };
  if (entry.type === 'answer') return { text: entry.message, category: 'answer' };
  if (entry.type === 'confidence') return { text: entry.message, category: 'confidence' };

  const msg = entry.message;

  // Payment events
  if (msg === 'x402-paying' || msg.startsWith('x402-paying'))
    return { text: `Sending x402 payment...`, category: 'payment' };
  if (msg === 'x402-paid' || msg.startsWith('x402-paid'))
    return { text: `Payment confirmed on-chain`, category: 'payment' };

  // Initialization / ready
  if (msg.includes('ready') || msg.includes('initialized') || msg.includes('Agent ready'))
    return { text: msg, category: 'info' };

  // Scout
  if (msg.startsWith('Searching:'))
    return { text: msg.replace('Searching: ', 'Scouting for '), category: 'action' };
  if (msg.startsWith('Found '))
    return { text: msg, category: 'result' };
  if (msg.startsWith('Scraping'))
    return { text: msg.replace('Scraping ', 'Fetching data from ').replace(' via Unbrowse', ''), category: 'action' };
  if (msg.startsWith('Scraped'))
    return { text: msg, category: 'result' };

  // Analyzer
  if (msg.startsWith('Scoring '))
    return { text: msg.replace('Scoring ', 'Evaluating '), category: 'action' };
  if (msg.includes('→') && msg.includes('/10'))
    return { text: msg, category: 'result' };
  if (msg.startsWith('Deep analysis'))
    return { text: msg, category: 'action' };

  // Governance
  if (msg.startsWith('Allocating'))
    return { text: msg, category: 'action' };
  if (msg.includes('approved for funding'))
    return { text: msg, category: 'result' };

  // Treasury
  if (msg.startsWith('Querying'))
    return { text: 'Checking on-chain balances...', category: 'action' };
  if (msg.includes('USDC') && msg.includes('SOL') && !msg.includes('Sending'))
    return { text: `Balance: ${msg}`, category: 'result' };
  if (msg.startsWith('Sending'))
    return { text: msg, category: 'action' };
  if (msg.includes('sent to'))
    return { text: msg, category: 'result' };

  // Funded
  if (entry.type === 'funded')
    return { text: msg, category: 'result' };

  // Decision
  if (entry.type === 'decision')
    return { text: msg, category: 'result' };

  // Error
  if (entry.type === 'error')
    return { text: msg, category: 'error' };

  return { text: msg, category: 'info' };
}

/** Category styling. */
const CATEGORY_STYLES: Record<string, { dot: string; bg: string }> = {
  action: { dot: 'bg-blue-400', bg: '' },
  result: { dot: 'bg-green-400', bg: '' },
  payment: { dot: 'bg-yellow-400', bg: '' },
  info: { dot: 'bg-gray-500', bg: '' },
  error: { dot: 'bg-red-500', bg: 'bg-red-950/30' },
  thinking: { dot: 'bg-purple-400', bg: '' },
  question: { dot: 'bg-orange-400', bg: '' },
  answer: { dot: 'bg-teal-400', bg: '' },
  confidence: { dot: 'bg-sky-400', bg: '' },
};

/** Format a timestamp as relative time. */
function relativeTime(timestamp: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/** Confidence bar component. */
function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="h-1.5 w-20 rounded-full bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500">{pct}%</span>
    </div>
  );
}

/** Phase label for thinking events. */
function PhaseLabel({ phase }: { phase?: string }) {
  if (!phase) return null;
  const colors: Record<string, string> = {
    considering: 'text-purple-500',
    weighing: 'text-amber-500',
    concluding: 'text-green-500',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider ${colors[phase] ?? 'text-gray-500'}`}>
      {phase}
    </span>
  );
}

/** Check if entry matches the current filter. */
function matchesFilter(entry: ActivityEntry, filter: ActivityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'thinking') return entry.type === 'thinking';
  if (filter === 'conversations') return entry.type === 'question' || entry.type === 'answer';
  if (filter === 'decisions') return entry.type === 'decision' || entry.type === 'funded' || entry.type === 'confidence';
  return true;
}

/**
 * Live activity feed with SSE streaming (polling fallback).
 * Shows agent events in a rich timeline format with thinking, conversations, and confidence.
 */
export function ActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const lastTimestampRef = useRef(0);
  const [, setTick] = useState(0);
  const sseRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addEntries = useCallback((newEntries: ActivityEntry[]) => {
    if (newEntries.length === 0) return;
    setEntries((prev) => {
      const merged = [...prev, ...newEntries];
      return merged.slice(-100);
    });
    const maxTs = Math.max(...newEntries.map((e) => e.timestamp));
    lastTimestampRef.current = maxTs;
  }, []);

  // Try SSE, fall back to polling
  useEffect(() => {
    let active = true;

    // Try SSE first
    try {
      const es = new EventSource('/api/activity/stream');
      sseRef.current = es;

      es.onmessage = (event) => {
        if (!active) return;
        try {
          const entry = JSON.parse(event.data) as ActivityEntry;
          addEntries([entry]);
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        // SSE failed — fall back to polling
        es.close();
        sseRef.current = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    function startPolling() {
      if (!active || pollingRef.current) return;

      async function poll() {
        try {
          const res = await fetch(`/api/activity?since=${lastTimestampRef.current}`);
          if (!res.ok || !active) return;
          const newEntries = (await res.json()) as ActivityEntry[];
          addEntries(newEntries);
        } catch { /* ignore */ }
      }

      poll();
      pollingRef.current = setInterval(poll, 2000);
    }

    // Update relative times every 5s
    const timeInterval = setInterval(() => setTick((t) => t + 1), 5000);

    return () => {
      active = false;
      sseRef.current?.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearInterval(timeInterval);
    };
  }, [addEntries]);

  const filtered = entries.filter(e => matchesFilter(e, filter));
  const sorted = [...filtered].reverse();

  const FILTER_BUTTONS: { key: ActivityFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'thinking', label: 'Thinking' },
    { key: 'conversations', label: 'Conversations' },
    { key: 'decisions', label: 'Decisions' },
  ];

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex gap-1 mb-2">
        {FILTER_BUTTONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              filter === key
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-500">
          {filter === 'all' ? 'Waiting for agent activity...' : `No ${filter} events yet`}
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900/50">
          <div className="relative pl-4">
            {/* Timeline line */}
            <div className="absolute left-[1.05rem] top-0 bottom-0 w-px bg-gray-800" />

            {sorted.map((entry) => {
              const agentCfg = AGENT_CONFIG[entry.agent ?? ''];
              const targetCfg = entry.targetAgent ? AGENT_CONFIG[entry.targetAgent] : null;
              const { text, category } = humanizeMessage(entry);
              const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.info;

              // Thinking events: brain icon, italic, dimmer
              if (entry.type === 'thinking') {
                return (
                  <div key={entry.id} className="relative flex items-start gap-3 py-2 pr-3">
                    <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot} ring-2 ring-gray-900`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {agentCfg && (
                          <span className={`text-xs font-semibold ${agentCfg.color}`}>
                            🧠 {agentCfg.label}
                          </span>
                        )}
                        <PhaseLabel phase={entry.phase} />
                        <span className="ml-auto shrink-0 text-xs text-gray-600">
                          {relativeTime(entry.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500 italic leading-snug">{text}</p>
                    </div>
                  </div>
                );
              }

              // Question/Answer: chat bubble style
              if (entry.type === 'question' || entry.type === 'answer') {
                const isQuestion = entry.type === 'question';
                return (
                  <div key={entry.id} className={`relative flex items-start gap-3 py-2 pr-3 ${isQuestion ? '' : 'pl-6'}`}>
                    <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot} ring-2 ring-gray-900`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        {agentCfg && (
                          <span className={`text-xs font-semibold ${agentCfg.color}`}>
                            {agentCfg.icon} {agentCfg.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-600">{isQuestion ? '→' : '←'}</span>
                        {targetCfg && (
                          <span className={`text-xs font-semibold ${targetCfg.color}`}>
                            {targetCfg.icon} {targetCfg.label}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-xs text-gray-600">
                          {relativeTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className={`mt-1 rounded-lg px-3 py-1.5 text-sm leading-snug ${
                        isQuestion ? 'bg-orange-950/20 text-orange-200 border border-orange-900/30' : 'bg-teal-950/20 text-teal-200 border border-teal-900/30'
                      }`}>
                        {text}
                      </div>
                    </div>
                  </div>
                );
              }

              // Confidence events: progress bar
              if (entry.type === 'confidence') {
                return (
                  <div key={entry.id} className="relative flex items-start gap-3 py-2 pr-3">
                    <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot} ring-2 ring-gray-900`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {agentCfg && (
                          <span className={`text-xs font-semibold ${agentCfg.color}`}>
                            📈 {agentCfg.label}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-xs text-gray-600">
                          {relativeTime(entry.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-400 leading-snug">{text}</p>
                      {entry.confidence !== undefined && (
                        <ConfidenceBar value={entry.confidence} />
                      )}
                    </div>
                  </div>
                );
              }

              // Default rendering for existing event types
              return (
                <div key={entry.id} className={`relative flex items-start gap-3 py-2 pr-3 ${style.bg}`}>
                  {/* Timeline dot */}
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot} ring-2 ring-gray-900`} />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      {agentCfg && (
                        <span className={`text-xs font-semibold ${agentCfg.color}`}>
                          {agentCfg.icon} {agentCfg.label}
                        </span>
                      )}
                      {entry.type === 'funded' && (
                        <span className="text-xs font-semibold text-green-400">
                          Funded
                        </span>
                      )}
                      {entry.type === 'decision' && (
                        <span className="text-xs font-semibold text-amber-400">
                          Decision
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-gray-600">
                        {relativeTime(entry.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-300 leading-snug">{text}</p>
                    {entry.txSignature && (
                      <a
                        href={`https://solscan.io/tx/${entry.txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-block text-xs text-cyan-500 hover:text-cyan-400"
                      >
                        View transaction on Solscan ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
