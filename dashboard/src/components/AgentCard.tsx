'use client';

import { useState } from 'react';
import type { AgentInfo } from '@/lib/types';

interface AgentCardProps {
  agent: AgentInfo;
}

const ROLE_COLORS: Record<string, string> = {
  scout: 'bg-green-900/50 text-green-400',
  analyzer: 'bg-blue-900/50 text-blue-400',
  treasury: 'bg-yellow-900/50 text-yellow-400',
  governance: 'bg-purple-900/50 text-purple-400',
};

function truncateKey(key: string): string {
  if (key.length <= 11) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function AgentCard({ agent }: AgentCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(agent.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const badgeColor = ROLE_COLORS[agent.role] ?? 'bg-gray-800 text-gray-400';

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium uppercase ${badgeColor}`}
          >
            {agent.role}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-400">{agent.description}</p>

      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-xs text-gray-500">
          {truncateKey(agent.publicKey)}
        </span>
        <button
          onClick={handleCopy}
          className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300"
          title="Copy public key"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <a
        href={agent.solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm text-cyan-400 hover:underline"
      >
        View on Solscan
      </a>
    </div>
  );
}
