'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useConversation } from '@elevenlabs/react';
import type { VoiceResult } from '@/lib/types';
import { fetchSignedUrl, sendCommand } from '@/lib/api';
import { fetchActivity, type ActivityEntry } from '@/lib/activity';
import { createBrowserClientTools } from '@/lib/voice-client-tools';

type Tab = 'voice' | 'text';

interface Message {
  id: string;
  source: 'user' | 'agent';
  text: string;
}

/** Pipeline step shown during live execution */
interface PipelineStep {
  id: string;
  icon: string;
  label: string;
  detail?: string;
  timestamp: number;
}

/** Map activity entries to human-readable pipeline steps */
function activityToStep(entry: ActivityEntry): PipelineStep | null {
  // Scout-specific status events (Unbrowse + Claude)
  if (entry.type === 'status' && entry.agent === 'scout') {
    const msg = entry.message || '';
    if (msg.startsWith('Searching'))
      return { id: entry.id, icon: '🔍', label: 'Scout searching...', detail: msg, timestamp: entry.timestamp };
    if (msg.startsWith('Scraping'))
      return { id: entry.id, icon: '🌐', label: 'Unbrowse scraping web data', detail: msg, timestamp: entry.timestamp };
    if (msg.startsWith('Scraped'))
      return { id: entry.id, icon: '✅', label: 'Web data received', detail: msg, timestamp: entry.timestamp };
    if (msg.includes('structuring'))
      return { id: entry.id, icon: '🧠', label: 'Claude AI structuring proposals', detail: 'Converting raw web data into typed proposals', timestamp: entry.timestamp };
    if (msg.startsWith('Structured'))
      return { id: entry.id, icon: '✅', label: msg, timestamp: entry.timestamp };
    if (msg.includes('discovering'))
      return { id: entry.id, icon: '🤖', label: 'Claude AI discovering proposals', detail: 'Using ecosystem knowledge', timestamp: entry.timestamp };
    if (msg.startsWith('Discovered'))
      return { id: entry.id, icon: '✅', label: msg, timestamp: entry.timestamp };
    if (msg.includes('unavailable') || msg.includes('failed'))
      return { id: entry.id, icon: '⚠️', label: 'Unbrowse fallback', detail: msg, timestamp: entry.timestamp };
  }

  // Pipeline steps
  if (entry.type === 'step') {
    const step = entry.detail?.step as string;
    const status = entry.detail?.status as string;
    if (step === 'discover' && status === 'started')
      return { id: entry.id, icon: '🔍', label: 'Scout discovering proposals...', detail: 'Paying Scout 0.001 USDC via x402', timestamp: entry.timestamp };
    if (step === 'discover' && status === 'completed')
      return { id: entry.id, icon: '✅', label: 'Proposals discovered', detail: `${(entry.detail?.count as number) || ''} found`, timestamp: entry.timestamp };
    if (step === 'evaluate' && status === 'started')
      return { id: entry.id, icon: '🧠', label: 'Analyzer evaluating proposal...', detail: 'Paying Analyzer 0.002 USDC via x402', timestamp: entry.timestamp };
    if (step === 'evaluate' && status === 'completed')
      return { id: entry.id, icon: '✅', label: 'Evaluation complete', timestamp: entry.timestamp };
    if (step === 'decide' && status === 'started')
      return { id: entry.id, icon: '⚖️', label: 'Governance deciding...', detail: 'Claude AI reasoning about allocations', timestamp: entry.timestamp };
    if (step === 'decide' && status === 'completed')
      return { id: entry.id, icon: '✅', label: 'Decision made', timestamp: entry.timestamp };
    if (step === 'fund' && status === 'started')
      return { id: entry.id, icon: '💸', label: 'Treasury funding on-chain...', detail: 'SPL token transfer on Solana devnet', timestamp: entry.timestamp };
    if (step === 'fund' && status === 'completed')
      return { id: entry.id, icon: '✅', label: 'Funded on-chain', detail: entry.detail?.signature as string, timestamp: entry.timestamp };
  }

  // Decision events
  if (entry.type === 'decision') {
    return { id: entry.id, icon: '📋', label: 'Funding decision published', detail: entry.message, timestamp: entry.timestamp };
  }

  // Funded events
  if (entry.type === 'funded') {
    return { id: entry.id, icon: '🎉', label: 'Project funded on-chain', detail: entry.txSignature ? `tx: ${entry.txSignature.slice(0, 8)}...` : undefined, timestamp: entry.timestamp };
  }

  // Status events from agents
  if (entry.type === 'status') {
    const msg = entry.message || '';
    const agent = entry.agent || '';

    // x402 payment events
    if (msg.includes('x402')) {
      if (msg.includes('Paying'))
        return { id: entry.id, icon: '💳', label: msg, detail: 'Real USDC transfer on Solana devnet', timestamp: entry.timestamp };
      if (msg.includes('confirmed'))
        return { id: entry.id, icon: '✅', label: msg, timestamp: entry.timestamp };
    }

    // Scout events
    if (agent === 'scout') {
      if (msg.includes('Scraping'))
        return { id: entry.id, icon: '🌐', label: 'Unbrowse scraping web data', detail: msg, timestamp: entry.timestamp };
      if (msg.includes('Found') || msg.includes('from live'))
        return { id: entry.id, icon: '✅', label: msg, timestamp: entry.timestamp };
      if (msg.includes('Claude AI'))
        return { id: entry.id, icon: '🧠', label: msg, timestamp: entry.timestamp };
    }

    // Analyzer events
    if (agent === 'analyzer') {
      if (msg.includes('Evaluating'))
        return { id: entry.id, icon: '🧠', label: msg, timestamp: entry.timestamp };
      if (msg.includes('scored'))
        return { id: entry.id, icon: '📊', label: msg, timestamp: entry.timestamp };
    }

    // Governance events
    if (agent === 'governance') {
      if (msg.includes('deciding'))
        return { id: entry.id, icon: '⚖️', label: msg, timestamp: entry.timestamp };
    }

    // Treasury events
    if (msg.includes('funding') || msg.includes('Executing'))
      return { id: entry.id, icon: '💰', label: `Transferring funds on-chain`, detail: msg, timestamp: entry.timestamp };
    if (msg.includes('funded'))
      return { id: entry.id, icon: '✅', label: `Transfer complete`, detail: msg, timestamp: entry.timestamp };

    // Skip noisy init messages
    if (msg.includes('ready') || msg.includes('initialized')) return null;

    // Generic agent status
    if (agent)
      return { id: entry.id, icon: '⚙️', label: `${agent}: ${msg}`, timestamp: entry.timestamp };
  }

  return null;
}

