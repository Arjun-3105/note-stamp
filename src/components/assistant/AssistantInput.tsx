'use client';

import { useState, useRef, useEffect } from 'react';

export interface AssistantInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
}

export function AssistantInput({
  onSubmit,
  disabled = false,
  placeholder = 'Type a message…',
  multiline = false,
}: AssistantInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="flex items-end gap-2 w-full rounded-[16px] px-3.5 py-2.5 shadow-sm"
      style={{ background: '#151922', border: '1px solid #252B36' }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent text-[#F5F6F8] placeholder-[#A2A8B5] text-[14px] resize-none outline-none min-h-[24px] max-h-[120px] leading-6"
        style={{ scrollbarWidth: 'none' }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !input.trim()}
        className="w-8 h-8 rounded-[14px] flex items-center justify-center transition-all shrink-0 shadow-sm"
        style={{
          background: input.trim() && !disabled ? '#7C5CFF' : '#252B36',
          color: input.trim() && !disabled ? '#ffffff' : '#A2A8B5',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
