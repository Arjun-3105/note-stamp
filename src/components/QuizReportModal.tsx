"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── types ──────────────────────────────────────────────────────────────── */
export type QuizQuestionResult = {
  question: string;
  options: string[];
  yourAnswerIndex: number | undefined;
  correctAnswerIndex: number;
  isCorrect: boolean;
};

export type AiAnalysis = {
  overallFeedback: string;
  weaknesses: { concept: string; why: string; studyTip: string }[];
  strengths: string[];
  nextTopic: string;
};

export type QuizReportData = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  topic: string;
  questions: QuizQuestionResult[];
};

export type MintContext = {
  walletAddress: string;
  connecting: boolean;
  hasWalletExtension: boolean;
  connectWallet: () => void;
  minting: boolean;
  mintErr: string;
  mintSuccess: { txHash: string; explorerUrl: string } | null;
  doMint: () => void;
};

interface Props {
  open: boolean;
  onClose: () => void;
  data: QuizReportData;
  mintContext?: MintContext;
  onRetry?: () => void;
}

/* ─── count-up hook ──────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1400, enabled = true) {
  const startRef = useRef<number | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) {
      startRef.current = null;
      return;
    }
    startRef.current = Date.now();
    const start = startRef.current;
    const timer = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(target * eased));
      if (p >= 1) clearInterval(timer);
    }, 16);
    return () => {
      clearInterval(timer);
      setCount(0);
    };
  }, [target, duration, enabled]);
  return count;
}

/* ─── score donut ────────────────────────────────────────────────────────── */
function ScoreDonut({ score, passed, active }: { score: number; passed: boolean; active: boolean }) {
  const R = 72;
  const C = 2 * Math.PI * R;
  const displayScore = useCountUp(score, 1400, active);
  const color = passed ? "#ffffff" : "#ef4444";
  return (
    <div className="relative mx-auto" style={{ width: 180, height: 180 }}>
      <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90 absolute inset-0">
        <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <motion.circle
          cx="90" cy="90" r={R} fill="none" stroke={color}
          strokeWidth="10" strokeLinecap="round" strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={active ? { strokeDashoffset: C * (1 - score / 100) } : { strokeDashoffset: C }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
        <motion.circle
          cx="90" cy="90" r={R - 14} fill="none" stroke={color}
          strokeWidth="2" strokeLinecap="round"
          strokeDasharray={C * 0.78} strokeOpacity="0.12"
          initial={{ strokeDashoffset: C * 0.78 }}
          animate={active ? { strokeDashoffset: 0 } : { strokeDashoffset: C * 0.78 }}
          transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-5xl font-black tabular-nums"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={active ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {displayScore}
        </motion.span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#444]">/ 100</span>
      </div>
    </div>
  );
}

/* ─── mini answer bars ───────────────────────────────────────────────────── */
function AnswerBars({ questions, active }: { questions: QuizQuestionResult[]; active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {questions.map((q, i) => (
        <motion.div
          key={i} className="flex-1 rounded-sm"
          style={{ background: q.isCorrect ? "rgba(255,255,255,0.7)" : "rgba(239,68,68,0.4)" }}
          initial={{ scaleY: 0, originY: "bottom" }}
          animate={active ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 0.3, delay: 0.5 + i * 0.05, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/* ─── option label (A B C D) ─────────────────────────────────────────────── */
function OptionLabel({ index }: { index: number }) {
  return (
    <span className="font-mono text-[10px] font-bold opacity-40">
      {String.fromCharCode(65 + index)}.
    </span>
  );
}

/* ─── main modal ─────────────────────────────────────────────────────────── */
export function QuizReportModal({ open, onClose, data, mintContext, onRetry }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<"overview" | "questions" | "improve">("overview");
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  // Reset analysis state when quiz results change (user retried)
  useEffect(() => {
    hasFetchedRef.current = false;
    setAiAnalysis(null);
  }, [data.correct, data.total]);

  // Reset tab to "overview" when modal re-opens — derived state pattern (no effect needed)
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setTab("overview");
  }

  const [aiError, setAiError] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    if (hasFetchedRef.current || aiLoading) return;
    hasFetchedRef.current = true;
    setAiLoading(true);
    setAiError(false);
    try {
      const res = await fetch("/api/quiz/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: data.topic, questions: data.questions }),
      });
      if (!res.ok) throw new Error("API error");
      const result: AiAnalysis = await res.json();
      if (!result.overallFeedback) throw new Error("Empty response");
      setAiAnalysis(result);
    } catch {
      setAiError(true);
      hasFetchedRef.current = false; // allow retry
    } finally {
      setAiLoading(false);
    }
  }, [data.topic, data.questions, aiLoading]);

  // Kick off AI analysis as soon as the modal opens
  useEffect(() => {
    if (open && !hasFetchedRef.current) fetchAnalysis();
  }, [open, fetchAnalysis]);
  /* close on Escape */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  /* lock body scroll */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* derive gap/strength lists from wrong/right questions */
  const wrongQuestions = data.questions.filter((q) => !q.isCorrect);
  const rightQuestions = data.questions.filter((q) => q.isCorrect);

  /* truncate question text to a reasonable label */
  const truncate = (s: string, n = 72) => s.length > n ? s.slice(0, n) + "…" : s;

  /* recommended next topic */
  const nextTopic = wrongQuestions.length === 0
    ? `Advanced ${data.topic}`
    : `${data.topic} — review missed concepts`;

  const accuracyPct = Math.round((data.correct / Math.max(1, data.total)) * 100);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[9000] bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={ref}
            className="fixed inset-x-0 bottom-0 z-[9001] mx-auto flex max-h-[92vh] max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/[0.07] bg-[#080808] md:inset-0 md:m-auto md:max-h-[90vh] md:rounded-3xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── header ─────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <span
                  className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background: data.passed ? "rgba(255,255,255,0.07)" : "rgba(239,68,68,0.08)",
                    color:      data.passed ? "#fff" : "#ef4444",
                  }}
                >
                  {data.passed ? "Passed" : "Needs Work"}
                </span>
                <span className="text-xs text-[#444]">{data.topic}</span>
                <span className="text-[10px] text-[#333]">MCQ Quiz</span>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#444] transition hover:bg-white/[0.06] hover:text-[#aaa]"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                  <path d="M12 4 4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* ── tabs ───────────────────────────────────────────────────── */}
            <div className="flex shrink-0 gap-0 border-b border-white/[0.06]">
              {(["overview", "questions", "improve"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={[
                    "relative flex-1 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition",
                    tab === t ? "text-white" : "text-[#444] hover:text-[#777]",
                  ].join(" ")}
                >
                  {t}
                  {tab === t && (
                    <motion.span
                      layoutId="quiz-tab-line"
                      className="absolute inset-x-0 bottom-0 h-px bg-white"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* ── body ───────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">

                {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
                {tab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    <div className="mb-6 flex flex-col items-center gap-6 sm:flex-row">
                      <ScoreDonut score={data.score} passed={data.passed} active={open} />

                      <div className="flex flex-1 flex-col gap-5 w-full">
                        {/* accuracy bar */}
                        <div className="space-y-2">
                          <div className="flex items-end justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Accuracy</span>
                            <span className="font-mono text-sm font-bold text-white">{data.correct}/{data.total}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                            <motion.div
                              className="h-full rounded-full bg-white"
                              initial={{ width: 0 }}
                              animate={open ? { width: `${accuracyPct}%` } : { width: 0 }}
                              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-[#444]">
                            <span>{data.correct} correct</span>
                            <span>{data.total - data.correct} wrong</span>
                          </div>
                        </div>

                        {/* correct/wrong stat cards */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
                            <p className="text-2xl font-black text-white">{data.correct}</p>
                            <p className="mt-0.5 text-[10px] text-[#444]">Correct answers</p>
                          </div>
                          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
                            <p className="text-2xl font-black" style={{ color: data.total - data.correct > 0 ? "#ef4444" : "#22c55e" }}>
                              {data.total - data.correct}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#444]">Wrong answers</p>
                          </div>
                        </div>

                        <AnswerBars questions={data.questions} active={open} />
                      </div>
                    </div>

                    {/* overall verdict text — AI-powered when ready */}
                    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">AI Feedback</p>
                        {aiLoading && (
                          <span className="flex items-center gap-1 text-[9px] text-[#333] uppercase tracking-widest">
                            <span className="inline-block h-1 w-1 rounded-full bg-[#444] animate-pulse" />
                            analysing
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-[#aaa]">
                        {aiAnalysis?.overallFeedback ?? (
                          data.passed
                            ? `You scored ${data.score}/100 — answering ${data.correct} out of ${data.total} questions correctly. Strong understanding of ${data.topic}. You're ready to mint your Proof of Learning NFT.`
                            : `You scored ${data.score}/100 — ${data.correct} out of ${data.total} correct. ${wrongQuestions.length} concept${wrongQuestions.length !== 1 ? "s" : ""} need more attention before you're ready to pass. Review the "Improve" tab for specific areas to focus on.`
                        )}
                      </p>
                    </div>

                    {/* strengths / gaps grid */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">You knew</p>
                        {rightQuestions.length === 0 ? (
                          <p className="text-xs text-[#444]">No correct answers yet.</p>
                        ) : (
                          <ul className="space-y-2.5">
                            {rightQuestions.map((q, i) => (
                              <motion.li
                                key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.07 }}
                                className="flex items-start gap-2.5 text-xs text-[#777]"
                              >
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                                {truncate(q.question, 60)}
                              </motion.li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Needs review</p>
                        {wrongQuestions.length === 0 ? (
                          <p className="text-xs text-[#444]">All correct — perfect score!</p>
                        ) : (
                          <ul className="space-y-2.5">
                            {wrongQuestions.map((q, i) => (
                              <motion.li
                                key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.07 }}
                                className="flex items-start gap-2.5 text-xs text-[#777]"
                              >
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
                                {truncate(q.question, 60)}
                              </motion.li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* next topic */}
                    <motion.div
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-3"
                    >
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Study next</p>
                        <p className="mt-0.5 text-sm font-bold text-white">{nextTopic}</p>
                      </div>
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[#818181]">
                        <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                  </motion.div>
                )}

                {/* ── QUESTIONS TAB ─────────────────────────────────────── */}
                {tab === "questions" && (
                  <motion.div
                    key="questions"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    {/* summary bar */}
                    <div className="mb-5">
                      <div className="mb-1.5 flex justify-between text-[10px] text-[#444]">
                        <span>{data.correct} correct</span>
                        <span>{accuracyPct}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <motion.div
                          className="h-full rounded-full bg-white"
                          initial={{ width: 0 }}
                          animate={{ width: `${accuracyPct}%` }}
                          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {data.questions.map((q, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="rounded-xl border bg-white/[0.02] p-4"
                          style={{ borderColor: q.isCorrect ? "rgba(255,255,255,0.07)" : "rgba(239,68,68,0.15)" }}
                        >
                          {/* question header */}
                          <div className="mb-3 flex items-start gap-3">
                            <span
                              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black"
                              style={{
                                background: q.isCorrect ? "rgba(255,255,255,0.08)" : "rgba(239,68,68,0.1)",
                                color:      q.isCorrect ? "#fff" : "#ef4444",
                              }}
                            >
                              {q.isCorrect ? "✓" : "✗"}
                            </span>
                            <p className="flex-1 text-sm font-semibold leading-snug text-[#ccc]">
                              {q.question}
                            </p>
                            <span
                              className="shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{
                                background: q.isCorrect ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.08)",
                                color:      q.isCorrect ? "#666" : "#ef4444",
                              }}
                            >
                              {q.isCorrect ? "correct" : "wrong"}
                            </span>
                          </div>

                          {/* options */}
                          <div className="ml-8 space-y-1.5">
                            {q.options.map((opt, oi) => {
                              const isCorrect = oi === q.correctAnswerIndex;
                              const isYours   = oi === q.yourAnswerIndex;
                              const highlight = isCorrect
                                ? "border-white/20 bg-white/[0.05] text-white"
                                : isYours && !q.isCorrect
                                  ? "border-red-500/30 bg-red-500/[0.06] text-red-400"
                                  : "border-transparent text-[#444]";
                              return (
                                <div
                                  key={oi}
                                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${highlight}`}
                                >
                                  <OptionLabel index={oi} />
                                  <span className="flex-1">{opt}</span>
                                  {isCorrect && (
                                    <span className="text-[9px] font-bold uppercase tracking-wide text-white/40">correct</span>
                                  )}
                                  {isYours && !q.isCorrect && (
                                    <span className="text-[9px] font-bold uppercase tracking-wide text-red-400/60">your answer</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── IMPROVE TAB ───────────────────────────────────────── */}
                {tab === "improve" && (
                  <motion.div
                    key="improve"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                    className="p-6 space-y-5"
                  >
                    {/* AI loading skeleton */}
                    {aiLoading && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-400/60 animate-pulse" />
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">
                            AI is analysing your answers…
                          </p>
                        </div>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 animate-pulse space-y-2">
                            <div className="h-2.5 w-2/3 rounded-full bg-white/[0.06]" />
                            <div className="h-2 w-full rounded-full bg-white/[0.04]" />
                            <div className="h-2 w-4/5 rounded-full bg-white/[0.04]" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI error state with retry */}
                    {!aiLoading && aiError && (
                      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-5 py-4">
                        <p className="text-sm font-semibold text-amber-400/80 mb-1">Couldn't load AI analysis</p>
                        <p className="text-xs text-[#555] mb-3">The AI coach is unavailable right now. You can still review your answers in the Questions tab.</p>
                        <button
                          onClick={() => { hasFetchedRef.current = false; fetchAnalysis(); }}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[#888] transition hover:bg-white/[0.08] hover:text-white"
                        >
                          Retry Analysis
                        </button>
                      </div>
                    )}

                    {/* Perfect score state */}
                    {!aiLoading && !aiError && wrongQuestions.length === 0 && (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-center">
                        <p className="text-2xl mb-2">🎯</p>
                        <p className="text-sm font-semibold text-white mb-1">Perfect score!</p>
                        <p className="text-xs text-[#555]">No concepts to revisit — you got everything right.</p>
                      </div>
                    )}

                    {/* AI-powered weakness breakdown */}
                    {!aiLoading && !aiError && wrongQuestions.length > 0 && (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">
                            Concepts to revisit ({wrongQuestions.length})
                          </p>
                          {aiAnalysis && (
                            <span className="flex items-center gap-1 rounded-md border border-violet-500/20 bg-violet-500/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-400/70">
                              <span className="h-1 w-1 rounded-full bg-violet-400/60" />
                              AI
                            </span>
                          )}
                        </div>
                        <div className="space-y-3">
                          {wrongQuestions.map((q, i) => {
                            const aiWeak = aiAnalysis?.weaknesses?.[i];
                            return (
                              <motion.div
                                key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.07 }}
                                className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4"
                              >
                                {/* Concept tag */}
                                {aiWeak?.concept ? (
                                  <span className="mb-2 inline-block rounded-md border border-red-500/20 bg-red-500/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-400/70">
                                    {aiWeak.concept}
                                  </span>
                                ) : (
                                  <span className="mb-2 inline-block rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#555]">
                                    Q{i + 1}
                                  </span>
                                )}

                                <p className="text-sm font-semibold text-[#888] leading-snug">{q.question}</p>

                                {/* Correct / your answer */}
                                <div className="mt-3 space-y-1.5">
                                  <div className="flex items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                                    <span className="mt-0.5 text-[9px] font-bold uppercase text-white/30">✓ Correct</span>
                                    <span className="flex-1 text-xs text-white/70">
                                      {String.fromCharCode(65 + q.correctAnswerIndex)}. {q.options[q.correctAnswerIndex]}
                                    </span>
                                  </div>
                                  {q.yourAnswerIndex !== undefined && !q.isCorrect && (
                                    <div className="flex items-start gap-2 rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2">
                                      <span className="mt-0.5 text-[9px] font-bold uppercase text-red-400/50">✗ Yours</span>
                                      <span className="flex-1 text-xs text-red-400/60">
                                        {String.fromCharCode(65 + q.yourAnswerIndex)}. {q.options[q.yourAnswerIndex]}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* AI explanation + study tip */}
                                {aiWeak ? (
                                  <div className="mt-3 space-y-2 border-t border-white/[0.05] pt-3">
                                    <p className="text-xs text-[#666] leading-relaxed">
                                      <span className="font-semibold text-[#555]">Why this matters: </span>
                                      {aiWeak.why}
                                    </p>
                                    <div className="flex items-start gap-2 rounded-lg border border-violet-500/10 bg-violet-500/[0.04] px-3 py-2.5">
                                      <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400/60">
                                        <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                      </svg>
                                      <div>
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-violet-400/50 mb-1">Study Tip</p>
                                        <p className="text-[11px] text-violet-200/60 leading-relaxed">{aiWeak.studyTip}</p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  /* Static fallback when AI didn't return this entry */
                                  <p className="mt-2 text-xs text-[#444]">Review this concept and try the question again.</p>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* AI strengths */}
                    {!aiLoading && !aiError && (aiAnalysis?.strengths ?? rightQuestions.map((q) => q.question)).length > 0 && (
                      <div>
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">
                          What you nailed
                        </p>
                        <div className="space-y-2">
                          {(aiAnalysis?.strengths ?? rightQuestions.map((q) => truncate(q.question, 80))).map((s, i) => (
                            <motion.div
                              key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 + i * 0.06 }}
                              className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                            >
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                              <p className="text-xs text-[#666] leading-relaxed">{s}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next topic recommendation */}
                    {!aiLoading && !aiError && (
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Study next</p>
                        <p className="mt-1.5 text-base font-bold text-white">
                          {aiAnalysis?.nextTopic ?? nextTopic}
                        </p>
                        <p className="mt-1 text-xs text-[#555]">
                          {wrongQuestions.length > 0
                            ? `Master the ${wrongQuestions.length} missed concept${wrongQuestions.length !== 1 ? "s" : ""} above, then move forward.`
                            : "You've mastered this topic — move on to the next challenge."
                          }
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* ── footer CTA ──────────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-white/[0.06] px-6 py-4 space-y-3">

              {/* ── Mint success banner ── */}
              <AnimatePresence>
                {mintContext?.mintSuccess && (
                  <motion.a
                    href={mintContext.mintSuccess.explorerUrl}
                    target="_blank" rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 text-xs text-emerald-400 transition hover:bg-emerald-500/10"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/>
                    </svg>
                    <span className="flex-1 font-semibold">NFT minted! View on Etherscan →</span>
                    <span className="font-mono text-[10px] text-emerald-600/80">
                      {mintContext.mintSuccess.txHash.slice(0, 10)}…
                    </span>
                  </motion.a>
                )}
              </AnimatePresence>

              {/* ── error ── */}
              <AnimatePresence>
                {mintContext?.mintErr && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-400"
                  >
                    {mintContext.mintErr}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* ── wallet address pill (when connected, not yet minted) ── */}
              {mintContext && data.passed && !mintContext.mintSuccess && mintContext.walletAddress && (
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/50">{mintContext.walletAddress}</span>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/30">Sepolia</span>
                </div>
              )}

              {/* ── primary action row ── */}
              <div className="flex gap-3">
                {data.passed && mintContext && !mintContext.mintSuccess ? (
                  mintContext.walletAddress ? (
                    /* wallet connected → mint button */
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={mintContext.doMint}
                      disabled={mintContext.minting}
                      className="relative h-11 flex-1 overflow-hidden rounded-xl text-sm font-bold text-black transition disabled:opacity-50"
                      style={{ background: "white" }}
                    >
                      {mintContext.minting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="black" strokeOpacity="0.2" strokeWidth="3"/>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="black" strokeWidth="3" strokeLinecap="round"/>
                          </svg>
                          Minting on Sepolia…
                        </span>
                      ) : (
                        "Mint Proof of Learning NFT →"
                      )}
                    </motion.button>
                  ) : (
                    /* no wallet → connect button */
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={mintContext.connectWallet}
                      disabled={mintContext.connecting || !mintContext.hasWalletExtension}
                      className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-bold text-white transition hover:bg-white/[0.08] disabled:opacity-40"
                    >
                      {mintContext.connecting
                        ? "Connecting…"
                        : !mintContext.hasWalletExtension
                        ? "Install MetaMask to mint"
                        : "Connect Wallet to Mint →"}
                    </motion.button>
                  )
                ) : null}

                {/* close / retry */}
                {mintContext?.mintSuccess ? (
                  <button
                    onClick={onClose}
                    className="h-11 flex-1 rounded-xl bg-white text-sm font-bold text-black transition hover:bg-white/90"
                  >
                    Done ✓
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onClose}
                      className={[
                        "h-11 rounded-xl border border-white/[0.08] text-sm font-semibold text-[#666] transition hover:border-white/20 hover:text-white",
                        data.passed && mintContext ? "px-5" : "flex-1",
                      ].join(" ")}
                    >
                      {data.passed && mintContext ? "Close" : "Close Report"}
                    </button>
                    {!data.passed && onRetry && (
                      <motion.button
                        whileTap={{ scale: 0.97 }} onClick={() => { onClose(); onRetry(); }}
                        className="h-11 flex-1 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-bold text-white transition hover:bg-white/10"
                      >
                        Retry Quiz
                      </motion.button>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

