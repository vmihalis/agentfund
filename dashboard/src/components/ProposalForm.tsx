'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ProposalSubmission } from '@/lib/types';

interface ProposalFormProps {
  onSubmit?: (proposal: ProposalSubmission) => void;
}

interface FormErrors {
  title?: string;
  description?: string;
  requestedAmount?: string;
  teamInfo?: string;
}

/**
 * Proposal submission form.
 *
 * Validates field lengths client-side before POSTing to /api/proposals/submit.
 * Displays inline errors and a success/error message after submission.
 */
export function ProposalForm({ onSubmit }: ProposalFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [teamInfo, setTeamInfo] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): FormErrors {
    const errs: FormErrors = {};

    if (title.length < 3 || title.length > 100) {
      errs.title = 'Title must be 3-100 characters';
    }
    if (description.length < 20 || description.length > 2000) {
      errs.description = 'Description must be 20-2000 characters';
    }
    const amount = Number(requestedAmount);
    if (!requestedAmount || isNaN(amount) || amount < 1) {
      errs.requestedAmount = 'Amount must be at least 1 USDC';
    }
    if (teamInfo.length < 10 || teamInfo.length > 500) {
      errs.teamInfo = 'Team info must be 10-500 characters';
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }

    const proposal: ProposalSubmission = {
      title,
      description,
      requestedAmount: Number(requestedAmount),
      teamInfo,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/proposals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Submission failed' }));
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitted(true);
      onSubmit?.(proposal);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center">
        <h3 className="mb-2 text-lg font-semibold text-green-400">
          Proposal submitted!
        </h3>
        <p className="mb-4 text-sm text-gray-300">
          Track it in the pipeline.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {submitError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{submitError}</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-gray-300">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Your proposal title"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        {errors.title && (
          <p className="mt-1 text-xs text-red-400">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-300">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your project and how it benefits the Solana ecosystem"
          rows={5}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-400">{errors.description}</p>
        )}
      </div>

      {/* Requested Amount */}
      <div>
        <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-gray-300">
          Requested Amount (USDC)
        </label>
        <input
          id="amount"
          type="number"
          value={requestedAmount}
          onChange={(e) => setRequestedAmount(e.target.value)}
          placeholder="1000"
          min={1}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        {errors.requestedAmount && (
          <p className="mt-1 text-xs text-red-400">{errors.requestedAmount}</p>
        )}
      </div>

      {/* Team Info */}
      <div>
        <label htmlFor="teamInfo" className="mb-1.5 block text-sm font-medium text-gray-300">
          Team Info
        </label>
        <textarea
          id="teamInfo"
          value={teamInfo}
          onChange={(e) => setTeamInfo(e.target.value)}
          placeholder="Tell us about your team, experience, and relevant background"
          rows={3}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        {errors.teamInfo && (
          <p className="mt-1 text-xs text-red-400">{errors.teamInfo}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Proposal'}
      </button>
    </form>
  );
}
