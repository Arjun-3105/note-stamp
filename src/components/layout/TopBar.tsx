'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { CreateWorkspaceModal } from '@/components/workspace/CreateWorkspaceModal';

interface TopBarProps {
  onToggleMobileMenu?: () => void;
}

export function TopBar({ onToggleMobileMenu }: TopBarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <header
        className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-gray-100 bg-white"
      >
        {/* Mobile Hamburger & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search bar */}
          <div
            className="hidden sm:flex items-center gap-2 max-w-xs md:max-w-md w-full rounded-xl px-3.5 py-1.5 text-xs bg-gray-50 border border-gray-200/80"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search topics, notes, or AI..."
              className="bg-transparent border-none outline-none text-xs text-gray-700 placeholder-gray-400 w-full"
            />
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-3">
          {/* Create Workspace Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
          >
            <span className="text-sm font-extrabold">+</span>
            <span className="hidden sm:inline">New Workspace</span>
          </button>

          {/* Wallet button */}
          <WalletButton variant="compact" labelConnect="🦊 Connect" className="hidden lg:inline-flex text-xs" />

          {/* User Button */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
            <UserButton
              appearance={{
                elements: { avatarBox: 'w-8 h-8 rounded-full' },
              }}
            />
          </div>
        </div>
      </header>

      {/* Global Workspace Modal */}
      <CreateWorkspaceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
