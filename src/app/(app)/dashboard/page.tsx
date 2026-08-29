'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { CreateWorkspaceModal } from '@/components/workspace/CreateWorkspaceModal';

interface WorkspaceSummary {
  $id: string;
  title: string;
  description?: string;
  sourceCount?: number;
  completedUnits?: number;
  totalUnits?: number;
  createdAt: string;
}

interface SourceSummary {
  $id: string;
  title: string;
  sourceType: string;
  workspaceId: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useUser();
  const firstName = user?.firstName || 'there';

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [recentSources, setRecentSources] = useState<SourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const wsRes = await fetch('/api/workspaces');
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          const list = wsData.workspaces || [];
          setWorkspaces(list);

          // Fetch recent sources across workspaces
          const sourceItems: SourceSummary[] = [];
          for (const ws of list.slice(0, 4)) {
            const sRes = await fetch(`/api/sources?workspaceId=${ws.$id}`);
            if (sRes.ok) {
              const sData = await sRes.json();
              const sources = sData.sources || [];
              for (const s of sources) {
                sourceItems.push({
                  $id: s.$id,
                  title: s.title || 'Untitled Source',
                  sourceType: s.type || s.sourceType || 'text',
                  workspaceId: ws.$id,
                  createdAt: s.createdAt || new Date().toISOString(),
                });
              }
            }
          }
          setRecentSources(sourceItems.slice(0, 6));
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const totalSources = workspaces.reduce((acc, ws) => acc + (ws.sourceCount || 0), 0);

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 sm:p-6 lg:p-10 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Welcome Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-md">
              <span>✨</span>
              <span>AI-Powered Study Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Welcome back, {firstName} 👋
            </h1>
            <p className="text-indigo-200 text-xs sm:text-sm leading-relaxed">
              Organize your courses, upload YouTube videos or PDFs, and master subjects with Anki flashcards and AI study modes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-white text-indigo-900 font-extrabold text-xs sm:text-sm hover:bg-indigo-50 transition-all shadow-md flex items-center gap-2"
            >
              <span className="text-lg font-black leading-none">+</span>
              <span>Create Workspace</span>
            </button>
            <Link
              href="/import"
              className="px-5 py-3 rounded-2xl bg-indigo-600/60 hover:bg-indigo-600 text-white font-bold text-xs sm:text-sm transition-all border border-indigo-400/30 backdrop-blur-md flex items-center gap-2"
            >
              <span>📥</span>
              <span>Import Material</span>
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Workspaces</span>
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-black text-indigo-600">{workspaces.length}</span>
            </div>
            <span className="text-[11px] text-gray-500">Active learning spaces</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sources Ingested</span>
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600">{recentSources.length || totalSources}</span>
            </div>
            <span className="text-[11px] text-gray-500">PDFs, Videos &amp; Docs</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Study Modes</span>
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-500">6</span>
            </div>
            <span className="text-[11px] text-gray-500">Flashcards, Quiz, Sandbox</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Achievements</span>
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-black text-purple-600">Proof</span>
            </div>
            <Link href="/passport" className="text-[11px] font-bold text-indigo-600 hover:underline">
              View NFT Badges →
            </Link>
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Your Learning Workspaces</h2>
              <p className="text-xs text-gray-500">Select a workspace to open your study materials</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
            >
              <span>+ New Workspace</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading workspaces...</div>
          ) : workspaces.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mx-auto">
                📂
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900">No Workspaces Created Yet</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Workspaces group your learning materials, videos, PDFs, and notes by subject.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2"
              >
                <span>+ Create Your First Workspace</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {workspaces.map((ws) => (
                <Link
                  key={ws.$id}
                  href={`/workspace/${ws.$id}`}
                  className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between space-y-4 group"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        📂
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        Active
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {ws.title}
                    </h3>

                    {ws.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {ws.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                    <span>{ws.sourceCount || 0} sources</span>
                    <span className="font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                      Open →
                    </span>
                  </div>
                </Link>
              ))}

              {/* Add New Workspace Card */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="rounded-2xl border-2 border-dashed border-gray-200 p-6 flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-center group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center font-black text-lg transition-colors">
                  +
                </div>
                <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600">
                  Create New Workspace
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Recent Sources & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Material */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-gray-900">Recent Materials</h3>
              <Link href="/notes" className="text-xs font-bold text-indigo-600 hover:underline">
                View All Notes →
              </Link>
            </div>

            {recentSources.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No recent material added yet.</p>
            ) : (
              <div className="space-y-2">
                {recentSources.map((source) => (
                  <Link
                    key={source.$id}
                    href={`/workspace/${source.workspaceId}/${source.$id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold uppercase">
                        {source.sourceType === 'youtube' ? '▶' : source.sourceType === 'pdf' ? '📄' : '📝'}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-gray-900 line-clamp-1">{source.title}</p>
                        <span className="text-[10px] text-gray-400 capitalize">{source.sourceType} source</span>
                      </div>
                    </div>
                    <span className="text-xs text-indigo-600 font-bold">Study ↗</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Launch AI Tools */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-gray-900">AI Study Engines</h3>
              <Link href="/ai-modes" className="text-xs font-bold text-indigo-600 hover:underline">
                Explore All →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/flashcards"
                className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 hover:border-amber-300 transition-all space-y-1"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-xl">🎴</span>
                <p className="text-xs font-bold text-amber-900">Flashcards</p>
                <p className="text-[10px] text-amber-700/80">Spaced recall</p>
              </Link>

              <Link
                href="/roadmap"
                className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 hover:border-indigo-300 transition-all space-y-1"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-xl">🗺️</span>
                <p className="text-xs font-bold text-indigo-900">Mind Maps</p>
                <p className="text-[10px] text-indigo-700/80">Visual graphs</p>
              </Link>

              <Link
                href="/ai-modes"
                className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 hover:border-emerald-300 transition-all space-y-1"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-xl">📝</span>
                <p className="text-xs font-bold text-emerald-900">AI Quizzes</p>
                <p className="text-[10px] text-emerald-700/80">Instant test</p>
              </Link>

              <Link
                href="/ai-modes"
                className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 hover:border-blue-300 transition-all space-y-1"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-xl">💻</span>
                <p className="text-xs font-bold text-blue-900">Code Sandbox</p>
                <p className="text-[10px] text-blue-700/80">Real trace</p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Global Workspace Modal */}
      <CreateWorkspaceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
