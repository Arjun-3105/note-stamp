"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type ChecklistItem = { requirement: string; met: boolean; comment: string };
type Assessment = {
  score: number; passed: boolean;
  checklist: ChecklistItem[];
  strengths: string[]; gaps: string[];
  nextTopic: string; overallFeedback: string;
};

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

export default function AssessmentResult({ result }: { result: Assessment }) {
  const displayScore = useCountUp(result.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
      className="rounded-2xl border border-white/[0.07] bg-[#0f0f0f] overflow-hidden"
    >
      {/* Score banner */}
      <div className="flex items-center gap-6 border-b border-white/[0.06] px-6 py-6">
        <div className="relative">
          <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <motion.circle
              cx="40" cy="40" r="34" fill="none"
              stroke={result.passed ? "#22c55e" : "#ef4444"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - result.score / 100) }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-xl font-black"
              style={{ color: result.passed ? "#22c55e" : "#ef4444" }}
            >
              {displayScore}
            </span>
          </div>
        </div>
        <div className="flex-1">
          <p
            className="text-2xl font-black tracking-tight"
            style={{ color: result.passed ? "#22c55e" : "#ef4444" }}
          >
            {result.passed ? "Passed" : "Needs Work"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#666]">{result.overallFeedback}</p>
        </div>
      </div>

      {/* Checklist */}
      <div className="border-b border-white/[0.06] px-6 py-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#444]">Requirement Checklist</p>
        <div className="space-y-2">
          {result.checklist.map((item, idx) => (
            <motion.div
              key={item.requirement}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + idx * 0.08, ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
              className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
            >
              <span
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black"
                style={{
                  background: item.met ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                  color: item.met ? "#22c55e" : "#ef4444",
                }}
              >
                {item.met ? "✓" : "✗"}
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: item.met ? "#ccc" : "#888" }}>
                  {item.requirement}
                </p>
                <p className="mt-0.5 text-xs text-[#555]">{item.comment}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Strengths + Gaps */}
      <div className="grid gap-px sm:grid-cols-2">
        <div className="px-6 py-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#444]">Strengths</p>
          <ul className="space-y-2">
            {result.strengths.map((s, i) => (
              <motion.li
                key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                className="flex items-start gap-2 text-xs text-[#777]"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#22c55e]/50" />
                {s}
              </motion.li>
            ))}
          </ul>
        </div>
        <div className="border-t border-white/[0.06] px-6 py-5 sm:border-l sm:border-t-0">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#444]">Gaps</p>
          <ul className="space-y-2">
            {result.gaps.map((g, i) => (
              <motion.li
                key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                className="flex items-start gap-2 text-xs text-[#777]"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#ef4444]/50" />
                {g}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {result.nextTopic && (
        <div className="border-t border-white/[0.06] px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#444]">Suggested next topic</p>
          <p className="mt-1 text-sm font-semibold text-white">{result.nextTopic}</p>
        </div>
      )}
    </motion.div>
  );
}

