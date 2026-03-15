'use client';

import type { AgentInfo } from '@/lib/types';

interface AgentCardProps {
  agent: AgentInfo;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
      <span className="text-xs font-medium uppercase text-gray-500">{agent.role}</span>
      <p className="mt-2 text-sm text-gray-400">{agent.description}</p>
      <p className="mt-2 font-mono text-xs text-gray-500">{agent.publicKey}</p>
      <a
        href={agent.solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-sm text-cyan-400 hover:underline"
      >
        View on Solscan
      </a>
    </div>
  );
}
