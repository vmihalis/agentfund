'use client';

import { useState } from 'react';
import type { TreasuryData, PaymentRecord } from '@/lib/types';

type Tab = 'treasury' | 'payments';

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
  return `${Math.floor(diffMin / 60)}h ago`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function AgentBadge({ name }: { name: string }) {
  const style = AGENT_STYLE[name] ?? { icon: '🤖', color: 'text-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-gray-800 px-1.5 py-0.5 text-xs font-medium ${style.color}`}>
      <span>{style.icon}</span>
      {name}
    </span>
  );
}

export function FinancePanel({
  treasury,
  payments,
}: {
  treasury: TreasuryData | undefined;
  payments: PaymentRecord[];
}) {
  const [tab, setTab] = useState<Tab>('treasury');
  const sorted = [...payments].reverse();

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setTab('treasury')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === 'treasury'
              ? 'border-b-2 border-cyan-500 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Treasury
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === 'payments'
              ? 'border-b-2 border-cyan-500 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Payments
          {payments.length > 0 && (
            <span className="ml-1.5 rounded-full bg-cyan-900/40 px-1.5 py-0.5 text-xs text-cyan-400">
              {payments.length}
            </span>
          )}
        </button>
      </div>

      <div className="p-4">
        {tab === 'treasury' && (
          <>
            {!treasury ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-md bg-gray-950" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-gray-950 p-3 text-center">
                    <p className="text-xs text-gray-500">SOL</p>
                    <p className="text-lg font-bold text-white">
                      {treasury.solBalance.toFixed(4)}
                    </p>
                  </div>
                  <div className="rounded-md bg-gray-950 p-3 text-center">
                    <p className="text-xs text-gray-500">USDC</p>
                    <p className="text-lg font-bold text-white">
                      {treasury.usdcBalance.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-md bg-gray-950 p-3 text-center">
                    <p className="text-xs text-gray-500">Total USD</p>
                    <p className="text-lg font-bold text-white">
                      ${treasury.totalValueUsd.toFixed(2)}
                    </p>
                  </div>
                </div>

                {treasury.lpPositions.length > 0 && (
                  <div className="mt-3">
                    <h3 className="mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      LP Positions
                    </h3>
                    <div className="space-y-1.5">
                      {treasury.lpPositions.map((lp) => (
                        <div
                          key={lp.positionAddress}
                          className="flex items-center justify-between rounded-md bg-gray-950 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://solscan.io/address/${lp.poolAddress}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-cyan-400 hover:underline"
                            >
                              {truncateAddress(lp.poolAddress)}
                            </a>
                            <span className="text-gray-400">
                              {lp.tokenX}/{lp.tokenY}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-400">
                            <span>{(lp.liquidityShare * 100).toFixed(2)}%</span>
                            <span className="text-gray-600">|</span>
                            <span>Fees: {lp.unclaimedFees.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'payments' && (
          <>
            {sorted.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">
                No payments yet
              </p>
            ) : (
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {sorted.map((p) => (
                  <div
                    key={p.txSignature + p.timestamp}
                    className="flex items-center gap-2 rounded-md bg-gray-950 px-3 py-2"
                  >
                    <AgentBadge name={p.from} />
                    <span className="text-gray-600 text-xs">→</span>
                    <span className="font-mono text-xs font-bold text-green-400">
                      {p.amount.toFixed(3)}
                    </span>
                    <span className="text-gray-600 text-xs">→</span>
                    <AgentBadge name={p.to} />
                    <span className="ml-auto text-xs text-gray-600">
                      {p.service}
                    </span>
                    <span className="text-xs text-gray-600">
                      {formatRelativeTime(p.timestamp)}
                    </span>
                    {p.txUrl && (
                      <a
                        href={p.txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-500 hover:text-cyan-400"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
