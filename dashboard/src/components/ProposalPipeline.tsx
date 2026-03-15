'use client';

import type { PipelineProposal, PipelineStage } from '@/lib/types';

const STAGES: { key: PipelineStage; label: string; color: string; bg: string; border: string }[] = [
  { key: 'submitted', label: 'Submitted', color: 'text-gray-400', bg: 'bg-gray-800/50', border: 'border-gray-600' },
  { key: 'evaluating', label: 'Evaluating', color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-500' },
  { key: 'approved', label: 'Approved', color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-500' },
  { key: 'funded', label: 'Funded', color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-500' },
];

function StageBadge({ stage }: { stage: PipelineStage }) {
  const config = STAGES.find((s) => s.key === stage) ?? STAGES[0];
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color} ${config.bg}`}
    >
      {config.label}
    </span>
  );
}

function StageProgress({ current }: { current: PipelineStage }) {
  const currentIdx = STAGES.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, idx) => (
        <div key={stage.key} className="flex items-center">
          <div
            className={`h-2 w-2 rounded-full ${
              idx <= currentIdx ? stage.color.replace('text-', 'bg-') : 'bg-gray-700'
            }`}
          />
          {idx < STAGES.length - 1 && (
            <div
              className={`h-0.5 w-4 ${
                idx < currentIdx ? 'bg-gray-500' : 'bg-gray-800'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function formatTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function ProposalPipeline({
  proposals,
}: {
  proposals: PipelineProposal[];
}) {
  if (proposals.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-2 text-sm font-semibold text-white">
          Proposal Pipeline
        </h2>
        <p className="text-xs text-gray-500">
          No proposals in the pipeline yet.
        </p>
      </div>
    );
  }

  // Group proposals by stage for column headers
  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: proposals.filter((p) => p.stage === s.key).length,
  }));

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900">
      {/* Header with stage counts inline */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-white">
          Proposal Pipeline
        </h2>
        <div className="flex gap-2">
          {stageCounts.map((s) => (
            <div
              key={s.key}
              className={`flex items-center gap-1 rounded px-2 py-0.5 ${s.bg}`}
            >
              <span className={`text-xs ${s.color}`}>{s.label}</span>
              <span className="text-xs text-gray-500">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Proposal List */}
      <div className="divide-y divide-gray-800/50">
        {proposals
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((proposal) => {
            const stageConfig = STAGES.find((s) => s.key === proposal.stage) ?? STAGES[0];
            return (
              <div
                key={proposal.id}
                className={`border-l-2 ${stageConfig.border} px-4 py-3`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {proposal.title}
                    </h3>
                    <StageBadge stage={proposal.stage} />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StageProgress current={proposal.stage} />
                    <span className="text-xs text-gray-500">
                      {formatTime(proposal.updatedAt)}
                    </span>
                  </div>
                </div>
                {proposal.evaluation && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-400">
                    <span>
                      Score:{' '}
                      <span className="font-medium text-gray-300">
                        {proposal.evaluation.overallScore}/10
                      </span>
                    </span>
                    <span className="text-gray-700">|</span>
                    <span className="truncate">{proposal.evaluation.reasoning}</span>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
