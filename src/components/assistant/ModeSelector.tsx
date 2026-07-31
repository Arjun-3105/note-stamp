'use client';

import { useState } from 'react';
import { AssistantMode } from './AssistantPanel';

export interface ModeSelectorProps {
  mode: AssistantMode;
  onModeChange: (mode: AssistantMode) => void;
  disabled?: boolean;
}

const MODES: { value: AssistantMode; label: string; icon: string; color: string }[] = [
  { value: 'teacher',        label: 'Teacher',       icon: '👨‍🏫', color: '#6366f1' },
  { value: 'corrector',      label: 'Corrector',     icon: '✏️',  color: '#f59e0b' },
  { value: 'quiz_hint',      label: 'Quiz Hint',     icon: '💡',  color: '#10b981' },
  { value: 'roadmap_guide',  label: 'Roadmap Guide', icon: '🗺️', color: '#3b82f6' },
  { value: 'problem_solver', label: 'Problem Solver',icon: '⚡',  color: '#a855f7' },
];

export function ModeSelector({ mode, onModeChange, disabled = false }: ModeSelectorProps) {
  const current = MODES.find(m => m.value === mode);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-90"
        style={{
          background: `${current?.color ?? '#6366f1'}22`,
          color: current?.color ?? '#6366f1',
          border: `1px solid ${current?.color ?? '#6366f1'}44`,
        }}
      >
        <span>{current?.icon}</span>
        <span>{current?.label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden shadow-2xl z-50"
          style={{ background: '#18181f', border: '1px solid #2a2a38' }}
        >
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => { onModeChange(m.value); setOpen(false); }}
              disabled={disabled}
              className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[#1e1e28]"
              style={{ borderBottom: '1px solid #1e1e28' }}
            >
              <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                style={{ background: `${m.color}1a` }}>
                {m.icon}
              </span>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: mode === m.value ? m.color : '#e8e8ea' }}>
                  {m.label}
                </div>
              </div>
              {mode === m.value && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

