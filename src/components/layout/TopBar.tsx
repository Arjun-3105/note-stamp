'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';
import { WalletButton } from '@/components/wallet/WalletButton';

export function TopBar() {
  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-6 border-b"
      style={{ background: '#fff', borderColor: '#f0f0f5' }}
    >
      {/* Search */}
      <div
        className="flex items-center gap-2 flex-1 max-w-md rounded-xl px-4 py-2 text-sm"
        style={{ background: '#f5f5f8', border: '1px solid #ebebf0' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span style={{ color: '#aaa', fontSize: 13 }}>Search topics, notes, or ask AI…</span>
        <span
          className="ml-auto text-[11px] px-1.5 py-0.5 rounded-md"
          style={{ background: '#e8e8f0', color: '#888', fontFamily: 'monospace' }}
        >⌘K</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 ml-4">
        <WalletButton variant="compact" labelConnect="🦊 Connect" className="hidden sm:inline-flex" />
        {/* Notification bell */}
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
          style={{ border: '1px solid #f0f0f5' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* User */}
        <div className="flex items-center gap-2">
          <UserButton
            appearance={{
              elements: { avatarBox: 'w-8 h-8 rounded-full' },
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Arjun</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </header>
  );
}
