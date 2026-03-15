'use client';

import type { PaymentRecord } from '@/lib/types';

interface PaymentHistoryProps {
  payments: PaymentRecord[];
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function truncateSignature(sig: string): string {
  if (sig.length <= 11) return sig;
  return `${sig.slice(0, 4)}...${sig.slice(-4)}`;
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">
        x402 Payment History
      </h2>

      {payments.length === 0 ? (
        <p className="text-sm text-gray-500">No payments recorded</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">From</th>
                <th className="pb-2 pr-4">To</th>
                <th className="pb-2 pr-4">Amount (USDC)</th>
                <th className="pb-2 pr-4">Service</th>
                <th className="pb-2">Tx</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr
                  key={p.txSignature}
                  className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}
                >
                  <td className="py-2 pr-4 text-gray-300">
                    {formatRelativeTime(p.timestamp)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs font-medium text-gray-300">
                      {p.from}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs font-medium text-gray-300">
                      {p.to}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-300">
                    {p.amount.toFixed(3)}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{p.service}</td>
                  <td className="py-2">
                    <a
                      href={p.txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-cyan-400 hover:underline"
                      title={p.txSignature}
                    >
                      {truncateSignature(p.txSignature)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
