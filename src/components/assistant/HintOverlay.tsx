'use client';

import { useState } from 'react';

interface HintData {
  nudge: string;
  relatedConcept?: string;
}

interface HintOverlayProps {
  hint: HintData;
  onClose: () => void;
}

export function HintOverlay({ hint, onClose }: HintOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl border border-indigo-500/30 bg-slate-900 p-6 shadow-2xl shadow-indigo-900/40"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-xl">
            💡
          </div>
          <h3 className="text-lg font-semibold text-white">Hint</h3>
        </div>

        {/* Nudge */}
        <p className="text-slate-300 leading-relaxed mb-4">{hint.nudge}</p>

        {/* Related concept */}
        {hint.relatedConcept && (
          <div className="rounded-lg bg-indigo-900/30 border border-indigo-700/40 px-4 py-3 mb-4">
            <p className="text-xs text-indigo-400 font-medium mb-0.5">Review this concept</p>
            <p className="text-indigo-200 text-sm">{hint.relatedConcept}</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Got it, back to quiz
        </button>
      </div>
    </div>
  );
}

// ─── QuizHintButton ───────────────────────────────────────────────────────────

interface QuizHintButtonProps {
  quizAttemptId: string;
  questionId: string;
}

export function QuizHintButton({ quizAttemptId, questionId }: QuizHintButtonProps) {
  const [hint, setHint] = useState<HintData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestHint = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/assistant/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'I need a hint for this question.',
          contextType: 'quiz',
          contextId: quizAttemptId,
          questionId,
        }),
      });

      if (!res.ok) throw new Error('Failed to get hint');
      const data = await res.json();

      setHint({ nudge: data.hint, relatedConcept: data.relatedConcept });
      setOpen(true);
    } catch {
      setError('Could not get a hint right now. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={requestHint}
        disabled={loading}
        className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors disabled:opacity-50"
      >
        {loading ? 'Getting hint…' : '💡 Need a hint?'}
      </button>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {open && hint && (
        <HintOverlay hint={hint} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
