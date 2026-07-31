'use client';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PricingTable } from './PricingTable';

export const UpgradeModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleUpgrade = async () => {
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to checkout:', err);
    }
  };

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 overflow-y-auto pointer-events-none flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
              className="w-full max-w-4xl rounded-2xl bg-slate-900 border border-white/[0.08] shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-full"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
                <h2 className="text-xl font-display font-semibold text-white">Upgrade Your Plan</h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto px-6 max-h-[80vh]">
                <PricingTable onUpgrade={handleUpgrade} />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
