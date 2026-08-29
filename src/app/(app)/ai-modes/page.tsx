'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';

interface WorkspaceItem {
  $id: string;
  title: string;
  description?: string;
}

export default function AIModesPage() {
  const { userId } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function loadWorkspaces() {
      try {
        const res = await fetch('/api/workspaces');
        if (res.ok) {
          const data = await res.json();
          const list = data.workspaces || [];
          setWorkspaces(list);
          if (list.length > 0) {
            setSelectedWorkspace(list[0].$id);
          }
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
      } finally {
        setLoading(false);
      }
    }

    loadWorkspaces();
  }, [userId]);

  const modes = [
    {
      id: 'flashcards',
      title: 'Smart Flashcards',
      icon: '🎴',
      description: 'Anki-style active recall with source-grounded questions, chunk references, and confidence scoring.',
      badge: 'Spaced Repetition',
      actionUrl: selectedWorkspace ? `/workspace/${selectedWorkspace}` : '/workspace',
      color: 'from-amber-500/10 to-amber-500/5 border-amber-200 text-amber-900',
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'concept-map',
      title: 'Interactive Concept Map',
      icon: '🗺️',
      description: 'Visual DAG node relationships extracted directly from your study material.',
      badge: 'Visual Learning',
      actionUrl: selectedWorkspace ? `/workspace/${selectedWorkspace}` : '/workspace',
      color: 'from-indigo-500/10 to-indigo-500/5 border-indigo-200 text-indigo-900',
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'quiz',
      title: 'AI Quiz & Exam Generator',
      icon: '📝',
      description: 'Generate practice tests with instant grading, detailed explanations, and retry checkpoints.',
      badge: 'Evaluation',
      actionUrl: selectedWorkspace ? `/workspace/${selectedWorkspace}` : '/workspace',
      color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200 text-emerald-900',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'sandbox',
      title: 'Code Sandbox & Trace Solver',
      icon: '💻',
      description: 'Execute code snippets with real execution tracing, variable call stacks, and bug location.',
      badge: 'Practical Execution',
      actionUrl: selectedWorkspace ? `/workspace/${selectedWorkspace}` : '/workspace',
      color: 'from-blue-500/10 to-blue-500/5 border-blue-200 text-blue-900',
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'math',
      title: 'Math & Formula Solver',
      icon: '📐',
      description: 'Step-by-step LaTeX formula parsing, proof checks, and interactive calculation steps.',
      badge: 'STEM & Math',
      actionUrl: selectedWorkspace ? `/workspace/${selectedWorkspace}` : '/workspace',
      color: 'from-purple-500/10 to-purple-500/5 border-purple-200 text-purple-900',
      badgeColor: 'bg-purple-100 text-purple-800',
    },
    {
      id: 'voice',
      title: 'Voice AI Assistant',
      icon: '🎙️',
      description: 'Real-time conversational voice tutor that asks questions and corrects misunderstandings.',
      badge: 'Audio Interactivity',
      actionUrl: selectedWorkspace ? `/workspace/${selectedWorkspace}` : '/workspace',
      color: 'from-rose-500/10 to-rose-500/5 border-rose-200 text-rose-900',
      badgeColor: 'bg-rose-100 text-rose-800',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] p-6 lg:p-10 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="font-semibold text-gray-800">AI Modes</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              AI Learning Engines &amp; Modes
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Choose an AI study mode to analyze, test, and master your learning materials.
            </p>
          </div>

          {/* Workspace Selector */}
          {workspaces.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm shrink-0">
              <span className="text-xs font-semibold text-gray-500">Workspace:</span>
              <select
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer"
              >
                {workspaces.map((ws) => (
                  <option key={ws.$id} value={ws.$id}>
                    {ws.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Modes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modes.map((mode) => (
            <div
              key={mode.id}
              className={`bg-gradient-to-b ${mode.color} rounded-2xl border p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{mode.icon}</span>
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase ${mode.badgeColor}`}>
                    {mode.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900">{mode.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{mode.description}</p>
              </div>

              <div className="pt-4 border-t border-gray-200/50">
                <Link
                  href={mode.actionUrl}
                  className="inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs transition-all shadow-sm"
                >
                  Launch {mode.title} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
