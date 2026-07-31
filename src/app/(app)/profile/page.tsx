'use client';
import React from 'react';
import { UserProfile } from '@clerk/nextjs';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full mb-8"
      >
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">Profile Settings</h1>
        <p className="mt-2 text-slate-400">Manage your personal information and security preferences.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full flex justify-center"
      >
        <div className="clerk-dark-theme-wrapper w-full max-w-4xl">
          <UserProfile 
            appearance={{
              variables: {
                colorBackground: '#0f172a', // slate-900
                colorInputBackground: '#1e293b', // slate-800
                colorText: '#f8fafc', // slate-50
                colorTextSecondary: '#94a3b8', // slate-400
                colorPrimary: '#6366f1', // indigo-500
                colorDanger: '#ef4444', // red-500
              },
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none w-full border border-white/[0.08] bg-slate-900/50 backdrop-blur-md rounded-2xl',
                navbar: 'hidden md:flex border-r border-white/[0.08]',
                headerTitle: 'font-display font-semibold text-xl',
                profileSectionTitleText: 'text-sm font-semibold uppercase tracking-wider',
              }
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
