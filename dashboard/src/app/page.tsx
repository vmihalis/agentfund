'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAgents, fetchTreasury, fetchPayments, fetchProposals } from '@/lib/api';
import { fetchActivity, type ActivityEntry } from '@/lib/activity';
import type { AgentInfo, TreasuryData, PaymentRecord, PipelineProposal } from '@/lib/types';
import { AgentStatusBar } from '@/components/AgentStatusBar';
import { VoiceWidget } from '@/components/VoiceWidget';
import { ProposalPipeline } from '@/components/ProposalPipeline';
import { ActivityFeed } from '@/components/ActivityFeed';
import { FinancePanel } from '@/components/FinancePanel';
import { DeliberationView } from '@/components/DeliberationView';

export default function Home() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [treasury, setTreasury] = useState<TreasuryData | undefined>();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [proposals, setProposals] = useState<PipelineProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);

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

  // Poll activity for deliberation view
  useEffect(() => {
    let lastTs = 0;

    async function poll() {
      const entries = await fetchActivity(lastTs);
      if (entries.length > 0) {
        setActivityEntries(prev => [...prev, ...entries].slice(-200));
        lastTs = Math.max(...entries.map(e => e.timestamp));
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // Check if deliberation is active (governance thinking events present)
  const hasDeliberation = activityEntries.some(
    e => e.type === 'thinking' && e.agent === 'governance' && (e.message.includes('Round') || e.message.includes('Triaging'))
  );

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
        {/* Left column: Command + Deliberation + Proposals */}
        <div className="space-y-6 lg:col-span-3">
          <VoiceWidget onCommandSent={refreshAll} />
          {hasDeliberation && (
            <DeliberationView entries={activityEntries} />
          )}
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
