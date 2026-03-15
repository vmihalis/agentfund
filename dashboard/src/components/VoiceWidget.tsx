'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { VoiceResult } from '@/lib/types';
import { sendCommand, clearChatHistory } from '@/lib/api';

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
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

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

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-white">Command Center</h2>
        {messages.length > 0 && (
          <button
            onClick={async () => {
              setMessages([]);
              await clearChatHistory();
            }}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
          >
            New Chat
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Message Log */}
        <div
          ref={scrollRef}
          className="mb-3 h-36 overflow-y-auto rounded-md bg-gray-950 p-3"
        >
          {messages.length === 0 ? (
            <p className="text-center text-xs text-gray-600 mt-12">
              Try &quot;find proposals&quot; or &quot;check treasury&quot;
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

        {/* Text Input */}
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
      </div>
    </div>
  );
}
