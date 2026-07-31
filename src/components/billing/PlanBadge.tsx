import React from 'react';
import { Plan } from '@/types';
import { motion } from 'framer-motion';

export const PlanBadge = ({ plan }: { plan: Plan }) => {
  const isPro = plan === 'pro';

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        isPro
          ? 'bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/30'
          : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700'
      }`}
    >
      {isPro && (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-primary-500">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
      {plan} Plan
    </motion.div>
  );
};
