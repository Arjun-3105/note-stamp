'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_TOP = [
  { href: '/dashboard',        label: 'Home',          icon: HomeIcon },
  { href: '/workspace',        label: 'My Learning',   icon: LearningIcon },
  { href: '/notes',            label: 'Notes',         icon: NotesIcon },
  { href: '/flashcards',       label: 'Flashcards',    icon: FlashIcon },
  { href: '/roadmap',          label: 'Mind Maps',     icon: MindMapIcon },
  { href: '/ai-modes',         label: 'AI Modes',      icon: AIIcon },
  { href: '/progress',         label: 'Progress',      icon: ProgressIcon },
  { href: '/passport',         label: 'Achievements',  icon: AchievementIcon },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 200,
        height: '100vh',
        background: '#fff',
        borderRight: '1px solid #f0f0f5',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b shrink-0" style={{ borderColor: '#f0f0f5' }}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6c63ff, #a78bfa)' }}
        >
          <svg viewBox="0 0 24 24" fill="white" style={{ width: 16, height: 16 }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#1a1a2e', letterSpacing: '-0.02em' }}>LearnLoop</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_TOP.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium"
              style={{
                color: active ? '#6c63ff' : '#666',
                background: active ? '#6c63ff12' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <span style={{ color: active ? '#6c63ff' : '#999', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom upgrade + invite */}
      <div className="px-3 pb-4 space-y-2 shrink-0">
        {/* Upgrade */}
        <div className="rounded-2xl p-3" style={{ background: '#f5f3ff', border: '1px solid #e0d9ff' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">💜</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6c63ff' }}>Upgrade to Pro</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <p style={{ fontSize: 11, color: '#888', lineHeight: 1.4, marginBottom: 8 }}>
            Unlock advanced AI, custom roadmap, and more.
          </p>
          <Link
            href="/settings/billing"
            className="block text-center w-full py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
            style={{ background: '#6c63ff', color: '#fff', textDecoration: 'none' }}
          >
            Upgrade
          </Link>
        </div>

        {/* Invite */}
        <div className="rounded-2xl p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm">🎁</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>Invite &amp; Earn</span>
          </div>
          <p style={{ fontSize: 11, color: '#888', lineHeight: 1.4, marginBottom: 8 }}>
            Invite friends and earn rewards.
          </p>
          <button
            className="w-full py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
            style={{ background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Invite Now
          </button>
        </div>
      </div>
    </aside>
  );
};

/* ── Icons ── */
function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" /></svg>;
}
function LearningIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
}
function NotesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function FlashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
}
function MindMapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="5" cy="5" r="2" /><line x1="12" y1="9" x2="19" y2="7" /><line x1="12" y1="15" x2="5" y2="17" /><line x1="15" y1="12" x2="17" y2="19" /><line x1="9" y1="12" x2="7" y2="5" /></svg>;
}
function AIIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>;
}
function ProgressIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}
function AchievementIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><polyline points="6 9 12 15 18 9" /><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg>;
}
