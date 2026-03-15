'use client';

import type { TreasuryData } from '@/lib/types';

interface TreasuryPanelProps {
  data: TreasuryData | undefined;
}

export function TreasuryPanel({ data }: TreasuryPanelProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">Treasury Status</h2>
      {!data ? (
        <p className="text-gray-500">Loading treasury data...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-md bg-gray-950 p-4 text-center">
              <p className="text-sm text-gray-400">SOL Balance</p>
              <p className="text-2xl font-bold text-white">{data.solBalance.toFixed(4)}</p>
            </div>
            <div className="rounded-md bg-gray-950 p-4 text-center">
              <p className="text-sm text-gray-400">USDC Balance</p>
              <p className="text-2xl font-bold text-white">{data.usdcBalance.toFixed(2)}</p>
            </div>
            <div className="rounded-md bg-gray-950 p-4 text-center">
              <p className="text-sm text-gray-400">Total USD Value</p>
              <p className="text-2xl font-bold text-white">${data.totalValueUsd.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-300">LP Positions</h3>
            {data.lpPositions.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">No active LP positions</p>
            ) : (
              <p className="mt-1 text-sm text-gray-500">{data.lpPositions.length} position(s)</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
