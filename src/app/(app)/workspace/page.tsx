'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Workspace } from '@/lib/db/workspaces';
import { CreateWorkspaceModal } from '@/components/workspace/CreateWorkspaceModal';

export default function WorkspaceListPage() {
  const { userId } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : Promise.reject('Failed to load workspaces')))
      .then((d) => setWorkspaces(d.workspaces || []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 sm:p-6 lg:p-10 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="font-semibold text-gray-800">My Learning</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              My Learning Workspaces
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} total
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-sm shrink-0 gap-2"
          >
            <span className="text-lg leading-none">+</span>
            <span>New Workspace</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Loading your workspaces...
          </div>
        ) : workspaces.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-white p-8 space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mx-auto">
              📂
            </div>
            <div className="space-y-1">
              <p className="font-extrabold text-lg text-gray-900">No workspaces yet</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Create a workspace to organize your YouTube videos, PDFs, and notes by course or subject.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2"
            >
              <span>+ Create your first workspace</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((ws) => (
              <Link
                key={ws.$id}
                href={`/workspace/${ws.$id}`}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between space-y-4 group"
                style={{ textDecoration: 'none' }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      📂
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      {ws.status || 'Active'}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-lg group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {ws.title}
                  </h3>

                  {ws.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {ws.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>{ws.sourceCount || 0} material sources</span>
                  <span className="font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                    Open →
                  </span>
                </div>
              </Link>
            ))}

            {/* Create Card */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-2xl border-2 border-dashed border-gray-200 p-8 flex flex-col items-center justify-center gap-3 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-center group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center font-black text-xl transition-colors">
                +
              </div>
              <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600">
                Create New Workspace
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Global Modal */}
      <CreateWorkspaceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
