'use client';
import React from 'react';
import { motion } from 'framer-motion';

export const RoadmapNode = ({ 
  title, 
  status, 
  onClick 
}: { 
  title: string; 
  status: 'locked' | 'active' | 'done';
  onClick?: () => void;
}) => {
  const isActive = status === 'active';
  const isDone = status === 'done';
  const isLocked = status === 'locked';

  return (
    <motion.button
      whileHover={!isLocked ? { scale: 1.05 } : {}}
      whileTap={!isLocked ? { scale: 0.95 } : {}}
      onClick={isLocked ? undefined : onClick}
      className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl w-40 transition-all ${
        isDone ? 'bg-primary-500/10 border border-primary-500/30 cursor-pointer hover:bg-primary-500/20' :
        isActive ? 'bg-slate-800 border border-white/[0.1] shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer hover:bg-slate-700' :
        'bg-slate-900/50 border border-white/[0.03] opacity-50 cursor-not-allowed'
      }`}
    >
      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
        isDone ? 'bg-primary-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' :
        isActive ? 'bg-white text-slate-900' :
        'bg-slate-800 text-slate-600'
      }`}>
        {isDone ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : isLocked ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <p className={`text-sm font-semibold text-center ${
        isDone ? 'text-primary-400' :
        isActive ? 'text-white' :
        'text-slate-500'
      }`}>
        {title}
      </p>
    </motion.button>
  );
};

export const RoadmapView = ({ nodes }: { nodes: { title: string; status: 'locked' | 'active' | 'done' }[] }) => {
  return (
    <div className="relative py-12 flex flex-col items-center">
      <div className="absolute top-0 bottom-0 w-1 bg-slate-800/50 left-1/2 -translate-x-1/2 z-0" />
      <div className="flex flex-col gap-12 relative z-10">
        {nodes.map((node, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`flex justify-${i % 2 === 0 ? 'start' : 'end'} w-[350px] relative`}
          >
            <div className={`absolute top-1/2 -translate-y-1/2 w-8 h-[2px] bg-slate-700 ${i % 2 === 0 ? 'right-0 translate-x-full' : 'left-0 -translate-x-full'}`} />
            <RoadmapNode title={node.title} status={node.status} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
