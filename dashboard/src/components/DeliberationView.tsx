'use client';

import { useEffect, useState } from 'react';
import { type ActivityEntry } from '@/lib/activity';

interface TriageItem {
  proposalTitle: string;
  category: 'clear_fund' | 'clear_reject' | 'needs_deep_dive';
}

interface Conversation {
  question: string;
  answer?: string;
  from: string;
  to: string;
  correlationId: string;
}

/**
 * DeliberationView renders governance deliberation as a 3-step visual process:
 * 1. Triage: Cards per proposal showing initial categorization
 * 2. Deep-Dive: Shows questions asked to other agents
 * 3. Final Decision: Allocation results with confidence
 */
export function DeliberationView({ entries }: { entries: ActivityEntry[] }) {
  const [triageItems, setTriageItems] = useState<TriageItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [phase, setPhase] = useState<'idle' | 'triage' | 'deep-dive' | 'deciding' | 'complete'>('idle');

  useEffect(() => {
    // Build state from activity entries
    const govThinking = entries.filter(e => e.type === 'thinking' && e.agent === 'governance');
    const questions = entries.filter(e => e.type === 'question');
    const answers = entries.filter(e => e.type === 'answer');
    const decisions = entries.filter(e => e.type === 'decision');

    // Detect triage phase
    const triageThought = govThinking.find(e => e.message.includes('Triaging') || e.message.includes('Round 1'));
    if (triageThought && phase === 'idle') setPhase('triage');

    // Parse triage results from thinking events
    const triageResult = govThinking.find(e => e.message.includes('clear-fund') || e.message.includes('clear-reject'));
    if (triageResult) {
      const match = triageResult.message.match(/(\d+) clear-fund, (\d+) clear-reject, (\d+) needs-deep-dive/);
      if (match) {
        // We don't have individual items from thinking, but we show the summary
        setTriageItems([]); // Will show summary text instead
      }
    }

    // Detect deep-dive phase
    const deepDiveThought = govThinking.find(e => e.message.includes('Deep-diving') || e.message.includes('Round 2'));
    if (deepDiveThought) setPhase('deep-dive');

    // Build conversations from question/answer pairs
    const convos: Conversation[] = questions.map(q => {
      const matchingAnswer = answers.find(a => a.correlationId === q.correlationId);
      return {
        question: q.message,
        answer: matchingAnswer?.message,
        from: q.agent ?? '',
        to: q.targetAgent ?? '',
        correlationId: q.correlationId ?? '',
      };
    });
    setConversations(convos);

    // Detect final decision
    const finalThought = govThinking.find(e => e.message.includes('Round 3') || e.message.includes('final'));
    if (finalThought) setPhase('deciding');

    if (decisions.length > 0) setPhase('complete');
  }, [entries, phase]);

  if (phase === 'idle') return null;

  const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    clear_fund: { bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-800/50' },
    clear_reject: { bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-800/50' },
    needs_deep_dive: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', border: 'border-yellow-800/50' },
  };

  const AGENT_CONFIG: Record<string, { label: string; color: string }> = {
    scout: { label: 'Scout', color: 'text-emerald-400' },
    analyzer: { label: 'Analyzer', color: 'text-violet-400' },
    governance: { label: 'Governance', color: 'text-amber-400' },
    treasury: { label: 'Treasury', color: 'text-cyan-400' },
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-white">
          Deliberation
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {(['triage', 'deep-dive', 'deciding'] as const).map((step, i) => {
            const isActive = phase === step;
            const isComplete = (['triage', 'deep-dive', 'deciding'] as const).indexOf(phase as any) > i || phase === 'complete';
            return (
              <div key={step} className="flex items-center gap-2">
                {i > 0 && <div className={`h-px w-6 ${isComplete ? 'bg-green-600' : 'bg-gray-700'}`} />}
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium border ${
                  isActive ? 'bg-blue-900/30 text-blue-400 border-blue-700 animate-pulse' :
                  isComplete ? 'bg-green-900/20 text-green-400 border-green-800/50' :
                  'bg-gray-800/50 text-gray-500 border-gray-700'
                }`}>
                  {isComplete && !isActive ? '✓' : `${i + 1}`}
                  {' '}{step === 'deep-dive' ? 'Deep Dive' : step.charAt(0).toUpperCase() + step.slice(1)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Triage results */}
        {(phase === 'triage' || phase === 'deep-dive' || phase === 'deciding' || phase === 'complete') && (
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Triage</h3>
            {triageItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {triageItems.map((item, i) => {
                  const colors = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.needs_deep_dive;
                  return (
                    <div key={i} className={`rounded px-2 py-1.5 text-xs ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {item.proposalTitle}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">
                {phase === 'triage' ? 'Categorizing proposals...' : 'Triage complete — proposals categorized'}
              </p>
            )}
          </div>
        )}

        {/* Deep-dive conversations */}
        {conversations.length > 0 && (phase === 'deep-dive' || phase === 'deciding' || phase === 'complete') && (
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Deep Dive</h3>
            <div className="space-y-2">
              {conversations.map((convo, i) => {
                const fromCfg = AGENT_CONFIG[convo.from] ?? { label: convo.from, color: 'text-gray-400' };
                const toCfg = AGENT_CONFIG[convo.to] ?? { label: convo.to, color: 'text-gray-400' };
                return (
                  <div key={i} className="space-y-1">
                    <div className="rounded-lg bg-orange-950/20 border border-orange-900/30 px-3 py-1.5">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className={`text-[10px] font-semibold ${fromCfg.color}`}>{fromCfg.label}</span>
                        <span className="text-[10px] text-gray-600">→</span>
                        <span className={`text-[10px] font-semibold ${toCfg.color}`}>{toCfg.label}</span>
                      </div>
                      <p className="text-xs text-orange-200">{convo.question}</p>
                    </div>
                    {convo.answer ? (
                      <div className="ml-4 rounded-lg bg-teal-950/20 border border-teal-900/30 px-3 py-1.5">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`text-[10px] font-semibold ${toCfg.color}`}>{toCfg.label}</span>
                          <span className="text-[10px] text-gray-600">→</span>
                          <span className={`text-[10px] font-semibold ${fromCfg.color}`}>{fromCfg.label}</span>
                        </div>
                        <p className="text-xs text-teal-200">{convo.answer}</p>
                      </div>
                    ) : (
                      <div className="ml-4 text-[10px] text-gray-500 italic animate-pulse">Investigating...</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Final decision indicator */}
        {phase === 'complete' && (
          <div className="flex items-center gap-2 rounded bg-green-900/20 border border-green-800/50 px-3 py-2">
            <span className="text-green-400 text-xs font-medium">Decision Complete</span>
          </div>
        )}
      </div>
    </div>
  );
}
