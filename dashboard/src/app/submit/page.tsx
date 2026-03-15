import Link from 'next/link';
import { PassportGate } from '@/components/PassportGate';
import { ProposalForm } from '@/components/ProposalForm';

/**
 * /submit page.
 *
 * Proposal submission page gated by Human Passport verification.
 * Unverified users see only the Passport verification UI.
 * Verified users (humanity score >= 20) see the full proposal form.
 */
export default function SubmitPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-gray-950 p-6 md:p-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-cyan-400"
      >
        &larr; Back to Dashboard
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Submit a Proposal</h1>
        <p className="mt-1 text-gray-400">
          Propose a project for AI agent evaluation and funding
        </p>
      </header>

      <PassportGate>
        <ProposalForm />
      </PassportGate>
    </main>
  );
}
