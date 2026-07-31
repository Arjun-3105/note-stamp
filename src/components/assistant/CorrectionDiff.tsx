'use client';

export interface CorrectionData {
  original: string;
  corrected: string;
  feedback: string;
  improvements: string[];
}

interface CorrectionDiffProps {
  correction: CorrectionData;
}

export function CorrectionDiff({ correction }: CorrectionDiffProps) {
  const isCorrect = correction.original.trim() === correction.corrected.trim();

  return (
    <div className="mt-3 rounded-xl border border-slate-700 overflow-hidden text-sm">
      {/* Header */}
      <div
        className={`px-4 py-2 font-semibold text-xs uppercase tracking-wider ${
          isCorrect
            ? 'bg-emerald-900/50 text-emerald-300'
            : 'bg-amber-900/40 text-amber-300'
        }`}
      >
        {isCorrect ? '✅ Looks correct!' : '✏️ Corrections suggested'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-700">
        {/* Original */}
        <div className="p-4 bg-red-950/20">
          <p className="text-xs text-red-400 font-medium mb-2">Original</p>
          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{correction.original}</p>
        </div>

        {/* Corrected */}
        <div className="p-4 bg-emerald-950/20">
          <p className="text-xs text-emerald-400 font-medium mb-2">Corrected</p>
          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
            {correction.corrected || correction.original}
          </p>
        </div>
      </div>

      {/* Feedback */}
      {correction.feedback && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-400 font-medium mb-1">Feedback</p>
          <p className="text-slate-300 text-sm leading-relaxed">{correction.feedback}</p>
        </div>
      )}

      {/* Improvements list */}
      {correction.improvements && correction.improvements.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
          <p className="text-xs text-slate-400 font-medium mb-2">Improvements made</p>
          <ul className="space-y-1">
            {correction.improvements.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
