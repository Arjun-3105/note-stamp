"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

/* ─── types ──────────────────────────────────────────────────────────── */
type ChecklistItem = { requirement: string; met: boolean; comment: string };
type Assessment = {
  score: number; passed: boolean;
  checklist: ChecklistItem[];
  strengths: string[]; gaps: string[];
  nextTopic: string; overallFeedback: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  result: Assessment;
  topic?: string;
  onMint?: () => void;
}

/* ─── count-up hook ─────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1400, enabled = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    setCount(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(target * eased));
      if (p >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, enabled]);
  return count;
}

/* ─── animated donut ─────────────────────────────────────────────────── */
function ScoreDonut({ score, passed, active }: { score: number; passed: boolean; active: boolean }) {
  const R = 72;
  const C = 2 * Math.PI * R;
  const displayScore = useCountUp(score, 1400, active);
  const color = passed ? "#ffffff" : "#ef4444";

  return (
    <div className="relative mx-auto" style={{ width: 180, height: 180 }}>
      <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90 absolute inset-0">
        {/* track */}
        <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        {/* progress */}
        <motion.circle
          cx="90" cy="90" r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={active ? { strokeDashoffset: C * (1 - score / 100) } : { strokeDashoffset: C }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
        {/* subtle second ring */}
        <motion.circle
          cx="90" cy="90" r={R - 14}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={C * 0.78}
          strokeOpacity="0.12"
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

/* ─── checkpoint bar chart ───────────────────────────────────────────── */
function CheckpointBar({ passed, total, active }: { passed: number; total: number; active: boolean }) {
  const pct = total === 0 ? 0 : Math.round((passed / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Checkpoints</span>
        <span className="font-mono text-sm font-bold text-white">{passed}/{total}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className="h-full rounded-full bg-white"
          initial={{ width: 0 }}
          animate={active ? { width: `${pct}%` } : { width: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[#444]">
        <span>{passed} passed</span>
        <span>{total - passed} failed</span>
      </div>
    </div>
  );
}

/* ─── mini sparkline bars ────────────────────────────────────────────── */
function ChecklistMiniChart({ items, active }: { items: ChecklistItem[]; active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {items.map((item, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-sm"
          style={{ background: item.met ? "rgba(255,255,255,0.7)" : "rgba(239,68,68,0.4)" }}
          initial={{ scaleY: 0, originY: "bottom" }}
          animate={active ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 0.3, delay: 0.5 + i * 0.05, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/* ─── main modal ─────────────────────────────────────────────────────── */
export function ReportModal({ open, onClose, result, topic, onMint }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });

  const passedCount = result.checklist.filter((c) => c.met).length;
  const totalCount  = result.checklist.length;

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

  const [tab, setTab] = useState<"overview" | "checklist" | "feedback">("overview");

  useEffect(() => {
    if (open) setTab("overview");
  }, [open]);

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
            {/* ── header ─────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <span
                  className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background: result.passed ? "rgba(255,255,255,0.07)" : "rgba(239,68,68,0.08)",
                    color:      result.passed ? "#fff" : "#ef4444",
                  }}
                >
                  {result.passed ? "Passed" : "Needs Work"}
                </span>
                {topic && (
                  <span className="text-xs text-[#444]">{topic}</span>
                )}
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

            {/* ── tabs ───────────────────────────────────────────────── */}
            <div className="flex shrink-0 gap-0 border-b border-white/[0.06]">
              {(["overview", "checklist", "feedback"] as const).map((t) => (
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
                      layoutId="tab-line"
                      className="absolute inset-x-0 bottom-0 h-px bg-white"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* ── body ───────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">

                {/* ── OVERVIEW TAB ─────────────────────────────────── */}
                {tab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    {/* Score + meta row */}
                    <div className="mb-6 flex flex-col items-center gap-6 sm:flex-row">
                      <ScoreDonut score={result.score} passed={result.passed} active={open} />

                      <div className="flex flex-1 flex-col gap-5 w-full">
                        <CheckpointBar passed={passedCount} total={totalCount} active={open} />

                        {/* pass/fail pill row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
                            <p className="text-2xl font-black text-white">{passedCount}</p>
                            <p className="mt-0.5 text-[10px] text-[#444]">Checkpoints passed</p>
                          </div>
                          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
                            <p className="text-2xl font-black" style={{ color: totalCount - passedCount > 0 ? "#ef4444" : "#22c55e" }}>
                              {totalCount - passedCount}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#444]">Checkpoints failed</p>
                          </div>
                        </div>

                        {/* mini sparkline */}
                        <ChecklistMiniChart items={result.checklist} active={open} />
                      </div>
                    </div>

                    {/* Overall feedback */}
                    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Overall Feedback</p>
                      <p className="text-sm leading-relaxed text-[#aaa]">{result.overallFeedback}</p>
                    </div>

                    {/* Strengths + gaps */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">
                          Strengths
                        </p>
                        <ul className="space-y-2.5">
                          {result.strengths.map((s, i) => (
                            <motion.li
                              key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + i * 0.07 }}
                              className="flex items-start gap-2.5 text-xs text-[#777]"
                            >
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                              {s}
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">
                          Gaps to fix
                        </p>
                        <ul className="space-y-2.5">
                          {result.gaps.map((g, i) => (
                            <motion.li
                              key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + i * 0.07 }}
                              className="flex items-start gap-2.5 text-xs text-[#777]"
                            >
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
                              {g}
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Next topic */}
                    {result.nextTopic && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-3"
                      >
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Study next</p>
                          <p className="mt-0.5 text-sm font-bold text-white">{result.nextTopic}</p>
                        </div>
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[#818181]">
                          <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ── CHECKLIST TAB ─────────────────────────────────── */}
                {tab === "checklist" && (
                  <motion.div
                    key="checklist"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    {/* summary bar */}
                    <div className="mb-5 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="mb-1.5 flex justify-between text-[10px] text-[#444]">
                          <span>{passedCount} passed</span>
                          <span>{Math.round((passedCount / totalCount) * 100)}%</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                          <motion.div
                            className="h-full rounded-full bg-white"
                            initial={{ width: 0 }}
                            animate={{ width: `${(passedCount / totalCount) * 100}%` }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {result.checklist.map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.06, ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
                          className="rounded-xl border bg-white/[0.02] px-4 py-3"
                          style={{ borderColor: item.met ? "rgba(255,255,255,0.07)" : "rgba(239,68,68,0.15)" }}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black"
                              style={{
                                background: item.met ? "rgba(255,255,255,0.08)" : "rgba(239,68,68,0.1)",
                                color:      item.met ? "#fff" : "#ef4444",
                              }}
                            >
                              {item.met ? "✓" : "✗"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-snug" style={{ color: item.met ? "#ddd" : "#888" }}>
                                {item.requirement}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-[#555]">{item.comment}</p>
                            </div>
                            <span
                              className="shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{
                                background: item.met ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.08)",
                                color:      item.met ? "#666" : "#ef4444",
                              }}
                            >
                              {item.met ? "pass" : "fail"}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── FEEDBACK TAB ─────────────────────────────────── */}
                {tab === "feedback" && (
                  <motion.div
                    key="feedback"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                    className="p-6 space-y-5"
                  >
                    {/* AI summary card */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">AI Assessment Summary</span>
                      </div>
                      <p className="text-sm leading-[1.85] text-[#999]">{result.overallFeedback}</p>
                    </div>

                    {/* Strengths detailed */}
                    <div>
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">What you did well</p>
                      <div className="space-y-2">
                        {result.strengths.map((s, i) => (
                          <motion.div
                            key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                          >
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                            <p className="text-sm text-[#888]">{s}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Gaps detailed */}
                    <div>
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Areas to improve</p>
                      <div className="space-y-2">
                        {result.gaps.map((g, i) => (
                          <motion.div
                            key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="flex items-start gap-3 rounded-xl border border-red-500/10 bg-red-500/[0.03] px-4 py-3"
                          >
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
                            <p className="text-sm text-[#888]">{g}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Next topic */}
                    {result.nextTopic && (
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444]">Recommended next topic</p>
                        <p className="mt-1.5 text-base font-bold text-white">{result.nextTopic}</p>
                        <p className="mt-1 text-xs text-[#555]">Based on your current gaps and skill level.</p>
                      </div>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* ── footer CTA ─────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-white/[0.06] px-6 py-4">
              {result.passed && onMint ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onMint}
                  className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition hover:bg-white/90"
                >
                  Mint Proof of Learning NFT →
                </motion.button>
              ) : (
                <button
                  onClick={onClose}
                  className="h-11 w-full rounded-xl border border-white/[0.08] text-sm font-semibold text-[#666] transition hover:border-white/20 hover:text-white"
                >
                  Close Report
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

