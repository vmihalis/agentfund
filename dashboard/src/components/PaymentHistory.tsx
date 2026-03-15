'use client';

import type { PaymentRecord } from '@/lib/types';

interface PaymentHistoryProps {
  payments: PaymentRecord[];
}

const AGENT_STYLE: Record<string, { icon: string; color: string }> = {
  governance: { icon: '⚖️', color: 'text-yellow-400' },
  scout: { icon: '🔍', color: 'text-cyan-400' },
  analyzer: { icon: '🧠', color: 'text-purple-400' },
  treasury: { icon: '💰', color: 'text-green-400' },
  recipient: { icon: '📥', color: 'text-gray-400' },
};

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function AgentBadge({ name }: { name: string }) {
  const style = AGENT_STYLE[name] ?? { icon: '🤖', color: 'text-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-0.5 text-xs font-medium ${style.color}`}>
      <span>{style.icon}</span>
      {name}
    </span>
  );
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  // Show newest first
  const sorted = [...payments].reverse();

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          x402 Payment History
        </h2>
        {payments.length > 0 && (
          <span className="rounded-full bg-cyan-900/40 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
            {payments.length} payment{payments.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">
          No payments yet. Run a pipeline command to see agent-to-agent payments.
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {sorted.map((p) => (
            <div
              key={p.txSignature + p.timestamp}
              className="flex items-center gap-3 rounded-md bg-gray-950 px-4 py-3"
            >
              {/* From agent */}
              <AgentBadge name={p.from} />

              {/* Arrow with amount */}
              <div className="flex items-center gap-1 text-gray-500">
                <span className="text-xs">→</span>
                <span className="rounded bg-green-900/30 px-1.5 py-0.5 font-mono text-xs font-bold text-green-400">
                  {p.amount.toFixed(3)} USDC
                </span>
                <span className="text-xs">→</span>
              </div>

              {/* To agent */}
              <AgentBadge name={p.to} />

              {/* Service label */}
              <span className="ml-auto text-xs text-gray-500">
                {p.service}
              </span>

              {/* Time */}
              <span className="text-xs text-gray-600">
                {formatRelativeTime(p.timestamp)}
              </span>

              {/* Tx link */}
              {p.txUrl && (
                <a
                  href={p.txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-500 hover:text-cyan-400"
                  title={p.txSignature}
                >
                  Solscan
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
