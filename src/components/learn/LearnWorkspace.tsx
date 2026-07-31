'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type LearningState = 'FOUNDATION' | 'DIALOGUE' | 'SYNTHESIS' | 'REFINEMENT';

interface EvaluationResult {
  passed: boolean;
  good: { title: string; details: string }[];
  weak: { title: string; details: string }[];
}

interface LearnWorkspaceProps {
  conceptTitle: string;
  conceptDescription: string;
  onComplete?: () => void;
}

// ─── Particle type ────────────────────────────────────────────────────────────
type Particle = { phi: number; theta: number; r: number; speed: number; offset: number; size: number };

const ORB_NUM  = 900;
const ORB_BASE_R = 105;

function makeParticles(): Particle[] {
  return Array.from({ length: ORB_NUM }, () => ({
    phi:    Math.acos(2 * Math.random() - 1),
    theta:  Math.random() * Math.PI * 2,
    r:      ORB_BASE_R + (Math.random() - 0.5) * 18,
    speed:  0.0012 + Math.random() * 0.0026,
    offset: Math.random() * Math.PI * 2,
    size:   0.45  + Math.random() * 1.7,
  }));
}

// ─── Voice-reactive CometOrb ──────────────────────────────────────────────────
// Only animates when the AI is speaking or the user is speaking.
// Listening  → driven by real microphone frequency data
// Speaking   → driven by a multi-frequency speech simulation
// Thinking   → slow, steady pulse
// Idle       → near-static (tiny core breathe)
const CometOrb = ({
  listening = false,
  speaking = false,
  thinking = false,
  failed = false,
  analyserRef,
  dataArrayRef,
}: {
  listening?: boolean;
  speaking?: boolean;
  thinking?: boolean;
  failed?: boolean;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  dataArrayRef: React.MutableRefObject<Uint8Array | null>;
}) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const frameRef     = useRef<number>(0);
  const volRef       = useRef(0);
  const phaseRef     = useRef(0);
  const particlesRef = useRef<Particle[] | null>(null);

  // Canvas is larger than display size so the halo never clips at the edge
  const SIZE    = 500;
  const DISPLAY = 360;

  useEffect(() => {
    // Initialise particles lazily inside the effect — keeps render pure
    if (!particlesRef.current) particlesRef.current = makeParticles();
    const particles = particlesRef.current;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    // Simulate natural speech cadence using layered frequency modulation
    const speechVol = () => {
      const t = performance.now() * 0.001;
      const syllable =
        Math.abs(Math.sin(t * 4.1 + Math.sin(t * 0.9) * 2.0)) * 0.55 +
        Math.abs(Math.sin(t * 7.6 + Math.sin(t * 1.5) * 1.4)) * 0.28 +
        Math.abs(Math.sin(t * 14.2)) * 0.12;
      const envelope = Math.pow(Math.sin(t * 0.95) * 0.5 + 0.5, 0.65);
      return Math.min(syllable * envelope * 0.85, 1);
    };

    const draw = (vol: number) => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      const scale = 1 + vol * 1.5;
      const jitter = vol * 17;
      const t = performance.now() * 0.001;

      // Outer ambient halo — larger when active
      const haloR = ORB_BASE_R * scale * 2.2;
      const haloGrad = ctx.createRadialGradient(cx, cy, ORB_BASE_R * 0.25, cx, cy, haloR);
      const hc = failed ? '255,100,40' : listening ? '110,185,255' : '225,218,205';
      haloGrad.addColorStop(0, `rgba(${hc},${(0.055 + vol * 0.11).toFixed(3)})`);
      haloGrad.addColorStop(0.55, `rgba(${hc},${(0.018 + vol * 0.045).toFixed(3)})`);
      haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();

      // Particles — colour shifts with mode
      const pc = failed ? '255,145,65' : listening ? '150,205,255' : '238,230,215';
      const speedMult = listening ? 2.2 : speaking ? 1.6 : thinking ? 0.55 : 0.22;

      for (const p of particles) {
        p.theta += p.speed * speedMult;
        const breathe = Math.sin(t * 1.25 + p.offset) * (1.5 + jitter);
        const r = (p.r + breathe) * scale;
        const x = cx + r * Math.sin(p.phi) * Math.cos(p.theta);
        const y = cy + r * Math.cos(p.phi);
        const depth = (Math.sin(p.phi) * Math.cos(p.theta) + 1) / 2;
        const alpha = Math.min(0.07 + depth * 0.6 + vol * 0.36, 1);
        const sz = p.size * (0.75 + vol * 0.48);
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pc},${alpha.toFixed(2)})`;
        ctx.fill();
      }

      // Core glow
      const coreR = 19 * scale;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      const cc = failed ? '255,195,110' : listening ? '195,225,255' : '255,252,248';
      coreGrad.addColorStop(0, `rgba(${cc},${(0.27 + vol * 0.52).toFixed(2)})`);
      coreGrad.addColorStop(0.45, `rgba(${cc},${(0.04 + vol * 0.09).toFixed(2)})`);
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Soft circular edge — erases canvas corners so no visible square boundary
      const edgeGrad = ctx.createRadialGradient(cx, cy, SIZE * 0.37, cx, cy, SIZE * 0.5);
      edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
      edgeGrad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.globalCompositeOperation = 'source-over';
    };

    const tick = () => {
      phaseRef.current += 0.009;
      let target = 0;

      if (listening && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) sum += dataArrayRef.current[i];
        target = Math.min(sum / dataArrayRef.current.length / 58, 1);
      } else if (speaking) {
        target = speechVol();
      } else if (thinking) {
        target = (Math.sin(phaseRef.current * 2.1) * 0.5 + 0.5) * 0.2;
      } else {
        target = (Math.sin(phaseRef.current * 0.85) * 0.5 + 0.5) * 0.032;
      }

      volRef.current += (target - volRef.current) * 0.13;
      draw(volRef.current);
      frameRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(frameRef.current);
    // analyserRef / dataArrayRef are stable refs; their .current is read inside tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, speaking, thinking, failed]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{ display: 'block', width: DISPLAY, height: DISPLAY, background: 'transparent' }}
    />
  );
};

// ─── Icon Button ─────────────────────────────────────────────────────────────
const IconBtn = ({
  onClick, active = false, danger = false, children, title,
}: {
  onClick: () => void; active?: boolean; danger?: boolean;
  children: React.ReactNode; title?: string;
}) => (
  <motion.button
    title={title}
    onClick={onClick}
    whileHover={{ scale: 1.07 }}
    whileTap={{ scale: 0.93 }}
    style={{
      width: 50, height: 50, borderRadius: '25px', border: 'none',
      background: danger && active
        ? 'rgba(220,55,55,0.2)'
        : active
          ? 'rgba(255,255,255,0.13)'
          : 'rgba(255,255,255,0.06)',
      color: danger && active ? '#ff5a5a' : 'rgba(255,255,255,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'background 0.2s, color 0.2s', flexShrink: 0,
      boxShadow: active ? '0 0 0 1px rgba(255,255,255,0.08) inset' : 'none',
    }}
  >
    {children}
  </motion.button>
);

// ─── Pill Button ──────────────────────────────────────────────────────────────
const PillBtn = ({
  onClick, disabled = false, children, variant = 'primary',
}: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode;
  variant?: 'primary' | 'success';
}) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    whileHover={!disabled ? { scale: 1.02 } : {}}
    whileTap={!disabled ? { scale: 0.97 } : {}}
    style={{
      height: 50, padding: '0 34px', borderRadius: '25px', border: 'none',
      background: disabled
        ? 'rgba(255,255,255,0.04)'
        : variant === 'success'
          ? 'rgba(74,222,128,0.9)'
          : 'rgba(255,255,255,0.92)',
      color: disabled ? 'rgba(255,255,255,0.16)' : '#0a0a0a',
      fontSize: 13.5, fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer',
      letterSpacing: '-0.01em', transition: 'all 0.2s', flexShrink: 0,
      fontFamily: 'inherit',
    }}
  >
    {children}
  </motion.button>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export const LearnWorkspace: React.FC<LearnWorkspaceProps> = ({
  conceptTitle, conceptDescription, onComplete,
}) => {
  const [currentState, setCurrentState] = useState<LearningState>('FOUNDATION');
  const [userExplanation, setUserExplanation] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [reExplainText, setReExplainText] = useState('');
  const [generatingReExplanation, setGeneratingReExplanation] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [speakingCharIndex, setSpeakingCharIndex] = useState(-1);

  // SpeechRecognition is not in standard TS libs — use an explicit interface
  interface SpeechRec {
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
    onerror: (() => void) | null;
    start: () => void;
    stop: () => void;
  }
  const recognitionRef = useRef<SpeechRec | null>(null);
  const synthRef  = useRef<SpeechSynthesis | null>(null);
  const voiceRef  = useRef<SpeechSynthesisVoice | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  // Karaoke timer — drives word-by-word highlight independently of onboundary
  const karaokeTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const karaokeWordsRef  = useRef<{ start: number; end: number }[]>([]);
  const karaokeIdxRef    = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    synthRef.current = window.speechSynthesis;

    // Pick a soft female voice — prefer well-known female voices across platforms
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const PRIORITY = [
        'Google UK English Female',
        'Microsoft Zira',
        'Samantha',
        'Karen',
        'Victoria',
        'Moira',
        'Tessa',
        'Fiona',
      ];
      for (const name of PRIORITY) {
        const v = voices.find(v => v.name.startsWith(name));
        if (v) { voiceRef.current = v; return; }
      }
      // Fallback: any voice whose name hints at female
      const fallback = voices.find(v =>
        /female|woman|girl|zira|samantha|karen|victoria|moira|tessa|fiona/i.test(v.name)
      );
      if (fallback) voiceRef.current = fallback;
    };

    window.speechSynthesis.onvoiceschanged = pickVoice;
    pickVoice(); // may already be populated on some browsers

    const SRClass = (
      (window as Window & { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition
    );
    if (SRClass) {
      recognitionRef.current = new SRClass();
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.onresult = (e: { resultIndex: number; results: SpeechRecognitionResultList }) => {
          let fin = '', interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) fin += e.results[i][0].transcript;
            else interim += e.results[i][0].transcript;
          }
          setInterimTranscript(interim);
          if (fin) setUserExplanation(p => p + (p.endsWith(' ') ? '' : ' ') + fin);
        };
        recognitionRef.current.onerror = () => setIsRecording(false);
      }
    }
    return () => {
      synthRef.current?.cancel();
      recognitionRef.current?.stop();
      micStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      if (karaokeTimerRef.current) clearInterval(karaokeTimerRef.current);
    };
  }, []);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ac = new AudioContext();
      audioCtxRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser();
      an.fftSize = 256;
      dataArrayRef.current = new Uint8Array(an.frequencyBinCount);
      analyserRef.current = an;
      src.connect(an);
    } catch { /* mic denied — orb just uses fallback */ }
  };

  const stopMic = () => {
    micStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    micStreamRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  };

  const toggleRecording = async () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript('');
      stopMic();
    } else {
      await startMic();
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  // ── Karaoke helpers ──────────────────────────────────────────────────────────

  const stopKaraoke = () => {
    if (karaokeTimerRef.current) { clearInterval(karaokeTimerRef.current); karaokeTimerRef.current = null; }
    setSpeakingCharIndex(-1);
  };

  /**
   * Pre-compute word char positions, then tick through them on a fixed interval.
   * onboundary is unreliable in Chrome (fires for first word only), so we drive
   * the highlight with a timer (~138 WPM at rate 0.92) and let onboundary
   * correct the index whenever it does fire.
   */
  const startKaraoke = (text: string) => {
    if (karaokeTimerRef.current) clearInterval(karaokeTimerRef.current);

    // Build word position table
    const words = text.split(/(\s+)/);            // keep whitespace tokens
    const positions: { start: number; end: number }[] = [];
    let pos = 0;
    for (const token of words) {
      if (/^\s+$/.test(token)) { pos += token.length; continue; }
      positions.push({ start: pos, end: pos + token.length });
      pos += token.length;
    }
    karaokeWordsRef.current = positions;
    karaokeIdxRef.current   = 0;
    setSpeakingCharIndex(positions[0]?.start ?? 0);

    // ~138 WPM → ~435 ms/word; using 410ms feels snappier and reads well
    const MS_PER_WORD = 410;
    karaokeTimerRef.current = setInterval(() => {
      karaokeIdxRef.current += 1;
      const next = karaokeWordsRef.current[karaokeIdxRef.current];
      if (!next) { clearInterval(karaokeTimerRef.current!); karaokeTimerRef.current = null; return; }
      setSpeakingCharIndex(next.start);
    }, MS_PER_WORD);
  };

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    if (isSpeaking) { setIsSpeaking(false); stopKaraoke(); return; }
    startKaraoke(text);
    const u = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate  = 0.92;
    u.pitch = 1.08;
    // Sync timer to actual speech whenever onboundary does fire
    u.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name !== 'word') return;
      setSpeakingCharIndex(e.charIndex);
      const idx = karaokeWordsRef.current.findIndex(w => w.start === e.charIndex);
      if (idx >= 0) karaokeIdxRef.current = idx;
    };
    u.onend = () => { setIsSpeaking(false); stopKaraoke(); };
    setIsSpeaking(true);
    synthRef.current.speak(u);
  };

  // Auto-speak without toggle — used after AI generates a response
  const autoSpeak = (text: string) => {
    if (!synthRef.current || !text) return;
    synthRef.current.cancel();
    startKaraoke(text);
    const u = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate  = 0.92;
    u.pitch = 1.08;
    u.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name !== 'word') return;
      setSpeakingCharIndex(e.charIndex);
      const idx = karaokeWordsRef.current.findIndex(w => w.start === e.charIndex);
      if (idx >= 0) karaokeIdxRef.current = idx;
    };
    u.onend = () => { setIsSpeaking(false); stopKaraoke(); };
    setIsSpeaking(true);
    synthRef.current.speak(u);
  };

  // Karaoke word highlight renderer
  const renderKaraoke = (text: string, charIdx: number) => {
    if (charIdx < 0) {
      return <span style={{ color: 'rgba(255,255,255,0.72)' }}>{text}</span>;
    }
    const words = text.split(' ');
    let pos = 0;
    return (
      <>
        {words.map((word, i) => {
          const start = pos;
          const end   = pos + word.length;
          pos = end + 1;
          const isActive = charIdx >= start && charIdx < end;
          const isPast   = charIdx >= end;
          return (
            <React.Fragment key={i}>
              <span style={{
                color: isActive
                  ? '#ffffff'
                  : isPast
                    ? 'rgba(255,255,255,0.48)'
                    : 'rgba(255,255,255,0.18)',
                transition: 'color 0.12s ease',
                fontWeight: isActive ? 600 : 400,
                textShadow: isActive ? '0 0 14px rgba(255,255,255,0.5)' : 'none',
              }}>
                {word}
              </span>
              {i < words.length - 1 && ' '}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  const startRefinement = async (evalResult: EvaluationResult) => {
    setCurrentState('REFINEMENT');
    setGeneratingReExplanation(true);
    try {
      const res = await fetch('/api/feynman/re-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: conceptTitle, description: conceptDescription,
          userExplanation, weaknesses: evalResult.weak,
        }),
      });
      const d = await res.json();
      setReExplainText(d.explanation);
      autoSpeak(d.explanation);
    } catch {
      const fallback = "Let me explain this from a different angle so it clicks for you.";
      setReExplainText(fallback);
      autoSpeak(fallback);
    } finally { setGeneratingReExplanation(false); }
  };

  // Detect whether input is a direct question (ends with ? or starts with question words)
  // Deliberately narrow — only catches clear questions, not explanations that start with "what"
  const looksLikeQuestion = (text: string) => {
    const t = text.trim();
    if (t.endsWith('?')) return true;
    // Only match question-openers, not explanation starters like "What this does is..."
    return /^(when |where |who |which |how (do|does|did|many|much|long|old|come)|why (is|are|was|were|did|do)|what (is|are|was|were|does|did|year|version|time)|can you |could you |tell me |i don't|i dont|i'm not|im not|not sure|confused|don't understand)/i.test(t);
  };

  const submitExplanation = async () => {
    if (!userExplanation.trim()) return;

    // If the user asked a direct question, route straight to re-explanation (answer it, don't evaluate)
    if (looksLikeQuestion(userExplanation)) {
      await startRefinement({
        passed: false,
        good: [],
        weak: [{ title: 'Direct Question', details: userExplanation }],
      });
      return;
    }

    setEvaluating(true);
    setCurrentState('SYNTHESIS');

    let result: EvaluationResult;
    try {
      const res = await fetch('/api/feynman/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: conceptTitle, description: conceptDescription, userExplanation }),
      });
      result = await res.json() as EvaluationResult;
    } catch {
      result = { passed: false, good: [], weak: [{ title: 'Sync Error', details: 'Could not reach the evaluation service.' }] };
    }

    setEvaluation(result);
    setEvaluating(false);

    if (result.passed) {
      autoSpeak(`Great work. Your understanding of ${conceptTitle} is solid. You've demonstrated a clear mental model of the concept.`);
    } else {
      void startRefinement(result);
    }
  };

  // SYNTHESIS is only a "passed" resting screen now — failures skip straight to REFINEMENT
  const orbPassed = evaluation !== null && evaluation.passed && currentState === 'SYNTHESIS';

  const orbListening = isRecording;
  const orbSpeaking  = isSpeaking;
  const orbThinking  = evaluating || generatingReExplanation;

  const getStatus = (): { text: string; color: string; pulse: boolean } | null => {
    if (isRecording)              return { text: 'Listening',          color: '#ff5555',                pulse: true  };
    if (isSpeaking)               return { text: 'Architect Speaking', color: 'rgba(255,255,255,0.42)', pulse: false };
    if (evaluating)               return { text: 'Analysing',          color: 'rgba(255,255,255,0.3)',  pulse: false };
    if (generatingReExplanation)  return { text: 'Recalibrating',      color: 'rgba(255,255,255,0.3)',  pulse: false };
    return null;
  };
  const status = getStatus();

  const getTopContent = (): { main: string; sub?: string } => {
    if (currentState === 'FOUNDATION' && isSpeaking)
      return { main: 'The Architect is establishing the concept…' };
    if (currentState === 'FOUNDATION')
      return { main: conceptTitle, sub: conceptDescription };
    if (currentState === 'DIALOGUE' && isRecording)
      return { main: interimTranscript ? `"${interimTranscript}…"` : 'Listening to your explanation…' };
    if (currentState === 'DIALOGUE')
      return { main: 'Collaborative Exchange', sub: 'Share your mental model or ask for clarification.' };
    if (currentState === 'SYNTHESIS' && evaluating)
      return { main: 'Analysing your explanation…' };
    if (currentState === 'SYNTHESIS' && evaluation?.passed)
      return { main: 'Conceptual alignment achieved.' };
    if (currentState === 'REFINEMENT' && generatingReExplanation)
      return { main: 'Recalibrating perspective…' };
    if (currentState === 'REFINEMENT' && reExplainText)
      return { main: "Architect's Perspective" }; // full text shown in card below
    return { main: '' };
  };
  const { main, sub } = getTopContent();

  const getBg = () => {
    if (orbPassed)   return 'radial-gradient(ellipse 90% 70% at 50% 45%, #022c22 0%, var(--color-slate-950) 100%)';
    if (isRecording) return 'radial-gradient(ellipse 90% 70% at 50% 45%, #1e1b4b 0%, var(--color-slate-950) 100%)';
    if (isSpeaking)  return 'radial-gradient(ellipse 90% 70% at 50% 45%, #1e293b 0%, var(--color-slate-950) 100%)';
    return 'radial-gradient(ellipse 90% 70% at 50% 45%, #0f172a 0%, var(--color-slate-950) 100%)';
  };

  const mainFontSize = main.length > 40 ? 18 : 23;
  const mainColor    = orbPassed ? '#34d399' : '#f8fafc';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', minHeight: '100vh',
      background: getBg(), color: 'var(--color-slate-100)',
      fontFamily: 'var(--font-sans)',
      position: 'relative', transition: 'background 2s ease',
      overflow: 'hidden',
    }}>

      {/* ── Centre ───────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '64px 24px 20px',
      }}>

        {/* Text above orb */}
        <AnimatePresence mode="wait">
          <motion.div
            key={main.slice(0, 40)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.42 }}
            style={{
              textAlign: 'center', maxWidth: 340, marginBottom: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}
          >
            <p style={{
              fontSize: mainFontSize, fontWeight: 700, color: mainColor,
              margin: 0, lineHeight: 1.3, letterSpacing: '-0.025em',
            }}>
              {main}
            </p>

            {sub && (
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.32)', margin: 0, lineHeight: 1.65 }}>
                {sub}
              </p>
            )}

            {currentState === 'SYNTHESIS' && !evaluating && evaluation?.passed && (
              <motion.button
                onClick={() => setShowDetail(v => !v)}
                whileHover={{ opacity: 0.75 }}
                style={{
                  fontSize: 9.5, color: 'rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  cursor: 'pointer', borderRadius: 20,
                  padding: '5px 14px', fontFamily: 'inherit',
                  textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700,
                }}
              >
                {showDetail ? 'Collapse' : 'View Breakdown'}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Evaluation breakdown panel — only on passed */}
        <AnimatePresence>
          {showDetail && evaluation?.passed && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              style={{ width: '100%', maxWidth: 340, marginBottom: 12 }}
            >
              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.055)',
                borderRadius: 18, padding: '18px',
                display: 'flex', flexDirection: 'column', gap: 13,
              }}>
                {evaluation.good.map((g, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>{g.title}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.32)', lineHeight: 1.5 }}>{g.details}</p>
                    </div>
                  </div>
                ))}
                {evaluation.weak.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff5a5a', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#ff7a58' }}>{w.title}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.26)', lineHeight: 1.5 }}>{w.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── THE ORB — no bounding box, canvas overflows freely ── */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <CometOrb
            listening={orbListening}
            speaking={orbSpeaking}
            thinking={orbThinking}
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
          />

          {/* Status label — sits inside the canvas area, no outer box */}
          <AnimatePresence>
            {status && (
              <motion.div
                key={status.text}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  bottom: 28,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 10, letterSpacing: '0.18em',
                  textTransform: 'uppercase', fontWeight: 800,
                  color: status.color, whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {status.pulse && (
                  <span style={{
                    display: 'inline-block',
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#ff5555',
                    animation: 'orbPulse 1.1s ease-in-out infinite',
                  }} />
                )}
                {status.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── AI Explanation card — REFINEMENT state ────────────── */}
        <AnimatePresence>
          {currentState === 'REFINEMENT' && reExplainText && !generatingReExplanation && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.5 }}
              style={{ width: '100%', maxWidth: 340, marginTop: 4 }}
            >
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20, padding: '18px 20px',
                maxHeight: 160, overflowY: 'auto',
              }}>
                <p style={{
                  margin: 0, fontSize: 13.5,
                  lineHeight: 1.75, letterSpacing: '-0.005em',
                }}>
                  {renderKaraoke(reExplainText, isSpeaking ? speakingCharIndex : -1)}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Text entry (DIALOGUE state only) ──────────────────────── */}
      <AnimatePresence>
        {currentState === 'DIALOGUE' && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            style={{ padding: '0 28px', marginBottom: 16 }}
          >
            <textarea
              value={userExplanation}
              onChange={e => setUserExplanation(e.target.value)}
              placeholder="Explain the concept or ask a doubt…"
              style={{
                width: '100%', minHeight: 104,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 18, padding: '15px 20px',
                color: '#fff', fontSize: 15, lineHeight: 1.65,
                resize: 'none', outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom control bar ────────────────────────────────────── */}
      <div style={{
        padding: '0 28px 46px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 12, flexShrink: 0,
      }}>
        <AnimatePresence mode="wait">

          {/* FOUNDATION */}
          {currentState === 'FOUNDATION' && (
            <motion.div key="b-fnd"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              style={{ display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <IconBtn onClick={() => { synthRef.current?.cancel(); setIsSpeaking(false); }} title="Dismiss">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </IconBtn>
              <IconBtn onClick={() => speakText(conceptDescription)} active={isSpeaking} title={isSpeaking ? 'Stop' : 'Listen'}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M2 10v4h4l5 5V5L6 9H2zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </IconBtn>
              <PillBtn onClick={() => { synthRef.current?.cancel(); setIsSpeaking(false); setCurrentState('DIALOGUE'); }}>
                Start Dialogue →
              </PillBtn>
            </motion.div>
          )}

          {/* DIALOGUE */}
          {currentState === 'DIALOGUE' && (
            <motion.div key="b-dia"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              style={{ display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <IconBtn
                onClick={() => { stopMic(); setIsRecording(false); setCurrentState('FOUNDATION'); }}
                title="Back"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </IconBtn>
              <IconBtn onClick={toggleRecording} active={isRecording} danger={isRecording} title={isRecording ? 'Stop' : 'Speak'}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
              </IconBtn>
              <PillBtn onClick={submitExplanation} disabled={!userExplanation.trim()}>
                Refine Concept →
              </PillBtn>
            </motion.div>
          )}

          {/* SYNTHESIS — only reachable when passed */}
          {currentState === 'SYNTHESIS' && !evaluating && evaluation?.passed && (
            <motion.div key="b-syn"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              style={{ display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <PillBtn onClick={() => onComplete?.()} variant="success">
                Complete Mastery ✓
              </PillBtn>
            </motion.div>
          )}

          {/* REFINEMENT */}
          {currentState === 'REFINEMENT' && !generatingReExplanation && (
            <motion.div key="b-ref"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              style={{ display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <IconBtn onClick={() => speakText(reExplainText)} active={isSpeaking} title={isSpeaking ? 'Stop speaking' : 'Replay explanation'}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M2 10v4h4l5 5V5L6 9H2zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </IconBtn>
              <PillBtn onClick={() => {
                synthRef.current?.cancel();
                setIsSpeaking(false);
                setUserExplanation('');
                setReExplainText('');
                setEvaluation(null);
                setCurrentState('DIALOGUE');
              }}>
                Try Again →
              </PillBtn>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <style>{`
        @keyframes orbPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.65); }
        }
      `}</style>
    </div>
  );
};

