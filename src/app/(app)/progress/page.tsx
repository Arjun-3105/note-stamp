'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { Workspace } from '@/lib/db/workspaces';

interface ProgressData {
  completedChunks: number;
  totalChunks: number;
  completedPages: number;
  totalPages: number;
  completedTopics: number;
  totalTopics: number;
  completionRate: number;
  sourcesCount: number;
}

export default function ProgressPage() {
  const { userId } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [overallStats, setOverallStats] = useState<ProgressData>({
    completedChunks: 0,
    totalChunks: 0,
    completedPages: 0,
    totalPages: 0,
    completedTopics: 0,
    totalTopics: 0,
    completionRate: 0,
    sourcesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function loadProgressData() {
      try {
        const [wsRes, progRes] = await Promise.all([
          fetch('/api/workspaces'),
          fetch('/api/progress'),
        ]);

        if (wsRes.ok) {
          const wsData = await wsRes.json();
          setWorkspaces(wsData.workspaces || []);
        }

        if (progRes.ok) {
          const progData = await progRes.json();
          const stats = progData.stats || progData;
          setOverallStats({
            completedChunks: stats.doneChunks || 0,
            totalChunks: stats.totalChunks || 0,
            completedPages: stats.donePages || 0,
            totalPages: stats.totalPages || 0,
            completedTopics: stats.doneTopics || 0,
            totalTopics: stats.totalTopics || 0,
            completionRate: stats.totalChunks > 0 ? Math.round((stats.doneChunks / stats.totalChunks) * 100) : 0,
            sourcesCount: progData.sourcesCount || 0,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load progress data');
      } finally {
        setLoading(false);
      }
    }

    loadProgressData();
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#fafafa] p-6 lg:p-10 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="font-semibold text-gray-800">Progress</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Learning Progress &amp; Analytics
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Track your topic completions, study milestones, and workspace retention.
            </p>
          </div>
          <Link
            href="/workspace"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm shrink-0"
          >
            Go to My Workspaces →
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <span>Overall Completion</span>
              <span className="text-lg">🎯</span>
            </div>
            <div className="my-3">
              <span className="text-3xl font-black text-indigo-600">{overallStats.completionRate}%</span>
              <span className="text-xs text-gray-500 ml-2">completed</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, overallStats.completionRate))}%` }}
              />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <span>Chunks Mastered</span>
              <span className="text-lg">📚</span>
            </div>
            <div className="my-3">
              <span className="text-3xl font-black text-gray-900">{overallStats.completedChunks}</span>
              <span className="text-xs text-gray-500 ml-1">/ {overallStats.totalChunks || overallStats.completedChunks} chunks</span>
            </div>
            <p className="text-xs text-gray-500">Atomic learning chunks processed</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <span>Topics &amp; Concepts</span>
              <span className="text-lg">💡</span>
            </div>
            <div className="my-3">
              <span className="text-3xl font-black text-emerald-600">{overallStats.completedTopics}</span>
              <span className="text-xs text-gray-500 ml-1">topics finished</span>
            </div>
            <p className="text-xs text-gray-500">Mastery checkpoint verified</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <span>Active Workspaces</span>
              <span className="text-lg">📂</span>
            </div>
            <div className="my-3">
              <span className="text-3xl font-black text-purple-600">{workspaces.length}</span>
              <span className="text-xs text-gray-500 ml-1">subjects enrolled</span>
            </div>
            <p className="text-xs text-gray-500">Multi-source knowledge bases</p>
          </div>
        </div>

        {/* Workspaces Progress Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Workspace Progress Breakdown</h2>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {workspaces.length} Workspaces
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              Loading progress breakdown...
            </div>
          ) : workspaces.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl space-y-3">
              <span className="text-4xl block">📖</span>
              <p className="text-gray-700 font-semibold text-base">No active workspaces found</p>
              <p className="text-gray-500 text-xs max-w-sm mx-auto">
                Create a workspace and upload a PDF or YouTube video to start tracking your learning progress.
              </p>
              <Link
                href="/import"
                className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
              >
                + Import New Source
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workspaces.map((ws) => (
                <div
                  key={ws.$id}
                  className="p-5 rounded-xl border border-gray-100 bg-gray-50/50 hover:border-indigo-200 hover:bg-white transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-base truncate max-w-[240px]">
                      {ws.title}
                    </h3>
                    <Link
                      href={`/workspace/${ws.$id}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Open →
                    </Link>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{ws.description}</p>
                  )}
                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-600">
                    <span>Created: {new Date(ws.createdAt).toLocaleDateString()}</span>
                    <span className="font-semibold text-emerald-600">Active</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
