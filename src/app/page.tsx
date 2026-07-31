'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Data ──────────────────────────────────────────────────────── */
const AI_MODES = [
  { id: 'teacher',       label: 'AI Teacher',      icon: '🧑‍🏫', desc: 'Ask questions and get step-by-step explanations.', color: '#6c63ff' },
  { id: 'corrector',     label: 'Corrector',       icon: '✏️',  desc: 'Get feedback and improve your notes and writing.', color: '#10b981' },
  { id: 'quiz_hint',     label: 'Quiz Hint',       icon: '💡',  desc: 'Get a nudge when you\'re stuck, not the answer.', color: '#f59e0b' },
  { id: 'roadmap',       label: 'Roadmap Guide',   icon: '🗺️', desc: 'See what to learn next and how to master it.', color: '#3b82f6' },
  { id: 'solver',        label: 'Problem Solver',  icon: '🧩',  desc: 'Solve problems with guided steps and explanations.', color: '#f97316' },
];

const STEPS = [
  { n: '01', title: 'Import anything', desc: 'Drop a YouTube URL, PDF, GitHub repo, or paste text. Processed in under 60 seconds.' },
  { n: '02', title: 'AI builds your workspace', desc: 'Flashcards, checkpoints, concept maps, and a personal roadmap — all generated automatically.' },
  { n: '03', title: 'Study with 5 AI modes', desc: 'Switch between Teacher, Corrector, Quiz Hint, Roadmap Guide, and Problem Solver as you need.' },
  { n: '04', title: 'Earn verifiable proof', desc: 'Pass the assessment. Mint an NFT certificate on Polygon — permanently verifiable by anyone.' },
];

const PRICING = [
  {
    tier: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Everything you need to start learning smarter.',
    cta: 'Start free',
    href: '/sign-up',
    highlighted: false,
    features: ['3 workspaces', 'YouTube + PDF ingestion', 'AI flashcards & quizzes', 'All 5 AI modes', 'Community passport'],
  },
  {
    tier: 'Pro',
    price: '$12',
    period: '/ month',
    desc: 'Unlimited learning with full AI power.',
    cta: 'Start Pro',
    href: '/sign-up?plan=pro',
    highlighted: true,
    features: ['Unlimited workspaces', 'GitHub + audio ingestion', 'Concept maps & AI tutor', '1 free NFT certificate', 'Priority AI routing', 'Advanced analytics'],
  },
];

const FAQ = [
  { q: 'Is there a free plan?', a: 'Yes. 3 workspaces, YouTube & PDF ingestion, all 5 AI modes, and AI-generated flashcards & quizzes — forever. No credit card needed.' },
  { q: 'What sources can I import?', a: 'YouTube videos, PDFs, raw text/markdown, GitHub repositories, and audio recordings. More formats coming.' },
  { q: 'How do the NFT certificates work?', a: 'After passing a master assessment, we mint an ERC-721 token to your wallet on Polygon. The certificate is pinned to IPFS — verifiable by anyone on Polygonscan, permanently.' },
  { q: "How is this different from Anki or Notion?", a: "Anki doesn't auto-ingest sources. Notion doesn't quiz you or build concept maps. Neither issues verifiable credentials. LearnLoop replaces all three with one adaptive loop." },
  { q: 'Do I need a crypto wallet?', a: 'Only to mint a certificate. All learning features work without a wallet. Connect one when you\'re ready to prove mastery.' },
];

const DEMO_CONVERSATIONS: Record<string, { user: string; ai: string }[]> = {
  teacher: [
    { user: "What is the attention mechanism in transformers?", ai: "Great question! The attention mechanism lets the model 'attend' to relevant parts of the input. For each word, it computes a weighted sum of all other words." },
  ],
  corrector: [
    { user: "The attention mechanism multiplies Query and Key matrices to get attention scores.", ai: "Almost right! Small correction: you compute the dot product of Q and K, then divide by √dₖ for stability before applying softmax. Then you multiply by V." },
  ],
  quiz_hint: [
    { user: "I'm stuck — what does softmax do in attention?", ai: "Think about it this way: you have a set of scores. What operation would convert them into probabilities that all add up to 1? 🤔 Hint: it's an exponential function..." },
  ],
  roadmap: [
    { user: "What should I study next?", ai: "Based on your quiz scores, here's my recommendation:\n1. Scaled Dot Product (45%)\n2. Softmax & Normalization\n3. Multi-Head Attention" },
  ],
  solver: [
    { user: "I need to compute Attention(Q,K,V) where Q=K=V=[[1,0],[0,1]]", ai: "Let's go step by step:\n\nStep 1: Compute QKᵀ\n[[1,0],[0,1]] × [[1,0],[0,1]]ᵀ = [[1,0],[0,1]]\n\nYour turn for Step 2!" },
  ],
};

