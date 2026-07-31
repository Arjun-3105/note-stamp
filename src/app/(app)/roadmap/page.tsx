'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Workspace } from '@/lib/db/workspaces';

export default function RoadmapPage() {
  const { userId } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchWorkspaces = async () => {
      try {
        const response = await fetch('/api/workspaces');
        if (!response.ok) throw new Error('Failed to load workspaces');
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, [userId]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-600">Loading your learning roadmap...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-gray-900">Your Learning Roadmap</h1>
        <p className="mt-2 text-lg text-gray-600">
          Visual overview of your learning journey
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-600 mb-6">
          Error: {error}
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-600 mb-4">No workspaces yet</p>
          <Link
            href="/workspace/new"
            className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700"
          >
            Create Your First Workspace
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Learning Journey Timeline */}
          <div className="bg-white rounded-lg p-8 shadow">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Learning Journey</h2>
            <div className="space-y-8">
              {workspaces.map((workspace, idx) => (
                <div key={workspace.$id} className="relative">
                  {/* Timeline line */}
                  {idx < workspaces.length - 1 && (
                    <div className="absolute left-5 top-12 w-1 h-12 bg-gradient-to-b from-blue-500 to-gray-300" />
                  )}

                  {/* Timeline node */}
                  <div className="flex gap-6">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-8">
                      <Link
                        href={`/workspace/${workspace.$id}`}
                        className="block hover:opacity-80 transition-opacity"
                      >
                        <h3 className="text-xl font-bold text-gray-900">{workspace.title}</h3>
                        {workspace.description && (
                          <p className="text-gray-600 mt-1">{workspace.description}</p>
                        )}
                      </Link>

                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">
                            {workspace.completedUnits}/{workspace.totalUnits} units completed
                          </span>
                          <span className="text-sm font-medium text-blue-600">
                            {Math.round(
                              (workspace.completedUnits / (workspace.totalUnits || 1)) * 100
                            )}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                            style={{
                              width: `${
                                (workspace.completedUnits /
                                  (workspace.totalUnits || 1)) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded p-3 text-center">
                          <p className="text-2xl font-bold text-gray-900">
                            {workspace.sourceCount}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Sources</p>
                        </div>
                        <div className="bg-gray-50 rounded p-3 text-center">
                          <p className="text-2xl font-bold text-gray-900">
                            {workspace.completedUnits}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Completed</p>
                        </div>
                        <div className="bg-gray-50 rounded p-3 text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {Math.floor(
                              Math.random() * 100
                            )}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Score</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <StatsCard
              icon="📚"
              title="Total Workspaces"
              value={workspaces.length}
            />
            <StatsCard
              icon="📖"
              title="Total Sources"
              value={workspaces.reduce((sum, ws) => sum + ws.sourceCount, 0)}
            />
            <StatsCard
              icon="✅"
              title="Units Completed"
              value={workspaces.reduce((sum, ws) => sum + ws.completedUnits, 0)}
            />
            <StatsCard
              icon="🎯"
              title="Overall Progress"
              value={Math.round(
                (workspaces.reduce((sum, ws) => sum + ws.completedUnits, 0) /
                  Math.max(
                    1,
                    workspaces.reduce((sum, ws) => sum + ws.totalUnits, 0)
                  )) *
                  100
              )}
              unit="%"
            />
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-12 rounded-lg bg-indigo-50 border border-indigo-200 p-6">
        <h3 className="font-bold text-indigo-900 mb-4">Learning Tips</h3>
        <ul className="space-y-2 text-indigo-800 text-sm">
          <li>✨ Complete all sources in a workspace to earn a Skill Badge</li>
          <li>🎯 Focus on one workspace at a time for better retention</li>
          <li>📝 Take detailed notes to reinforce learning</li>
          <li>🧠 Use active recall with flashcards and quizzes</li>
          <li>🏆 Build your learning passport with badges and certificates</li>
        </ul>
      </div>
    </div>
  );
}

function StatsCard({
  icon,
  title,
  value,
  unit = '',
}: {
  icon: string;
  title: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-gray-600 text-sm">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">
        {value}
        {unit}
      </p>
    </div>
  );
}

