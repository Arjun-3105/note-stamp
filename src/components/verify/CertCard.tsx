'use client';
import React from 'react';
import { motion } from 'framer-motion';

export const CertCard = ({ 
  tokenId, 
  title, 
  skill, 
  score, 
  date 
}: { 
  tokenId: string; 
  title: string; 
  skill: string; 
  score: number; 
  date: string 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full max-w-md mx-auto overflow-hidden rounded-2xl bg-slate-900 border border-white/[0.1] shadow-2xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 via-transparent to-accent-500/20 pointer-events-none" />
      
      <div className="p-8 text-center relative z-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 border border-white/[0.05] shadow-inner mb-6">
          <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-primary-400">
            <path d="M12 15L8.5 11.5L9.91 10.09L12 12.17L17.59 6.58L19 8L12 15Z" fill="currentColor" />
            <path fillRule="evenodd" clipRule="evenodd" d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 22 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20Z" fill="currentColor" />
          </svg>
        </div>
        
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2">Verified Credential</h2>
        <h3 className="text-2xl font-display font-bold text-white mb-1">{title}</h3>
        <p className="text-slate-400 mb-8">{skill}</p>
        
        <div className="grid grid-cols-2 gap-4 text-left">
          <div className="rounded-xl bg-slate-950/50 p-4 border border-white/[0.05]">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Score</p>
            <p className="text-xl font-bold text-white">{score}%</p>
          </div>
          <div className="rounded-xl bg-slate-950/50 p-4 border border-white/[0.05]">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Date</p>
            <p className="text-sm font-medium text-white pt-1">{new Date(date).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.08]">
          <p className="text-[10px] font-mono text-slate-500 uppercase">Token ID</p>
          <p className="text-xs font-mono text-slate-400 mt-1 truncate">{tokenId}</p>
        </div>
      </div>
    </motion.div>
  );
};
