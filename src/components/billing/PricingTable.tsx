'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';

const features = [
  { name: 'Workspaces', free: '1', pro: 'Unlimited' },
  { name: 'AI Generations / mo', free: '20', pro: '1,000' },
  { name: 'Assistant Messages / mo', free: '50', pro: '2,500' },
  { name: 'Problem Uploads / mo', free: '5', pro: '200' },
  { name: 'NFT Badge Mints', free: '1', pro: '50' },
  { name: 'Advanced AI Models', free: false, pro: true },
  { name: 'Priority Support', free: false, pro: true },
];

export const PricingTable = ({ onUpgrade }: { onUpgrade: () => void }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    await onUpgrade();
    setIsLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl pt-8 pb-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="rounded-2xl border border-white/[0.05] bg-slate-900/50 p-8 backdrop-blur-md">
          <h3 className="text-xl font-display font-semibold text-slate-300">Free</h3>
          <div className="mt-4 flex items-baseline text-4xl font-extrabold text-white">
            ₹0
            <span className="ml-1 text-sm font-medium text-slate-500">/mo</span>
          </div>
          <p className="mt-4 text-sm text-slate-400">Perfect for exploring the platform and creating your first workspace.</p>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <CheckIcon active={f.free !== false} />
                <span>
                  {typeof f.free === 'boolean' ? f.name : <strong>{f.free}</strong>} {typeof f.free === 'boolean' ? '' : f.name.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
          <button
            disabled
            className="mt-8 w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-400 opacity-50 cursor-not-allowed"
          >
            Current Plan
          </button>
        </div>

        {/* Pro Plan */}
        <div className="relative rounded-2xl border border-primary-500/30 bg-primary-950/20 p-8 shadow-[0_0_40px_rgba(99,102,241,0.1)] backdrop-blur-md">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
            Recommended
          </div>
          <h3 className="text-xl font-display font-semibold text-primary-400">Pro</h3>
          <div className="mt-4 flex items-baseline text-4xl font-extrabold text-white">
            ₹499
            <span className="ml-1 text-sm font-medium text-slate-500">/mo</span>
          </div>
          <p className="mt-4 text-sm text-slate-400">Unlock unlimited workspaces and advanced AI capabilities for serious learners.</p>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <CheckIcon active={f.pro !== false} />
                <span>
                  {typeof f.pro === 'boolean' ? f.name : <strong>{f.pro}</strong>} {typeof f.pro === 'boolean' ? '' : f.name.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleUpgrade}
            disabled={isLoading}
            className="mt-8 w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition hover:bg-primary-600 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Upgrade to Pro'}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

const CheckIcon = ({ active }: { active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={`h-5 w-5 shrink-0 ${active ? 'text-primary-500' : 'text-slate-700'}`}
  >
    {active ? (
      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    )}
  </svg>
);
