'use client';

import type { TreasuryData } from '@/lib/types';

interface TreasuryPanelProps {
  data: TreasuryData | undefined;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-md bg-gray-950 p-4">
            <div className="mx-auto mb-2 h-4 w-20 rounded bg-gray-800" />
            <div className="mx-auto h-8 w-24 rounded bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TreasuryPanel({ data }: TreasuryPanelProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">Treasury Status</h2>

      {!data ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-md bg-gray-950 p-4 text-center">
              <p className="text-sm text-gray-400">SOL Balance</p>
              <p className="text-2xl font-bold text-white">
                {data.solBalance.toFixed(4)}
              </p>
            </div>
            <div className="rounded-md bg-gray-950 p-4 text-center">
              <p className="text-sm text-gray-400">USDC Balance</p>
              <p className="text-2xl font-bold text-white">
                {data.usdcBalance.toFixed(2)}
              </p>
            </div>
            <div className="rounded-md bg-gray-950 p-4 text-center">
              <p className="text-sm text-gray-400">Total USD Value</p>
              <p className="text-2xl font-bold text-white">
                ${data.totalValueUsd.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-gray-300">
              LP Positions
            </h3>
            {data.lpPositions.length === 0 ? (
              <p className="text-sm text-gray-500">No active LP positions</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="pb-2 pr-4">Pool</th>
                      <th className="pb-2 pr-4">Pair</th>
                      <th className="pb-2 pr-4">Liquidity Share</th>
                      <th className="pb-2">Unclaimed Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lpPositions.map((lp) => (
                      <tr key={lp.positionAddress} className="border-b border-gray-800/50">
                        <td className="py-2 pr-4">
                          <a
                            href={`https://solscan.io/address/${lp.poolAddress}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-cyan-400 hover:underline"
                          >
                            {truncateAddress(lp.poolAddress)}
                          </a>
                        </td>
                        <td className="py-2 pr-4 text-gray-300">
                          {lp.tokenX}/{lp.tokenY}
                        </td>
                        <td className="py-2 pr-4 text-gray-300">
                          {(lp.liquidityShare * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 text-gray-300">
                          {lp.unclaimedFees.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
