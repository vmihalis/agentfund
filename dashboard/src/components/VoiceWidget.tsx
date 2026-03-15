'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useConversation } from '@elevenlabs/react';
import type { VoiceResult } from '@/lib/types';
import { fetchSignedUrl, sendCommand } from '@/lib/api';
import { createBrowserClientTools } from '@/lib/voice-client-tools';

type Tab = 'voice' | 'text';

interface Message {
  id: string;
  source: 'user' | 'agent';
  text: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUnhandledClientToolCall: (params: any) => {
      console.warn('[VoiceWidget] Unhandled client tool:', params?.toolName ?? params);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

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

      try {
        const result: VoiceResult = await sendCommand(text);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), source: 'agent', text: result.message },
        ]);
        onCommandSent?.();
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            source: 'agent',
            text: 'Server unavailable. Please try again later.',
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [textInput, sending, onCommandSent],
  );

  const statusColor =
    conversation.status === 'connected'
      ? 'bg-green-500'
      : conversation.status === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-gray-500';

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900">
      {/* Header with tab toggle */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Command Center</h2>
          <span className={`h-2 w-2 rounded-full ${statusColor}`} />
        </div>
        <div className="flex gap-1 rounded-md bg-gray-950 p-0.5">
          <button
            onClick={() => setTab('voice')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              tab === 'voice'
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Voice
          </button>
          <button
            onClick={() => setTab('text')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              tab === 'text'
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Text
          </button>
        </div>
      </div>

      <div className="p-4">
        {voiceError && (
          <div className="mb-3 rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
            {voiceError}
          </div>
        )}

        {/* Message Log */}
        <div
          ref={scrollRef}
          className="mb-3 h-36 overflow-y-auto rounded-md bg-gray-950 p-3"
        >
          {messages.length === 0 ? (
            <p className="text-center text-xs text-gray-600 mt-12">
              {tab === 'voice'
                ? 'Click Start to begin voice conversation...'
                : 'Try "find proposals" or "check treasury"'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-xs ${
                    msg.source === 'user' ? 'text-cyan-400' : 'text-gray-300'
                  }`}
                >
                  <span className="font-medium">
                    {msg.source === 'user' ? 'You: ' : 'Agent: '}
                  </span>
                  {msg.text}
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                  Processing...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Voice Controls */}
        {tab === 'voice' && (
          <div className="flex items-center gap-3">
            {conversation.status === 'disconnected' ? (
              <button
                onClick={startVoice}
                className="rounded-md bg-cyan-600 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-500 transition"
              >
                Start Listening
              </button>
            ) : (
              <button
                onClick={stopVoice}
                className="rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500 transition"
              >
                Stop
              </button>
            )}
            {conversation.isSpeaking && (
              <span className="text-xs text-green-400 animate-pulse">
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
              className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-cyan-600 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !textInput.trim()}
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Running...' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
