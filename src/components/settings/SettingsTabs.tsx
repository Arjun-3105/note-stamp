'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SettingsTabs() {
  const pathname = usePathname();

  const tabs = [
    { href: '/settings/keys', label: 'AI & API Keys', icon: '🔑' },
    { href: '/settings/billing', label: 'Billing & Plans', icon: '💳' },
  ];

  return (
    <div className="flex items-center gap-2 mb-6 border-b border-[#e2e8f0] pb-2">
      {tabs.map(tab => {
        const isActive = pathname === tab.href || (tab.href === '/settings/keys' && pathname === '/settings');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isActive
                ? 'bg-[#6c63ff] text-white shadow-sm'
                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
            }`}
            style={{ textDecoration: 'none' }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
