'use client';

/**
 * useAssistant — client-side state manager for the AI assistant.
 * Manages messages, streaming state, mode switching, and session ID.
 * Wraps fetch calls to /api/ai/assistant/* so components stay thin.
 */
import { useState, useCallback, useRef } from 'react';
import type { CorrectionData } from '@/components/assistant/CorrectionDiff';

export type AssistantMode =
  | 'teacher'
  | 'corrector'
  | 'quiz_hint'
  | 'roadmap_guide'
  | 'problem_solver';

export type ContextType = 'source' | 'quiz' | 'roadmap' | 'problem';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  correction?: CorrectionData;
}

export interface UseAssistantOptions {
  contextType: ContextType;
  contextId: string;
  initialMode?: AssistantMode;
}

export interface UseAssistantReturn {
  messages: ChatMessage[];
  mode: AssistantMode;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  lastResponse: string | null;
  setMode: (mode: AssistantMode) => void;
  sendMessage: (userMessage: string) => Promise<void>;
  clearMessages: () => void;
}

export function useAssistant({
  contextType,
  contextId,
  initialMode = 'teacher',
}: UseAssistantOptions): UseAssistantReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<AssistantMode>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || !contextId || isLoading) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);
      setError(null);
      setIsLoading(true);

      try {
        // ── Corrector mode — structured non-streaming endpoint ──────────────
        if (mode === 'corrector') {
          const res = await fetch('/api/ai/assistant/correct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalText: userMessage, contextType, contextId }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Correction failed');
          }

          const correction: CorrectionData & { sessionId?: string } = await res.json();
          if (correction.sessionId) setSessionId(correction.sessionId);

          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: correction.feedback || 'Here are the corrections.',
            timestamp: Date.now(),
            correction,
          };
          setMessages(prev => [...prev, assistantMsg]);
          setLastResponse(correction.feedback);
          return;
        }

        // ── All other modes — streaming /chat endpoint ───────────────────────
        const response = await fetch('/api/ai/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage, contextType, contextId, mode }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to get response');
        }

        if (!response.body) throw new Error('No response body');

        // Stream tokens
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';
        const messageTimestamp = Date.now();

        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '', timestamp: messageTimestamp },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: assistantContent };
            }
            return updated;
          });
        }

        setLastResponse(assistantContent);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // user navigated away
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Remove the empty placeholder if stream failed
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
          return prev;
        });
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [contextId, contextType, isLoading, mode]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastResponse(null);
    setError(null);
  }, []);

  return {
    messages,
    mode,
    isLoading,
    error,
    sessionId,
    lastResponse,
    setMode,
    sendMessage,
    clearMessages,
  };
}
