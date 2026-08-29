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

          const sourceItems: SourceSummary[] = [];
          for (const ws of list.slice(0, 5)) {
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
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-bold backdrop-blur-md">
              <span>✨</span>
              <span>AI Study &amp; Active Recall Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Welcome back, {firstName} 👋
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm leading-relaxed font-normal">
              Manage your learning workspaces, process YouTube videos &amp; PDFs, and master subjects with AI flashcards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-white text-indigo-900 font-extrabold text-xs sm:text-sm hover:bg-indigo-50 transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span className="text-lg font-black leading-none">+</span>
              <span>Create Workspace</span>
            </button>
            <Link
              href="/import"
              className="px-5 py-3 rounded-2xl bg-indigo-600/70 hover:bg-indigo-600 text-white font-bold text-xs sm:text-sm transition-all border border-indigo-400/40 backdrop-blur-md flex items-center gap-2"
              style={{ textDecoration: 'none' }}
            >
              <span>📥</span>
              <span>Import Material</span>
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">WORKSPACES</span>
            <div className="my-2">
              <span className="text-3xl font-black text-indigo-600">{workspaces.length}</span>
            </div>
            <span className="text-xs font-medium text-slate-600">Active learning spaces</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">SOURCES INGESTED</span>
            <div className="my-2">
              <span className="text-3xl font-black text-emerald-600">{recentSources.length || totalSources}</span>
            </div>
            <span className="text-xs font-medium text-slate-600">PDFs, Videos &amp; Docs</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">STUDY MODES</span>
            <div className="my-2">
              <span className="text-3xl font-black text-amber-500">6</span>
            </div>
            <span className="text-xs font-medium text-slate-600">Flashcards, Quiz, Sandbox</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">ACHIEVEMENTS</span>
            <div className="my-2">
              <span className="text-3xl font-black text-purple-600">Proof</span>
            </div>
            <Link href="/passport" className="text-xs font-bold text-indigo-600 hover:underline" style={{ textDecoration: 'none' }}>
              View NFT Badges →
            </Link>
          </div>
        </div>

        {/* Workspaces List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Your Learning Workspaces</h2>
              <p className="text-xs font-medium text-slate-600 mt-0.5">Select a workspace to open your study materials</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>+ New Workspace</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm font-medium">Loading workspaces...</div>
          ) : workspaces.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mx-auto">
                📂
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900">No Workspaces Created Yet</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Workspaces group your learning materials, YouTube videos, PDFs, and notes by subject.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
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
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4 group"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base shadow-xs">
                        📁
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ACTIVE
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {ws.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
                      {ws.description || 'Auto-generated workspace from import'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>{ws.sourceCount || 0} sources</span>
                    <span className="text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                      Open →
                    </span>
                  </div>
                </Link>
              ))}

              {/* Add New Workspace Card */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="rounded-2xl border-2 border-dashed border-slate-300 p-6 flex flex-col items-center justify-center gap-2.5 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all text-center group cursor-pointer bg-white"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center font-black text-lg transition-colors">
                  +
                </div>
                <span className="text-xs font-extrabold text-slate-800 group-hover:text-indigo-600">
                  Create New Workspace
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity & AI Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Material */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">Recent Materials</h3>
              <Link href="/notes" className="text-xs font-bold text-indigo-600 hover:underline" style={{ textDecoration: 'none' }}>
                View All Notes →
              </Link>
            </div>

            {recentSources.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No recent material added yet.</p>
            ) : (
              <div className="space-y-2">
                {recentSources.map((source) => (
                  <Link
                    key={source.$id}
                    href={`/workspace/${source.workspaceId}/${source.$id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold">
                        {source.sourceType === 'youtube' ? '▶' : source.sourceType === 'pdf' ? '📄' : '📝'}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{source.title}</p>
                        <span className="text-[10px] text-slate-500 capitalize">{source.sourceType} source</span>
                      </div>
                    </div>
                    <span className="text-xs text-indigo-600 font-bold">Study ↗</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Launch AI Tools */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">AI Study Engines</h3>
              <Link href="/ai-modes" className="text-xs font-bold text-indigo-600 hover:underline" style={{ textDecoration: 'none' }}>
                Explore All →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/flashcards"
                className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 hover:border-amber-300 transition-all space-y-1"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-xl">🎴</span>
                <p className="text-xs font-extrabold text-amber-900">Flashcards</p>
                <p className="text-[10px] text-amber-700 font-medium">Spaced recall</p>
              </Link>

              <Link
                href="/roadmap"
                className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 hover:border-indigo-300 transition-all space-y-1"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-xl">🗺️</span>
                <p className="text-xs font-extrabold text-indigo-900">Mind Maps</p>
                <p className="text-[10px] text-indigo-700 font-medium">Visual graphs</p>
              </Link>

              <Link
                href="/ai-modes"
                className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 hover:border-emerald-300 transition-all space-y-1"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-xl">📝</span>
                <p className="text-xs font-extrabold text-emerald-900">AI Quizzes</p>
                <p className="text-[10px] text-emerald-700 font-medium">Instant test</p>
              </Link>

              <Link
                href="/ai-modes"
                className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/80 hover:border-blue-300 transition-all space-y-1"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-xl">💻</span>
                <p className="text-xs font-extrabold text-blue-900">Code Sandbox</p>
                <p className="text-[10px] text-blue-700 font-medium">Real trace</p>
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
