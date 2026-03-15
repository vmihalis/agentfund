'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAgents, fetchTreasury, fetchPayments, fetchProposals } from '@/lib/api';
import type { AgentInfo, TreasuryData, PaymentRecord, PipelineProposal } from '@/lib/types';
import { AgentStatusBar } from '@/components/AgentStatusBar';
import { VoiceWidget } from '@/components/VoiceWidget';
import { ProposalPipeline } from '@/components/ProposalPipeline';
import { ActivityFeed } from '@/components/ActivityFeed';
import { FinancePanel } from '@/components/FinancePanel';

export default function Home() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [treasury, setTreasury] = useState<TreasuryData | undefined>();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [proposals, setProposals] = useState<PipelineProposal[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshAll = useCallback(() => {
    fetchTreasury().then(setTreasury);
    fetchPayments().then(setPayments);
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

  // Auto-refresh payments every 5 seconds for live x402 data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPayments().then(setPayments);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AgentFund</h1>
          <p className="text-xs text-gray-500">
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

      {/* Agent Status Bar */}
      <section className="mb-6">
        {loading && agents.length === 0 ? (
          <div className="h-12 animate-pulse rounded-lg border border-gray-800 bg-gray-900" />
        ) : (
          <AgentStatusBar agents={agents} />
        )}
      </section>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column: Command + Proposals */}
        <div className="space-y-6 lg:col-span-3">
          <VoiceWidget onCommandSent={refreshAll} />
          <ProposalPipeline proposals={proposals} />
        </div>

        {/* Right column: Activity + Finance */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Live Activity
            </h2>
            <ActivityFeed />
          </div>
          <FinancePanel treasury={treasury} payments={payments} />
        </div>
      </div>
    </main>
  );
}
