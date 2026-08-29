'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from '@/components/wallet/WalletButton';
import { CreateWorkspaceModal } from '@/components/workspace/CreateWorkspaceModal';

const NAV_TOP = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/workspace', label: 'My Learning', icon: LearningIcon },
  { href: '/notes', label: 'Notes', icon: NotesIcon },
  { href: '/flashcards', label: 'Flashcards', icon: FlashIcon },
  { href: '/roadmap', label: 'Mind Maps', icon: MindMapIcon },
  { href: '/ai-modes', label: 'AI Modes', icon: AIIcon },
  { href: '/progress', label: 'Progress', icon: ProgressIcon },
  { href: '/passport', label: 'Achievements', icon: AchievementIcon },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onMobileClose }) => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col shrink-0 bg-white border-r border-gray-100 transition-all duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          width: collapsed ? 68 : 220,
          height: '100vh',
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden text-decoration-none">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #a78bfa)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {!collapsed && (
              <span className="font-extrabold text-base text-gray-900 tracking-tight whitespace-nowrap">
                LearnLoop
              </span>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {/* Primary "+ Create Workspace" action button */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setIsModalOpen(true)}
            className={`w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 ${
              collapsed ? 'px-0' : ''
            }`}
            title="Create New Workspace"
          >
            <span className="text-base font-extrabold leading-none">+</span>
            {!collapsed && <span>New Workspace</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {NAV_TOP.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                  active
                    ? 'bg-indigo-50 text-indigo-600 font-bold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? label : undefined}
                style={{ textDecoration: 'none' }}
              >
                <span className={`w-4 h-4 flex items-center justify-center shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                  <Icon />
                </span>
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Wallet & Upgrade */}
        {!collapsed && (
          <div className="px-3 pb-4 space-y-2 shrink-0 border-t border-gray-100 pt-3">
            <div className="rounded-xl p-2.5 bg-emerald-50/70 border border-emerald-100">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">🦊</span>
                <span className="text-[11px] font-bold text-emerald-800">Web3 Wallet</span>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-700 text-white font-bold">
                  Sepolia
                </span>
              </div>
              <WalletButton variant="compact" labelConnect="Connect MetaMask" className="w-full justify-center text-[11px]" />
            </div>
          </div>
        )}
      </aside>

      {/* Global Workspace Modal */}
      <CreateWorkspaceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

/* ── Icons ── */
function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" /></svg>;
}
function LearningIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
}
function NotesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function FlashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
}
function MindMapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="5" cy="5" r="2" /><line x1="12" y1="9" x2="19" y2="7" /><line x1="12" y1="15" x2="5" y2="17" /><line x1="15" y1="12" x2="17" y2="19" /><line x1="9" y1="12" x2="7" y2="5" /></svg>;
}
function AIIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>;
}
function ProgressIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}
function AchievementIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="6 9 12 15 18 9" /><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg>;
}
