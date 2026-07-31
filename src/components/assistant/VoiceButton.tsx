'use client';

import { useVoice } from '@/hooks/useVoice';

export interface VoiceButtonProps {
  onTranscript: (transcript: string) => void;
  /** If true, auto-speak assistant responses (TTS mode) */
  responseToSpeak?: string | null;
  disabled?: boolean;
}

export function VoiceButton({ onTranscript, responseToSpeak, disabled = false }: VoiceButtonProps) {
  const { isListening, isSpeaking, isSupported, startListening, stopListening, speak, stopSpeaking } =
    useVoice();

  // Auto-speak when a new response arrives and user is in voice mode
  const prevResponseRef = { current: null as string | null };
  if (responseToSpeak && responseToSpeak !== prevResponseRef.current) {
    prevResponseRef.current = responseToSpeak;
    if (!isListening) {
      speak(responseToSpeak);
    }
  }

  if (!isSupported) return null;

  const handleToggle = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening(onTranscript);
    }
  };

  const label = isSpeaking ? '🔊 Speaking' : isListening ? '🎤 Listening…' : '🎤 Voice';
  const color = isSpeaking
    ? 'bg-purple-600 hover:bg-purple-700'
    : isListening
    ? 'bg-red-600 hover:bg-red-700 animate-pulse'
    : 'bg-slate-700 hover:bg-slate-600';

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled && !isListening && !isSpeaking}
      title={isListening ? 'Stop listening' : isSpeaking ? 'Stop speaking' : 'Start voice input'}
      className={`rounded-lg px-3 py-2 text-white text-sm font-medium transition-all ${color} disabled:opacity-40 disabled:cursor-not-allowed select-none`}
    >
      {label}
    </button>
  );
}