/* ─── Interactive Hero Window ───────────────────────────────────── */
function HeroDemo() {
  const [activeMode, setActiveMode] = useState('teacher');
  const [messages, setMessages] = useState(DEMO_CONVERSATIONS['teacher']);
  const [inputVal, setInputVal] = useState('');
  const [typing, setTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(DEMO_CONVERSATIONS[activeMode]);
    setInputVal('');
  }, [activeMode]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const newMsg = { user: inputVal, ai: '' };
    setMessages(prev => [...prev, newMsg]);
    setInputVal('');
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          ai: "I'm a demo — connect a source and I'll give you real, context-aware answers.",
        };
        return updated;
      });
      setTyping(false);
    }, 1200);
  };

  const mode = AI_MODES.find(m => m.id === activeMode)!;

  return (
    <div className="relative w-full max-w-xl mx-auto md:mx-0 shadow-[0_32px_80px_rgba(108,99,255,0.2)] rounded-3xl bg-white border border-[#e5e7eb] overflow-hidden flex h-[500px]">
      
      {/* Sidebar Tabs */}
      <div className="w-[60px] sm:w-[150px] shrink-0 bg-[#f9fafb] border-r border-[#e5e7eb] flex flex-col p-3 gap-2 overflow-y-auto">
        <div className="hidden sm:block text-[11px] font-extrabold text-[#6b7280] uppercase tracking-wider mb-2 px-2 mt-2">Modes</div>
        {AI_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setActiveMode(m.id)}
            className="flex items-center gap-3 p-2 sm:px-3 sm:py-3 rounded-2xl text-left transition-all relative group w-full justify-center sm:justify-start"
          >
            {activeMode === m.id && (
              <motion.div 
                layoutId="activeHeroTab"
                className="absolute inset-0 bg-white border border-[#e5e7eb] shadow-sm rounded-2xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 text-xl group-hover:scale-110 transition-transform">{m.icon}</span> 
            <span className="relative z-10 text-[14px] font-bold hidden sm:block" style={{ color: activeMode === m.id ? '#111827' : '#6b7280' }}>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        <div className="px-5 py-4 border-b border-[#e5e7eb] flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6c63ff] animate-pulse shadow-[0_0_8px_rgba(108,99,255,0.6)]" />
            <span className="text-[15px] font-extrabold" style={{ color: '#111827' }}>{mode.label}</span>
          </div>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[85%] text-[14px] font-semibold px-5 py-3 rounded-2xl rounded-tr-sm bg-[#6c63ff] shadow-md shadow-[#6c63ff]/20" style={{ color: '#ffffff' }}>
                    {msg.user}
                  </div>
                </div>
                {msg.ai && (
                  <div className="flex justify-start">
                    <div className="max-w-[90%] text-[14px] font-medium px-5 py-4 rounded-2xl rounded-tl-sm border border-[#e5e7eb] bg-[#f9fafb] leading-relaxed shadow-sm" style={{ color: '#111827' }}>
                      {msg.ai}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {typing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="px-5 py-4 rounded-2xl rounded-tl-sm border border-[#e5e7eb] bg-[#f9fafb] flex items-center gap-1.5 h-12 shadow-sm">
                <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 rounded-full bg-[#6c63ff]" />
                <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#6c63ff]" />
                <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#6c63ff]" />
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-[#e5e7eb]">
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 bg-[#f9fafb] border border-[#e5e7eb] focus-within:border-[#6c63ff] focus-within:ring-2 focus-within:ring-[#6c63ff]/20 transition-all">
            <input
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question..."
              className="flex-1 bg-transparent text-[14px] font-semibold outline-none placeholder-[#9ca3af]"
              style={{ color: '#111827' }}
            />
            <button
              onClick={handleSend}
              className="bg-[#6c63ff] hover:bg-[#5a52e6] transition-colors text-[13px] font-bold px-4 py-2 rounded-lg shadow-sm"
              style={{ color: '#ffffff' }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}

/* ─── FAQ Item ──────────────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#e5e7eb]">
      <button
        className="w-full text-left py-6 flex items-center justify-between gap-4 hover:text-[#6c63ff] transition-colors"
        style={{ color: '#111827' }}
        onClick={() => setOpen(!open)}
      >
        <span className="text-[18px] font-bold">{q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} className="text-[#6b7280] text-2xl font-light">
          +
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-6 text-[16px] font-medium leading-relaxed max-w-3xl" style={{ color: '#4b5563' }}>
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function HomePage() {
  const { isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div style={{ background: '#fcfcfc', color: '#111827', fontFamily: "'Inter', -apple-system, sans-serif", overflowX: 'hidden' }}>
      
      {/* ── NAV ─────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 transition-all duration-300"
        style={{
          height: 80,
          background: scrolled ? 'rgba(252,252,252,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(17,24,39,0.05)' : '1px solid transparent',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#6c63ff] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-extrabold text-[18px] tracking-tight" style={{ color: '#111827' }}>LearnLoop</span>
        </div>

        <nav className="hidden lg:flex items-center gap-8">
          {[['#modes', 'Features'], ['#how', 'How It Works'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']].map(([href, label]) => (
            <a key={href} href={href} className="text-[15px] font-bold hover:text-[#6c63ff] transition-colors" style={{ color: '#4b5563' }}>
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {isSignedIn ? (
            <Link href="/dashboard" className="px-6 py-3 rounded-[12px] text-[15px] font-bold bg-[#6c63ff] hover:bg-[#5a52e6] transition-colors shadow-md" style={{ color: '#ffffff' }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="text-[15px] font-bold hover:text-[#6c63ff] transition-colors hidden sm:block" style={{ color: '#4b5563' }}>
                Log in
              </Link>
              <Link href="/sign-up" className="px-6 py-3 rounded-[12px] text-[15px] font-bold bg-[#6c63ff] hover:bg-[#5a52e6] shadow-[0_6px_16px_rgba(108,99,255,0.3)] transition-all" style={{ color: '#ffffff' }}>
                Get Started Free →
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── HERO (2-Column) ─────────────────────────────────────── */}
      <section className="relative z-10 pt-[140px] pb-[80px] px-6 md:px-10 max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-8 min-h-[90vh]">
        
        {/* Ambient glow behind right side */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#6c63ff]/15 rounded-full blur-[100px] -z-10 pointer-events-none hidden lg:block" />

        <div className="flex-1 text-center lg:text-left z-10 lg:pr-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f3f4f6] text-[13px] font-bold tracking-wide mb-8 border border-[#e5e7eb]"
            style={{ color: '#6c63ff' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#6c63ff]" />
            AI Workspace for Real Learning
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[clamp(3rem,5.5vw,5.5rem)] font-extrabold tracking-[-0.03em] leading-[1.05] mb-8"
            style={{ color: '#111827' }}
          >
            Learn deeper.<br />
            Remember longer.<br />
            <span style={{ color: '#6c63ff' }}>Master anything.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[18px] md:text-[22px] font-semibold leading-relaxed max-w-xl mx-auto lg:mx-0 mb-10"
            style={{ color: '#374151' }}
          >
            LearnLoop turns any content into understanding, tracks your progress, and helps you master what matters.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center lg:justify-start mb-12"
          >
            <Link href={isSignedIn ? '/dashboard' : '/sign-up'} className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-[12px] font-bold bg-[#6c63ff] hover:bg-[#5a52e6] shadow-[0_8px_20px_rgba(108,99,255,0.25)] hover:-translate-y-0.5 transition-all text-[16px]" style={{ color: '#ffffff' }}>
              Get Started Free →
            </Link>
            <a href="#how" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-[12px] font-bold bg-white border-2 border-[#e5e7eb] hover:bg-[#f3f4f6] transition-all text-[16px]" style={{ color: '#111827' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              See How It Works
            </a>
          </motion.div>

          {/* Trust Row */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center gap-8 justify-center lg:justify-start text-[15px] font-bold"
            style={{ color: '#4b5563' }}
          >
            <span className="flex items-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> No credit card required</span>
            <span className="flex items-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> Privacy focused</span>
          </motion.div>
        </div>

        <div className="flex-1 w-full relative z-10 flex justify-center lg:justify-end">
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full max-w-[650px]"
          >
            <HeroDemo />
          </motion.div>
        </div>

      </section>

      {/* ── AI MODES ────────────────────────────────────────────── */}
      <section id="modes" className="py-[100px] px-6 md:px-10">
        <div className="max-w-[1400px] mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-12" style={{ color: '#111827' }}>
            Five <span style={{ color: '#6c63ff' }}>AI</span> Modes. One Smart Workspace.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {AI_MODES.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-white rounded-[24px] p-8 border border-[#e5e7eb] hover:border-[#6c63ff]/30 hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all flex flex-col group cursor-pointer"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-14 h-14 rounded-[14px] flex items-center justify-center text-3xl shrink-0 shadow-sm border border-[#e5e7eb]" style={{ background: `${m.color}15` }}>
                    {m.icon}
                  </div>
                </div>
                <h3 className="text-[19px] font-extrabold mb-3" style={{ color: '#111827' }}>{m.label}</h3>
                <p className="text-[15px] font-semibold leading-relaxed flex-1" style={{ color: '#4b5563' }}>{m.desc}</p>
                <div className="mt-5 flex justify-end">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xl" style={{ color: m.color }}>→</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section id="how" className="py-[120px] px-6 md:px-10 bg-white border-y border-[#e5e7eb]">
        <div className="max-w-[1400px] mx-auto">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] mb-16 text-center" style={{ color: '#111827' }}>
            The Workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex flex-col items-center text-center group"
              >
                <div className="w-20 h-20 rounded-[20px] bg-[#f3f4f6] flex items-center justify-center font-black text-3xl mb-8 border border-[#e5e7eb] shadow-sm group-hover:-translate-y-2 transition-transform" style={{ color: '#6c63ff' }}>
                  {s.n}
                </div>
                <h3 className="text-[22px] font-extrabold mb-4" style={{ color: '#111827' }}>{s.title}</h3>
                <p className="text-[16px] font-medium leading-relaxed max-w-[300px]" style={{ color: '#4b5563' }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────── */}
      <section id="pricing" className="py-[120px] px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] mb-4" style={{ color: '#111827' }}>Simple Pricing</h2>
            <p className="text-[20px] font-semibold" style={{ color: '#4b5563' }}>Start free. Upgrade when you're ready.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {PRICING.map((p, i) => (
              <motion.div
                key={p.tier}
                initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-10 rounded-[2rem] flex flex-col relative overflow-hidden bg-white"
                style={{
                  border: p.highlighted ? '2px solid #6c63ff' : '1px solid #e5e7eb',
                  boxShadow: p.highlighted ? '0 24px 48px rgba(108,99,255,0.15)' : '0 4px 12px rgba(0,0,0,0.03)'
                }}
              >
                {p.highlighted && (
                  <div className="absolute top-0 right-0 p-6">
                    <span className="px-5 py-2 rounded-full text-[12px] font-extrabold bg-[#6c63ff] text-white uppercase tracking-wider shadow-md">
                      Popular
                    </span>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-3xl font-extrabold mb-2" style={{ color: '#111827' }}>{p.tier}</h3>
                  <p className="text-[16px] font-semibold" style={{ color: '#4b5563' }}>{p.desc}</p>
                </div>
                
                <div className="mb-8 flex items-baseline gap-2">
                  <span className="text-6xl font-extrabold tracking-[-0.04em]" style={{ color: '#111827' }}>{p.price}</span>
                  <span className="text-[18px] font-bold" style={{ color: '#6b7280' }}>{p.period}</span>
                </div>
                
                <ul className="space-y-5 mb-10 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-full bg-[#f3f4f6] flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p.highlighted ? '#6c63ff' : '#111827'} strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                      <span className="text-[16px] font-bold" style={{ color: '#4b5563' }}>{f}</span>
                    </li>
                  ))}
                </ul>
                
                <Link
                  href={p.href}
                  className="block text-center w-full py-5 rounded-2xl font-bold text-[16px] transition-all"
                  style={{
                    background: p.highlighted ? '#6c63ff' : '#f3f4f6',
                    color: p.highlighted ? '#fff' : '#111827',
                  }}
                >
                  {p.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="py-[100px] px-6 md:px-10 bg-white border-t border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] mb-4" style={{ color: '#111827' }}>Frequently Asked</h2>
          </div>
          <div className="border-t border-[#e5e7eb]">
            {FAQ.map(item => <FAQItem key={item.q} {...item} />)}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="py-12 px-6 md:px-10 bg-[#fcfcfc] border-t border-[#e5e7eb]">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#6c63ff] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <span className="font-extrabold text-[18px]" style={{ color: '#111827' }}>LearnLoop</span>
          </div>
          
          <div className="flex items-center gap-8">
            <a href="#" className="text-[15px] font-bold hover:text-[#111827] transition-colors" style={{ color: '#6b7280' }}>Terms</a>
            <a href="#" className="text-[15px] font-bold hover:text-[#111827] transition-colors" style={{ color: '#6b7280' }}>Privacy</a>
            <a href="#" className="text-[15px] font-bold hover:text-[#111827] transition-colors" style={{ color: '#6b7280' }}>Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
