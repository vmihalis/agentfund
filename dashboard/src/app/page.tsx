'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAgents, fetchTreasury, fetchPayments, fetchProposals } from '@/lib/api';
import type { AgentInfo, TreasuryData, PaymentRecord, PipelineProposal } from '@/lib/types';
import { AgentCard } from '@/components/AgentCard';
import { TreasuryPanel } from '@/components/TreasuryPanel';
import { PaymentHistory } from '@/components/PaymentHistory';
import { VoiceWidget } from '@/components/VoiceWidget';
import { ProposalPipeline } from '@/components/ProposalPipeline';

export default function Home() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [treasury, setTreasury] = useState<TreasuryData | undefined>();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [proposals, setProposals] = useState<PipelineProposal[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProposals = useCallback(() => {
    fetchProposals().then(setProposals);
  }, []);

  useEffect(() => {
    Promise.all([
      fetchAgents().then(setAgents),
      fetchTreasury().then(setTreasury),
      fetchPayments().then(setPayments),
      fetchProposals().then(setProposals),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-gray-950 p-6 md:p-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">AgentFund Dashboard</h1>
          <p className="mt-1 text-gray-400">
            Autonomous AI Treasury Management
          </p>
        </div>
        <Link
          href="/submit"
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
        >
          Submit Proposal
        </Link>
      </header>

      {/* Agent Identities */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-gray-200">
          Agent Identities
        </h2>
        {loading && agents.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-lg border border-gray-800 bg-gray-900"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {agents.map((agent) => (
              <AgentCard key={agent.role} agent={agent} />
            ))}
          </div>
        )}
      </section>

      {/* Voice Command Center */}
      <section className="mb-10">
        <VoiceWidget onCommandSent={refreshProposals} />
      </section>

      {/* Proposal Pipeline */}
      <section className="mb-10">
        <ProposalPipeline proposals={proposals} />
      </section>

      {/* Treasury Status */}
      <section className="mb-10">
        <TreasuryPanel data={treasury} />
      </section>

      {/* Payment History */}
      <section>
        <PaymentHistory payments={payments} />
      </section>
    </main>
  );
}
