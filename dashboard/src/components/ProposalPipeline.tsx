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
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-xl font-semibold text-white">
          Proposal Pipeline
        </h2>
        <p className="text-sm text-gray-500">
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
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">
        Proposal Pipeline
      </h2>

      {/* Stage Summary */}
      <div className="mb-4 flex gap-3 overflow-x-auto">
        {stageCounts.map((s) => (
          <div
            key={s.key}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 ${s.bg}`}
          >
            <span className={`text-xs font-medium ${s.color}`}>
              {s.label}
            </span>
            <span className="text-xs text-gray-500">{s.count}</span>
          </div>
        ))}
      </div>

      {/* Proposal List */}
      <div className="space-y-3">
        {proposals
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((proposal) => {
            const stageConfig = STAGES.find((s) => s.key === proposal.stage) ?? STAGES[0];
            return (
              <div
                key={proposal.id}
                className={`rounded-md border-l-2 ${stageConfig.border} bg-gray-950 p-4`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-white">
                      {proposal.title}
                    </h3>
                    <StageBadge stage={proposal.stage} />
                  </div>
                  <div className="flex items-center gap-4">
                    <StageProgress current={proposal.stage} />
                    <span className="text-xs text-gray-500">
                      {formatTime(proposal.updatedAt)}
                    </span>
                  </div>
                </div>
                {proposal.evaluation && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>
                      Score:{' '}
                      <span className="font-medium text-gray-300">
                        {proposal.evaluation.overallScore}/10
                      </span>
                    </span>
                    <span className="text-gray-600">|</span>
                    <span>{proposal.evaluation.reasoning}</span>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
