'use client';

import type { PaymentRecord } from '@/lib/types';

interface PaymentHistoryProps {
  payments: PaymentRecord[];
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">x402 Payment History</h2>
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
                  <td className="py-2 pr-4 text-gray-300">{p.timestamp}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.from}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.to}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.amount}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.service}</td>
                  <td className="py-2">
                    <a
                      href={p.txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline"
                    >
                      View
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
