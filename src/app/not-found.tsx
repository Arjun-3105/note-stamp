"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/* ── tiny particle system ────────────────────────────────────────────── */
type Particle = { id: number; x: number; y: number; vx: number; vy: number; life: number; size: number };

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      life: Math.random(),
      size: Math.random() * 2 + 0.5,
    }));

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.life += 0.004;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        const alpha = (Math.sin(p.life * Math.PI * 2) * 0.5 + 0.5) * 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,182,212,${alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0" />;
}

/* ── glitch text ─────────────────────────────────────────────────────── */
function GlitchText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span aria-hidden className={`absolute inset-0 glitch-layer-1`}>{text}</span>
      <span aria-hidden className={`absolute inset-0 glitch-layer-2`}>{text}</span>
      <span className="relative">{text}</span>
    </span>
  );
}

/* ── orbiting dot ────────────────────────────────────────────────────── */
function OrbitRing({ delay = 0, duration = 8, color = "#06b6d4", size = 5 }: {
  delay?: number; duration?: number; color?: string; size?: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div style={{ animation: `orbit ${duration}s linear ${delay}s infinite` }}
        className="absolute">
        <div className="rounded-full" style={{ width: size, height: size, background: color,
          boxShadow: `0 0 ${size * 3}px ${color}` }} />
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */
export default function NotFound() {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", onMove);
    const interval = setInterval(() => setTick((t) => t + 1), 2000);
    return () => { window.removeEventListener("mousemove", onMove); clearInterval(interval); };
  }, []);

  const px = (mousePos.x - 0.5) * 30;
  const py = (mousePos.y - 0.5) * 20;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050505] px-6 text-center">
      <ParticleField />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full blur-[120px]"
          style={{ background: "rgba(6,182,212,0.08)", animation: "drift 12s ease-in-out infinite" }} />
        <div className="absolute -right-32 bottom-1/4 h-80 w-80 rounded-full blur-[100px]"
          style={{ background: "rgba(139,92,246,0.07)", animation: "drift 15s ease-in-out infinite 3s" }} />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
          style={{ background: "rgba(244,63,94,0.05)" }} />
      </div>

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(6,182,212,1) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,1) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">

        {/* 404 orbit ring + number */}
        <motion.div
          className="relative mb-10 flex h-56 w-56 items-center justify-center"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Concentric rings */}
          {[240, 200, 160].map((s, i) => (
            <div key={i} className="absolute rounded-full border"
              style={{
                width: s, height: s,
                borderColor: `rgba(6,182,212,${0.06 + i * 0.04})`,
                transform: `perspective(600px) rotateX(${py * 0.3}deg) rotateY(${px * 0.3}deg)`,
                transition: "transform 0.1s ease",
              }} />
          ))}

          {/* Orbiting dots */}
          <OrbitRing duration={6}  delay={0}   color="#06b6d4" size={5} />
          <OrbitRing duration={9}  delay={-3}  color="#8b5cf6" size={4} />
          <OrbitRing duration={12} delay={-6}  color="#f43f5e" size={3} />

          {/* Center number */}
          <motion.div
            style={{ transform: `perspective(600px) rotateX(${py * 0.6}deg) rotateY(${px * 0.6}deg)` }}
            className="relative select-none"
          >
            <GlitchText
              text="404"
              className="text-[5.5rem] font-black leading-none tracking-tighter text-white"
            />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="mb-3 text-2xl font-black tracking-tight text-white sm:text-3xl"
        >
          Page not found
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mb-10 max-w-sm text-sm leading-relaxed text-white/30"
        >
          Looks like this route got lost in the blockchain. The page you&apos;re
          looking for doesn&apos;t exist or was moved.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link href="/"
            className="group relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-white px-6 text-sm font-bold text-black transition hover:bg-white/90"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition group-hover:-translate-x-0.5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L4.863 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            Back to Home
          </Link>

          <Link href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-cyan-400">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Start Learning
          </Link>
        </motion.div>

        {/* Glitch tick — re-triggers animation */}
        <motion.div
          key={tick}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.15, times: [0, 0.5, 1] }}
          className="pointer-events-none absolute inset-0"
        />

        {/* Error code strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-16 flex items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.02] px-5 py-2"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" style={{ boxShadow: "0 0 6px #f43f5e" }} />
          <span className="font-mono text-[10px] tracking-widest text-white/20">
            HTTP_404 · NOT_FOUND · LEARNLOOP
          </span>
        </motion.div>
      </div>
    </div>
  );
}

