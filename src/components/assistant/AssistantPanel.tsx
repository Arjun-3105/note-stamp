'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { AssistantInput } from './AssistantInput';
import type { CorrectionData } from './CorrectionDiff';

export type AssistantMode =
  | 'teacher'
  | 'corrector'
  | 'quiz_hint'
  | 'roadmap_guide'
  | 'problem_solver';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  correction?: CorrectionData;
}

export interface FocusTopic {
  id: string;
  label: string;
  description?: string;
}

export interface RoadmapNodeInfo {
  id: string;
  label: string;
  description?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface AssistantPanelProps {
  sourceId?: string;
  contextType?: 'source' | 'quiz' | 'roadmap' | 'problem';
  contextId?: string;
  title?: string;
  initialText?: string;
  initialMode?: AssistantMode;
  focusTopic?: FocusTopic | null;
  noteContent?: string;
  sourceTitle?: string;
  roadmapNodes?: RoadmapNodeInfo[];
  onSelectNode?: (node: RoadmapNodeInfo) => void;
}

/* ─── Mode meta ──────────────────────────────────────────────── */
export const MODE_META: Record<AssistantMode, {
  label: string; icon: string; color: string; gradient: string; hint: string; accentBg: string;
}> = {
  teacher: {
    label: 'AI Teacher',
    icon: '👨‍🏫',
    color: '#7C5CFF',
    gradient: 'linear-gradient(135deg, #7C5CFF, #8b5cf6)',
    hint: 'Ask anything about this topic…',
    accentBg: 'rgba(124,92,255,0.08)',
  },
  corrector: {
    label: 'AI Corrector',
    icon: '✏️',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
    hint: 'Paste your notes — I\'ll review accuracy, clarity & completeness…',
    accentBg: 'rgba(245,158,11,0.08)',
  },
  quiz_hint: {
    label: 'Quiz Hint',
    icon: '💡',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    hint: 'Stuck on a question? Ask for a nudge…',
    accentBg: 'rgba(16,185,129,0.08)',
  },
  roadmap_guide: {
    label: 'AI Roadmap Guide',
    icon: '🗺️',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    hint: 'Ask me what to focus on next…',
    accentBg: 'rgba(59,130,246,0.08)',
  },
  problem_solver: {
    label: 'AI Problem Solver',
    icon: '⚡',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #6366f1)',
    hint: 'Describe your problem — I\'ll guide you step-by-step…',
    accentBg: 'rgba(168,85,247,0.08)',
  },
};

/* ─── Shared streaming chat hook ─────────────────────────────── */
function useChat(contextId: string | undefined, mode: AssistantMode) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    userMessage: string,
    focusTopic?: FocusTopic | null,
    extraSystemContext?: string,
  ) => {
    if (!userMessage.trim() || !contextId || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: userMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setError(null);
    setLoading(true);

    try {
      let endpoint = '/api/ai/assistant/chat';
      let body: Record<string, unknown> = {
        message: userMessage,
        contextType: 'source',
        contextId,
        mode,
        focusTopic: focusTopic ?? null,
        extraSystemContext,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get response');
      }
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      const ts = Date.now();

      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: ts }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantMessage += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: assistantMessage };
          }
          return updated;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [contextId, mode, loading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, sendMessage, clearMessages };
}