export function VoiceWidget({
  onCommandSent,
}: {
  onCommandSent?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('text');
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activitySinceRef = useRef(0);

  const clientTools = useMemo(() => createBrowserClientTools(sendCommand), []);

  const conversation = useConversation({
    clientTools,
    onMessage: ({ message, source }: { message: string; source: string }) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), source: source as 'user' | 'agent', text: message },
      ]);
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Voice connection failed';
      setVoiceError(msg);
      setTab('text');
    },
    onUnhandledClientToolCall: ({ toolName }: { toolName: string }) => {
      console.warn('[VoiceWidget] Unhandled client tool:', toolName);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    stepsRef.current?.scrollTo({ top: stepsRef.current.scrollHeight });
  }, [pipelineSteps]);

  // Start polling activity when sending
  const startActivityPoll = useCallback(() => {
    activitySinceRef.current = Date.now();
    setPipelineSteps([]);

    pollRef.current = setInterval(async () => {
      const entries = await fetchActivity(activitySinceRef.current);
      if (entries.length > 0) {
        const maxTs = Math.max(...entries.map((e) => e.timestamp));
        activitySinceRef.current = maxTs;

        const newSteps = entries
          .map(activityToStep)
          .filter((s): s is PipelineStep => s !== null);

        if (newSteps.length > 0) {
          setPipelineSteps((prev) => [...prev, ...newSteps]);
        }
      }
    }, 500);
  }, []);

  const stopActivityPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startVoice = useCallback(async () => {
    try {
      setVoiceError(null);
      const { signedUrl } = await fetchSignedUrl();
      await conversation.startSession({ signedUrl });
    } catch {
      setVoiceError('Voice server unavailable -- use text mode');
      setTab('text');
    }
  }, [conversation]);

  const stopVoice = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // ignore end session errors
    }
  }, [conversation]);

  const handleTextSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = textInput.trim();
      if (!text || sending) return;

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), source: 'user', text },
      ]);
      setTextInput('');
      setSending(true);
      startActivityPoll();

      try {
        const result: VoiceResult = await sendCommand(text);
        stopActivityPoll();

        // Add a "complete" step
        setPipelineSteps((prev) => [
          ...prev,
          {
            id: 'done-' + Date.now(),
            icon: result.success ? '🎯' : '❌',
            label: result.success ? 'Pipeline complete' : 'Pipeline failed',
            timestamp: Date.now(),
          },
        ]);

        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), source: 'agent', text: result.message },
        ]);
        onCommandSent?.();
      } catch {
        stopActivityPoll();
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            source: 'agent',
            text: 'Voice server unavailable. Please try again later.',
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [textInput, sending, onCommandSent, startActivityPoll, stopActivityPoll],
  );

  const statusColor =
    conversation.status === 'connected'
      ? 'bg-green-500'
      : conversation.status === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-gray-500';

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          Voice Command Center
        </h2>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <span className="text-xs text-gray-400 capitalize">
            {conversation.status}
          </span>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="mb-4 flex gap-1 rounded-md bg-gray-950 p-1">
        <button
          onClick={() => setTab('voice')}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition ${
            tab === 'voice'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Voice
        </button>
        <button
          onClick={() => setTab('text')}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition ${
            tab === 'text'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Text
        </button>
      </div>

      {voiceError && (
        <div className="mb-4 rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
          {voiceError}
        </div>
      )}

      {/* Live Pipeline Steps - shown during command execution */}
      {(sending || pipelineSteps.length > 0) && (
        <div
          ref={stepsRef}
          className="mb-4 max-h-48 overflow-y-auto rounded-md border border-gray-700 bg-gray-950 p-3"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Pipeline Activity
            </span>
            {sending && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
            )}
          </div>
          {pipelineSteps.length === 0 && sending ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="animate-spin">⏳</span>
              Connecting to agents...
            </div>
          ) : (
            <div className="space-y-1">
              {pipelineSteps.map((step) => (
                <div key={step.id} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0">{step.icon}</span>
                  <span className="text-gray-300">{step.label}</span>
                  {step.detail && (
                    <span className="truncate text-gray-600 text-xs mt-0.5">
                      {step.detail}
                    </span>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="animate-spin">⏳</span>
                  Processing...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Message Log */}
      <div
        ref={scrollRef}
        className="mb-4 h-48 overflow-y-auto rounded-md bg-gray-950 p-3"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-600">
            {tab === 'voice'
              ? 'Click Start to begin voice conversation...'
              : 'Type a command like "find proposals" or "check treasury"...'}
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`text-sm ${
                  msg.source === 'user' ? 'text-cyan-400' : 'text-gray-300'
                }`}
              >
                <span className="font-medium">
                  {msg.source === 'user' ? 'You: ' : 'Agent: '}
                </span>
                {msg.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voice Controls */}
      {tab === 'voice' && (
        <div className="flex items-center gap-3">
          {conversation.status === 'disconnected' ? (
            <button
              onClick={startVoice}
              className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition"
            >
              Start Listening
            </button>
          ) : (
            <button
              onClick={stopVoice}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition"
            >
              Stop
            </button>
          )}
          {conversation.isSpeaking && (
            <span className="text-sm text-green-400 animate-pulse">
              Agent speaking...
            </span>
          )}
        </div>
      )}

      {/* Text Input */}
      {tab === 'text' && (
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a command..."
            disabled={sending}
            className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-600 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !textInput.trim()}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Running...' : 'Send'}
          </button>
        </form>
      )}
    </div>
  );
}
