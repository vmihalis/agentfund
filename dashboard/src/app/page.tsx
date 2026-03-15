'use client';

import { useEffect, useState } from 'react';
import { fetchAgents, fetchTreasury, fetchPayments } from '@/lib/api';
import type { AgentInfo, TreasuryData, PaymentRecord } from '@/lib/types';
import { AgentCard } from '@/components/AgentCard';
import { TreasuryPanel } from '@/components/TreasuryPanel';
import { PaymentHistory } from '@/components/PaymentHistory';

export default function Home() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [treasury, setTreasury] = useState<TreasuryData | undefined>();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    fetchAgents().then(setAgents);
    fetchTreasury().then(setTreasury);
    fetchPayments().then(setPayments);
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 p-6 md:p-10">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white">AgentFund Dashboard</h1>
        <p className="mt-1 text-gray-400">Autonomous AI Treasury Management</p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-gray-200">Agent Identities</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {agents.map((agent) => (
            <AgentCard key={agent.role} agent={agent} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <TreasuryPanel data={treasury} />
      </section>

      <section>
        <PaymentHistory payments={payments} />
      </section>
    </main>
  );
}