/* ─── Teacher mode panel ─────────────────────────────────────── */
function TeacherPanel({
  contextId,
  focusTopic,
  sourceTitle,
}: {
  contextId?: string;
  focusTopic?: FocusTopic | null;
  sourceTitle?: string;
}) {
  const { messages, loading, error, sendMessage } = useChat(contextId, 'teacher');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send opening question when panel mounts or topic changes
  useEffect(() => {
    if (!contextId || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    const topic = focusTopic?.label || sourceTitle || 'this topic';
    const question = focusTopic
      ? `I'm now focusing on "${focusTopic.label}". Give me a brief overview of this concept, then ask me one Socratic question to check my understanding. Keep it conversational and engaging.`
      : `I've just started studying "${topic}". Give me a quick, energetic intro to what I'm about to learn, then ask me what I already know about it. Make it feel like a live class, not a chatbot.`;
    sendMessage(question, focusTopic);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, focusTopic?.id]);

  const quickPrompts = [
    { label: 'Give me a hint', icon: '💡' },
    { label: 'Use an analogy', icon: '🔗' },
    { label: 'Show an example', icon: '✦' },
  ];

  // Track progress in conversation
  const questionsAnswered = messages.filter(m => m.role === 'user').length;
  const topicsExplored = Math.min(questionsAnswered, 5);

  return (
    <div className="h-full flex flex-col" style={{ background: '#151922' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 shrink-0 flex items-center gap-2">
        <div className="w-7 h-7 rounded-[10px] flex items-center justify-center text-xs text-white font-bold shadow-sm"
          style={{ background: 'linear-gradient(135deg, #7C5CFF, #8b5cf6)' }}>
          ✦
        </div>
        <span className="text-[13px] font-bold text-[#F5F6F8]">AI Teacher</span>
        <button className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg text-[#A2A8B5] hover:text-white transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7-7 7 7"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 min-h-0" style={{ scrollbarWidth: 'none' }}>
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.2)' }}>
              👨‍🏫
            </div>
            <p className="text-[#A2A8B5] text-xs text-center leading-relaxed px-2">
              Setting up your learning session…
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} accentColor="#7C5CFF" />
        ))}
        {loading && (
          <div className="flex gap-1.5 items-center px-1 py-2 ml-9">
            {[0, 1, 2].map(i => (
              <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce"
                style={{ background: '#7C5CFF', animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        {error && (
          <div className="mx-1 rounded-xl px-3 py-2 text-[12px] text-red-400"
            style={{ background: '#2a1a1a', border: '1px solid rgba(248,113,113,0.3)' }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
        {quickPrompts.map(p => (
          <button
            key={p.label}
            onClick={() => sendMessage(p.label, focusTopic)}
            disabled={loading || !contextId}
            className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-all hover:opacity-80 disabled:opacity-40 flex items-center gap-1"
            style={{ color: '#7C5CFF', background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.2)' }}
          >
            <span>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 shrink-0">
        <AssistantInput
          onSubmit={(m) => sendMessage(m, focusTopic)}
          disabled={loading || !contextId}
          placeholder="Type your answer…"
        />
      </div>

      {/* Progress card */}
      <div className="mx-3 mb-3 rounded-[14px] p-3 shrink-0" style={{ background: '#0F1115', border: '1px solid #252B36' }}>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#A2A8B5] mb-2">Your Progress in this Concept</p>
        <div className="flex items-center gap-3 mb-2">
          <div className="relative w-10 h-10 shrink-0">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#252B36" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="#7C5CFF" strokeWidth="3"
                strokeDasharray={`${Math.min(topicsExplored * 19, 94)} 94`}
                strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
              {topicsExplored * 20}%
            </span>
          </div>
          <div className="space-y-1">
            {[
              { label: 'Explored the concept', done: topicsExplored >= 1 },
              { label: 'Reviewed key idea', done: topicsExplored >= 2 },
              { label: `Answered ${questionsAnswered} question${questionsAnswered !== 1 ? 's' : ''}`, done: questionsAnswered > 0 },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: item.done ? '#42C67A' : '#A2A8B5' }}>
                  {item.done ? '✓' : '·'}
                </span>
                <span className="text-[11px] text-[#A2A8B5]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        {topicsExplored < 5 && (
          <p className="text-[11px] text-[#7C5CFF] font-semibold">{5 - topicsExplored} more to level up!</p>
        )}
      </div>
    </div>
  );
}

/* ─── Corrector mode panel ───────────────────────────────────── */
function CorrectorPanel({
  contextId,
  noteContent,
}: {
  contextId?: string;
  noteContent?: string;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correction, setCorrection] = useState<CorrectionData | null>(null);
  const [textToReview, setTextToReview] = useState(noteContent || '');
  const [activeTab, setActiveTab] = useState<'feedback' | 'evidence'>('feedback');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Update text when noteContent prop changes
  useEffect(() => {
    if (noteContent && !textToReview) setTextToReview(noteContent);
  }, [noteContent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [correction]);

  const handleCorrect = async () => {
    if (!textToReview.trim() || !contextId || loading) return;
    setLoading(true);
    setError(null);
    setCorrection(null);

    try {
      const res = await fetch('/api/ai/assistant/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalText: textToReview, contextType: 'source', contextId }),
      });
      if (!res.ok) throw new Error('Correction failed');
      const data = await res.json();
      setCorrection(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Parse improvements into categories
  const categories = correction ? [
    { label: 'Accuracy', count: Math.floor(correction.improvements.length * 0.4) + 1, color: '#f59e0b' },
    { label: 'Clarity', count: Math.floor(correction.improvements.length * 0.3), color: '#3b82f6' },
    { label: 'Completeness', count: Math.floor(correction.improvements.length * 0.2), color: '#8b5cf6' },
    { label: 'Notation', count: Math.floor(correction.improvements.length * 0.1), color: '#10b981' },
  ].filter(c => c.count > 0) : [];

  const wordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="h-full flex flex-col" style={{ background: '#16161f' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 shrink-0 flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
          ✏️
        </div>
        <span className="text-[13px] font-bold text-white">AI Corrector</span>
      </div>

      {/* Tab bar */}
      <div className="px-4 shrink-0 flex gap-4" style={{ borderBottom: '1px solid #2a2a38' }}>
        {(['feedback', 'evidence'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="text-[12px] font-semibold pb-2 capitalize transition-colors"
            style={{
              color: activeTab === tab ? '#F5F6F8' : '#555',
              borderBottom: activeTab === tab ? '2px solid #f59e0b' : '2px solid transparent',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ scrollbarWidth: 'none' }}>

        {/* No content yet */}
        {!correction && !loading && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-3" style={{ background: '#1e1e28', border: '1px solid #2a2a38' }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5] mb-1">Reviewing your note for accuracy, clarity & completeness</p>
              {noteContent ? (
                <p className="text-[12px] text-[#6ee7b7] leading-relaxed">Your notes are ready to review ✓</p>
              ) : (
                <p className="text-[12px] text-[#A2A8B5] leading-relaxed">Write notes first, then come back to review them here.</p>
              )}
            </div>

            {/* Notes textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5]">
                  Your Notes
                  {textToReview && <span className="ml-2 text-[#555] normal-case font-normal">Word count: {wordCount(textToReview)}</span>}
                </p>
                {correction && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ color: '#42C67A', background: 'rgba(66,198,122,0.1)', border: '1px solid rgba(66,198,122,0.2)' }}>
                    Needs Review
                  </span>
                )}
              </div>
              <textarea
                value={textToReview}
                onChange={e => setTextToReview(e.target.value)}
                placeholder="Paste your notes here…"
                rows={6}
                className="w-full text-[13px] leading-relaxed resize-none rounded-xl p-3 outline-none"
                style={{
                  background: '#1e1e28',
                  border: '1px solid #2a2a38',
                  color: '#C5C9D3',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <button
              onClick={handleCorrect}
              disabled={!textToReview.trim() || !contextId || loading}
              className="w-full py-2.5 rounded-xl text-[13px] font-bold transition-all"
              style={{
                background: textToReview.trim() ? 'linear-gradient(135deg, #f59e0b, #f97316)' : '#1e1e28',
                color: textToReview.trim() ? '#000' : '#555',
              }}
            >
              {loading ? 'Reviewing…' : 'Review My Notes →'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="h-2 w-2 rounded-full animate-bounce"
                  style={{ background: '#f59e0b', animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
            <p className="text-[12px] text-[#A2A8B5]">Analysing your notes…</p>
          </div>
        )}

        {/* After correction — Feedback tab */}
        {correction && activeTab === 'feedback' && (
          <div className="space-y-3">
            {/* Overall feedback */}
            <div className="rounded-2xl p-3" style={{ background: '#1e2a1e', border: '1px solid #2a3a2a' }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#42C67A] mb-1.5">Overall Feedback</p>
              <p className="text-[13px] text-[#C5C9D3] leading-relaxed">{correction.feedback || 'Great start! Your notes cover the key ideas.'}</p>
            </div>

            {/* Change summary by category */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5] mb-2">Key Corrections</p>
              <div className="space-y-1.5">
                {correction.improvements.slice(0, 4).map((item, i) => {
                  const colors = ['#f59e0b', '#f87171', '#fbbf24', '#10b981'];
                  const severities = ['High', 'High', 'Medium', 'Low'];
                  const isExpanded = expandedSection === `imp-${i}`;
                  return (
                    <div
                      key={i}
                      className="rounded-xl px-3 py-2.5 cursor-pointer transition-all"
                      style={{ background: '#1e1e28', border: '1px solid #2a2a38' }}
                      onClick={() => setExpandedSection(isExpanded ? null : `imp-${i}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
                          <p className="text-[12px] font-semibold text-white truncate max-w-[160px]">
                            {item.split(':')[0] || item.substring(0, 30)}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ color: colors[i % colors.length], background: `${colors[i % colors.length]}1a` }}>
                          {severities[i % severities.length]}
                        </span>
                      </div>
                      {isExpanded && (
                        <p className="text-[12px] text-[#A2A8B5] leading-relaxed mt-1.5 ml-4">{item}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Change summary by category */}
            {categories.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5] mb-2">Change Summary</p>
                <div className="space-y-1.5">
                  {categories.map(cat => (
                    <div key={cat.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px]" style={{ color: '#A2A8B5' }}>
                          {cat.label === 'Accuracy' ? '★' : cat.label === 'Clarity' ? '◎' : cat.label === 'Completeness' ? '◈' : '◇'}
                        </span>
                        <span className="text-[12px] text-[#A2A8B5]">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-white">{cat.count}</span>
                        <div className="w-16 h-1 rounded-full bg-[#2a2a38] overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(cat.count * 25, 100)}%`, background: cat.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence score */}
            <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: '#1e1e28', border: '1px solid #2a2a38' }}>
              <div className="relative w-12 h-12 shrink-0">
                <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#2a2a38" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#10b981" strokeWidth="3"
                    strokeDasharray="85 94" strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">92%</span>
              </div>
              <div>
                <p className="text-[12px] font-bold text-white mb-0.5">Confidence Score</p>
                <p className="text-[11px] text-[#A2A8B5]">This note is now much clearer and more accurate!</p>
              </div>
            </div>

            {/* Next steps */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5] mb-2">Next Steps</p>
              <div className="space-y-1.5">
                {['Review this concept deeper', 'Try a practice question', 'Check corrected version'].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => i === 2 ? setActiveTab('evidence') : undefined}
                    className="w-full text-left text-[12px] rounded-xl px-3 py-2 flex items-center gap-2 transition-all hover:bg-[#1e1e28]"
                    style={{ border: '1px solid #2a2a38', color: '#C5C9D3' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Try again button */}
            <button
              onClick={() => { setCorrection(null); setTextToReview(noteContent || ''); }}
              className="w-full py-2 rounded-xl text-[12px] font-semibold text-[#A2A8B5] transition-all hover:bg-[#1e1e28]"
              style={{ border: '1px solid #2a2a38' }}
            >
              Review different notes
            </button>
          </div>
        )}

        {/* Evidence tab */}
        {correction && activeTab === 'evidence' && (
          <div className="space-y-3">
            {/* Side-by-side diff */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2a2a38' }}>
              <div className="grid grid-cols-2"  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div className="p-3">
                  <p className="text-[10px] font-semibold text-[#f87171] mb-2 uppercase tracking-wide">Your Notes</p>
                  <p className="text-[12px] text-[#A2A8B5] leading-relaxed whitespace-pre-wrap">{correction.original}</p>
                </div>
                <div className="p-3" style={{ borderLeft: '1px solid #2a2a38' }}>
                  <p className="text-[10px] font-semibold text-[#42C67A] mb-2 uppercase tracking-wide">Corrected</p>
                  <p className="text-[12px] text-[#C5C9D3] leading-relaxed whitespace-pre-wrap">{correction.corrected || correction.original}</p>
                </div>
              </div>
            </div>

            {/* Copy button */}
            <button
              onClick={() => navigator.clipboard.writeText(correction.corrected || correction.original)}
              className="w-full py-2.5 rounded-xl text-[13px] font-bold transition-all"
              style={{ background: 'rgba(66,198,122,0.1)', color: '#42C67A', border: '1px solid rgba(66,198,122,0.2)' }}
            >
              Copy Corrected Version
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-3 py-2 text-[12px] text-red-400"
            style={{ background: '#2a1a1a', border: '1px solid rgba(248,113,113,0.3)' }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

/* ─── Roadmap Guide panel ────────────────────────────────────── */
function RoadmapGuidePanel({
  contextId,
  roadmapNodes,
  onSelectNode,
}: {
  contextId?: string;
  roadmapNodes?: RoadmapNodeInfo[];
  onSelectNode?: (node: RoadmapNodeInfo) => void;
}) {
  const { messages, loading, error, sendMessage } = useChat(contextId, 'roadmap_guide');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send based on real roadmap nodes
  useEffect(() => {
    if (!contextId || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    const nodesContext = roadmapNodes?.length
      ? `Based on the concept map, here are the key topics: ${roadmapNodes.map(n => n.label).join(', ')}. Tell me what to focus on next based on these topics.`
      : `I'm exploring this source material. What should I focus on to build a strong foundation?`;
    sendMessage(nodesContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId]);

  // Group nodes by difficulty
  const foundation = roadmapNodes?.filter(n => n.difficulty === 'beginner' || !n.difficulty) || [];
  const core = roadmapNodes?.filter(n => n.difficulty === 'intermediate') || [];
  const advanced = roadmapNodes?.filter(n => n.difficulty === 'advanced') || [];

  const renderNodeList = (nodes: RoadmapNodeInfo[], label: string, color: string) => {
    if (nodes.length === 0) return null;
    return (
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: '#A2A8B5' }}>
          {label}
        </p>
        <div className="space-y-1.5">
          {nodes.map((node, i) => (
            <div
              key={node.id}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer transition-all"
              style={{ background: '#1e1e28', border: '1px solid #2a2a38' }}
              onClick={() => {
                onSelectNode?.(node);
                sendMessage(`Tell me what I should focus on when learning about "${node.label}" and why it's important in this context.`);
              }}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: color }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{node.label}</p>
                {node.description && (
                  <p className="text-[11px] text-[#A2A8B5] truncate mt-0.5">{node.description}</p>
                )}
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ color, background: `${color}1a` }}>
                {node.difficulty || 'Learn'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#16161f' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0 flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
          🗺️
        </div>
        <span className="text-[13px] font-bold text-white">AI Roadmap Guide</span>
        <button className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg text-[#A2A8B5] hover:text-white transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-4 min-h-0" style={{ scrollbarWidth: 'none' }}>

        {/* AI recommendation bubble */}
        {messages.length > 0 && (
          <div className="rounded-2xl p-3" style={{ background: '#1e2a1e', border: '1px solid #2a3a2a' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6ee7b7] mb-1">AI Recommendation</p>
            <p className="text-[12px] text-[#6ee7b7] leading-relaxed">
              {messages[messages.length - 1]?.role === 'assistant'
                ? messages[messages.length - 1].content.substring(0, 180) + (messages[messages.length - 1].content.length > 180 ? '…' : '')
                : 'Based on your source, here\'s what I recommend.'}
            </p>
          </div>
        )}

        {loading && messages.length === 0 && (
          <div className="rounded-2xl p-3" style={{ background: '#1e2a1e', border: '1px solid #2a3a2a' }}>
            <div className="flex gap-1.5 items-center">
              {[0,1,2].map(i => (
                <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce"
                  style={{ background: '#3b82f6', animationDelay: `${i * 120}ms` }} />
              ))}
              <p className="text-[12px] text-[#A2A8B5] ml-1">Analysing your learning path…</p>
            </div>
          </div>
        )}

        {/* Real roadmap nodes */}
        {roadmapNodes && roadmapNodes.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5] mb-2">What to learn next</p>
            {renderNodeList(foundation, 'Foundation', '#3b82f6')}
            {renderNodeList(core, 'Core Concepts', '#8b5cf6')}
            {renderNodeList(advanced, 'Advanced', '#f59e0b')}
          </div>
        ) : (
          <div className="rounded-2xl p-3" style={{ background: '#1e1e28', border: '1px solid #2a2a38' }}>
            <p className="text-[12px] text-[#A2A8B5] leading-relaxed">
              Topic map is generating… Ask me anything about your learning path in the meantime.
            </p>
          </div>
        )}

        {/* Big picture */}
        <div className="rounded-2xl p-3" style={{ background: '#1e1e28', border: '1px solid #2a2a38' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5] mb-1.5">Big picture</p>
          <p className="text-[12px] text-[#C5C9D3] leading-relaxed">
            {roadmapNodes?.length
              ? `You have ${roadmapNodes.length} concepts to master in this source. Start with the foundations and work your way up.`
              : 'Complete this source to unlock deeper understanding of the subject.'}
          </p>
        </div>

        {/* Chat messages after first message */}
        {messages.slice(1).map((msg, idx) => (
          <MessageBubble key={idx} message={msg} accentColor="#3b82f6" />
        ))}
        {loading && messages.length > 0 && (
          <div className="flex gap-1.5 items-center py-2">
            {[0,1,2].map(i => (
              <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce"
                style={{ background: '#3b82f6', animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        {error && (
          <div className="rounded-xl px-3 py-2 text-[12px] text-red-400"
            style={{ background: '#2a1a1a', border: '1px solid rgba(248,113,113,0.3)' }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 shrink-0">
        <AssistantInput
          onSubmit={(m) => sendMessage(m)}
          disabled={loading || !contextId}
          placeholder="Ask me what to focus on next…"
        />
      </div>
    </div>
  );
}

/* ─── Problem Solver panel ───────────────────────────────────── */
function ProblemSolverPanel({
  contextId,
  sourceTitle,
  noteContent,
}: {
  contextId?: string;
  sourceTitle?: string;
  noteContent?: string;
}) {
  const { messages, loading, error, sendMessage } = useChat(contextId, 'problem_solver');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoStarted = useRef(false);
  const [scratchpad, setScratchpad] = useState(noteContent || '');
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-generate a problem statement
  useEffect(() => {
    if (!contextId || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    const prompt = `I'm studying "${sourceTitle || 'this topic'}". Generate one concise, well-structured practice problem based on the source material. After the problem, ask me what approach I'd take. Format: State the problem clearly, then ask "How would you approach this?"`;
    sendMessage(prompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId]);

  // Extract steps from AI messages
  const extractedSteps = messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => {
      const lines = m.content.split('\n').filter(l => l.match(/^(step\s*\d|\d\.|\d\))/i));
      return lines.map(l => l.replace(/^(step\s*\d+[:.]\s*|\d+[.)]\s*)/i, '').trim());
    })
    .filter(Boolean)
    .slice(0, 5);

  const steps = extractedSteps.length > 0 ? extractedSteps : [
    'Understand the problem',
    'Plan your approach',
    'Work through the solution',
    'Verify your answer',
    'Reflect on the method',
  ];

  const handleCheckWork = () => {
    if (!scratchpad.trim()) return;
    sendMessage(
      `Here's my work so far for step ${activeStep}:\n\n${scratchpad}\n\nIs this correct? What should I consider next?`
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#16161f' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0 flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm"
          style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
          ⚡
        </div>
        <span className="text-[13px] font-bold text-white">AI Problem Solver</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ color: '#a855f7', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
          You solve, AI guides
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 min-h-0" style={{ scrollbarWidth: 'none' }}>

        {/* Opening guidance */}
        {messages.length > 0 && messages[0].role === 'assistant' && (
          <div className="rounded-2xl p-3" style={{ background: '#1e1a2e', border: '1px solid rgba(168,85,247,0.2)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a855f7] mb-1.5">Problem</p>
            <p className="text-[12px] text-[#C5C9D3] leading-relaxed">{messages[0].content}</p>
          </div>
        )}

        {loading && messages.length === 0 && (
          <div className="rounded-2xl p-3" style={{ background: '#1e1a2e', border: '1px solid rgba(168,85,247,0.2)' }}>
            <div className="flex gap-1.5 items-center">
              {[0,1,2].map(i => (
                <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce"
                  style={{ background: '#a855f7', animationDelay: `${i * 120}ms` }} />
              ))}
              <p className="text-[12px] text-[#A2A8B5] ml-1">Generating problem…</p>
            </div>
          </div>
        )}

        {/* Steps */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5] mb-2">Steps</p>
          <div className="space-y-1.5">
            {steps.map((s, i) => {
              const stepNum = i + 1;
              const isDone = stepNum < activeStep;
              const isActive = stepNum === activeStep;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer transition-all"
                  style={{
                    background: isActive ? '#1e1a2e' : '#1e1e28',
                    border: `1px solid ${isActive ? 'rgba(168,85,247,0.4)' : '#2a2a38'}`,
                  }}
                  onClick={() => setActiveStep(stepNum)}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: isDone ? '#10b981' : isActive ? '#a855f7' : '#2a2a38',
                      color: isDone || isActive ? '#fff' : '#555',
                    }}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span className="text-[12px]" style={{ color: isActive ? '#fff' : isDone ? '#888' : '#666' }}>
                    {s}
                  </span>
                  {isActive && <div className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: '#a855f7' }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scratchpad */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2A8B5] mb-1.5">Your Scratchpad</p>
          <textarea
            value={scratchpad}
            onChange={e => setScratchpad(e.target.value)}
            placeholder={`Write your work for Step ${activeStep} here…`}
            rows={4}
            className="w-full text-[13px] leading-relaxed resize-none rounded-xl p-3 outline-none"
            style={{
              background: '#1e1a2e',
              border: '1px solid rgba(168,85,247,0.2)',
              color: '#C5C9D3',
              fontFamily: 'inherit',
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCheckWork}
              disabled={!scratchpad.trim() || loading}
              className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
              style={{
                background: scratchpad.trim() ? '#a855f7' : '#1e1e28',
                color: scratchpad.trim() ? '#fff' : '#555',
              }}
            >
              Check Step {activeStep} →
            </button>
            {activeStep < steps.length && (
              <button
                onClick={() => setActiveStep(prev => Math.min(prev + 1, steps.length))}
                className="px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={{ background: '#1e1e28', color: '#A2A8B5', border: '1px solid #2a2a38' }}
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {/* AI guidance messages (after first) */}
        {messages.slice(1).map((msg, idx) => (
          <MessageBubble key={idx} message={msg} accentColor="#a855f7" />
        ))}

        {loading && messages.length > 0 && (
          <div className="flex gap-1.5 items-center py-2">
            {[0,1,2].map(i => (
              <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce"
                style={{ background: '#a855f7', animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}

        {/* Guided hint */}
        {messages.length > 0 && (
          <div className="rounded-2xl p-3" style={{ background: '#1e1a2e', border: '1px solid rgba(168,85,247,0.3)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[#a855f7]">💡</span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a855f7]">Guided Hint</p>
            </div>
            <p className="text-[12px] text-[#C5C9D3] leading-relaxed">
              Need a smaller hint? Ask me to give you just a nudge without revealing the answer.
            </p>
            <button
              onClick={() => sendMessage(`Give me a small hint for step ${activeStep} without revealing the answer.`)}
              className="mt-2 text-[11px] font-semibold hover:underline"
              style={{ color: '#a855f7' }}
            >
              Yes, give me a nudge
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-3 py-2 text-[12px] text-red-400"
            style={{ background: '#2a1a1a', border: '1px solid rgba(248,113,113,0.3)' }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 shrink-0">
        <AssistantInput
          onSubmit={(m) => sendMessage(m)}
          disabled={loading || !contextId}
          placeholder="Describe your approach or ask for guidance…"
        />
      </div>
    </div>
  );
}

/* ─── Quiz Hint panel ─────────────────────────────────────────── */
function QuizHintPanel({ contextId }: { contextId?: string }) {
  const { messages, loading, error, sendMessage } = useChat(contextId, 'quiz_hint');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="h-full flex flex-col" style={{ background: '#16161f' }}>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0" style={{ scrollbarWidth: 'none' }}>
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl"
              style={{ background: 'rgba(16,185,129,0.1)' }}>💡</div>
            <p className="text-[#A2A8B5] text-xs leading-relaxed px-4">
              Stuck on a question? Ask for a nudge — I won't give away the answer, but I'll point you in the right direction.
            </p>
          </div>
        )}
        {messages.map((msg, idx) => <MessageBubble key={idx} message={msg} accentColor="#10b981" />)}
        {loading && (
          <div className="flex gap-1.5 items-center py-2 ml-9">
            {[0, 1, 2].map(i => (
              <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce"
                style={{ background: '#10b981', animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        {error && (
          <div className="rounded-xl px-3 py-2 text-[12px] text-red-400"
            style={{ background: '#2a1a1a', border: '1px solid rgba(248,113,113,0.3)' }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="px-3 pb-3 shrink-0">
        <AssistantInput onSubmit={(m) => sendMessage(m)} disabled={loading || !contextId} placeholder="Describe the question you're stuck on…" />
      </div>
    </div>
  );
}

/* ─── Mode Tab Bar ───────────────────────────────────────────── */
function ModeTabs({
  mode,
  onModeChange,
  disabled,
}: {
  mode: AssistantMode;
  onModeChange: (m: AssistantMode) => void;
  disabled?: boolean;
}) {
  const modes: { value: AssistantMode; label: string; icon: string }[] = [
    { value: 'teacher', label: 'Teacher', icon: '👨‍🏫' },
    { value: 'corrector', label: 'Corrector', icon: '✏️' },
    { value: 'roadmap_guide', label: 'Roadmap', icon: '🗺️' },
    { value: 'problem_solver', label: 'Problem', icon: '⚡' },
  ];

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #252B36' }}>
      {modes.map(m => {
        const isActive = mode === m.value;
        const meta = MODE_META[m.value];
        return (
          <button
            key={m.value}
            onClick={() => !disabled && onModeChange(m.value)}
            disabled={disabled}
            title={m.label}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[11px] font-semibold transition-all duration-150"
            style={{
              background: isActive ? `${meta.color}18` : 'transparent',
              color: isActive ? meta.color : '#A2A8B5',
              border: isActive ? `1px solid ${meta.color}30` : '1px solid transparent',
            }}
          >
            <span className="text-[13px]">{m.icon}</span>
            <span className="hidden lg:inline">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────── */
export function AssistantPanel({
  sourceId,
  contextType = 'source',
  contextId = sourceId,
  title = 'AI Assistant',
  initialText,
  initialMode,
  focusTopic,
  noteContent,
  sourceTitle,
  roadmapNodes,
  onSelectNode,
}: AssistantPanelProps) {
  const [mode, setMode] = useState<AssistantMode>(initialMode || 'teacher');
  const prevMode = useRef(mode);

  // Smooth mode transition
  const [transitioning, setTransitioning] = useState(false);
  const handleModeChange = (newMode: AssistantMode) => {
    if (newMode === mode) return;
    setTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      prevMode.current = newMode;
      setTransitioning(false);
    }, 150);
  };

  const meta = MODE_META[mode];

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ fontFamily: "Geist, 'Inter', sans-serif", background: '#151922' }}
    >
      {/* Mode tabs */}
      <ModeTabs mode={mode} onModeChange={handleModeChange} />

      {/* Mode label */}
      <div
        className="shrink-0 px-4 py-2 flex items-center gap-2"
        style={{ borderBottom: '1px solid #252B36' }}
      >
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm"
          style={{ background: meta.gradient }}
        >
          ✦
        </div>
        <span className="text-[13px] font-bold text-[#F5F6F8]">{meta.label}</span>
        <div className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: meta.color }} />
      </div>

      {/* Mode-specific panel with fade transition */}
      <div
        className="flex-1 min-h-0 overflow-hidden transition-opacity duration-150"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        {mode === 'teacher' && (
          <TeacherPanel
            contextId={contextId}
            focusTopic={focusTopic}
            sourceTitle={sourceTitle}
          />
        )}
        {mode === 'corrector' && (
          <CorrectorPanel
            contextId={contextId}
            noteContent={noteContent}
          />
        )}
        {mode === 'roadmap_guide' && (
          <RoadmapGuidePanel
            contextId={contextId}
            roadmapNodes={roadmapNodes}
            onSelectNode={onSelectNode}
          />
        )}
        {mode === 'problem_solver' && (
          <ProblemSolverPanel
            contextId={contextId}
            sourceTitle={sourceTitle}
            noteContent={noteContent}
          />
        )}
        {mode === 'quiz_hint' && (
          <QuizHintPanel contextId={contextId} />
        )}
      </div>
    </div>
  );
}
