'use client';

import { useState } from 'react';
import type { AgentInfo } from '@/lib/types';

const ROLE_CONFIG: Record<string, { icon: string; dot: string; badge: string }> = {
  scout: { icon: '🔍', dot: 'bg-green-500', badge: 'bg-green-900/40 text-green-400 border-green-800/50' },
  analyzer: { icon: '🧠', dot: 'bg-blue-500', badge: 'bg-blue-900/40 text-blue-400 border-blue-800/50' },
  treasury: { icon: '💰', dot: 'bg-yellow-500', badge: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' },
  governance: { icon: '⚖️', dot: 'bg-purple-500', badge: 'bg-purple-900/40 text-purple-400 border-purple-800/50' },
};

function truncateKey(key: string): string {
  if (key.length <= 11) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function AgentStatusBar({ agents }: { agents: AgentInfo[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 mr-1">
          Agents
        </span>
        {agents.map((agent) => {
          const config = ROLE_CONFIG[agent.role] ?? {
            icon: '🤖',
            dot: 'bg-gray-500',
            badge: 'bg-gray-800 text-gray-400 border-gray-700',
          };
          const isExpanded = expanded === agent.role;

          return (
            <div key={agent.role} className="relative">
              <button
                onClick={() => setExpanded(isExpanded ? null : agent.role)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${config.badge} ${isExpanded ? 'ring-1 ring-gray-600' : 'hover:brightness-125'}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                <span>{config.icon}</span>
                {agent.name}
                {agent.metaplex?.verified && (
                  <span className="ml-0.5 text-emerald-400" title="Metaplex Identity Verified">
                    ✓
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl">
                  <p className="text-xs text-gray-400 mb-2">{agent.description}</p>

                  {/* Wallet */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-600 w-10">Wallet</span>
                    <span className="font-mono text-xs text-gray-500">
                      {truncateKey(agent.publicKey)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(agent.publicKey);
                      }}
                      className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                    >
                      {copied === agent.publicKey ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  {/* Metaplex Identity */}
                  {agent.metaplex && (
                    <div className="mt-2 pt-2 border-t border-gray-800">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-gray-600">On-Chain Identity</span>
                        {agent.metaplex.verified ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800/50">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-900/40 px-1.5 py-0.5 text-[10px] font-medium text-red-400 border border-red-800/50">
                            Unverified
                          </span>
                        )}
                      </div>

                      {/* Asset */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-gray-600 w-10">Asset</span>
                        <span className="font-mono text-xs text-gray-500">
                          {truncateKey(agent.metaplex.assetAddress)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(agent.metaplex!.assetAddress);
                          }}
                          className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                        >
                          {copied === agent.metaplex.assetAddress ? 'Copied!' : 'Copy'}
                        </button>
                      </div>

                      {/* PDA */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-600 w-10">PDA</span>
                        <span className="font-mono text-xs text-gray-500">
                          {truncateKey(agent.metaplex.pdaAddress)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(agent.metaplex!.pdaAddress);
                          }}
                          className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                        >
                          {copied === agent.metaplex.pdaAddress ? 'Copied!' : 'Copy'}
                        </button>
                      </div>

                      {/* Links */}
                      <div className="flex gap-3">
                        <a
                          href={agent.metaplex.assetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Asset on Solscan ↗
                        </a>
                        <a
                          href={agent.metaplex.pdaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          PDA on Solscan ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Wallet Solscan link */}
                  {!agent.metaplex && (
                    <a
                      href={agent.solscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Solscan ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
