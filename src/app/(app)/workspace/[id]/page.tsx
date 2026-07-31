'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Workspace } from '@/lib/db/workspaces';
import { Source } from '@/lib/db/sources';

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { userId } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchWorkspace = async () => {
      try {
        // Fetch workspace
        const wsRes = await fetch(`/api/workspaces/${id}`);
        if (!wsRes.ok) throw new Error('Failed to load workspace');
        const wsData = await wsRes.json();
        setWorkspace(wsData);

        // Fetch sources in workspace
        const srcRes = await fetch(`/api/workspaces/${id}/sources`);
        if (srcRes.ok) {
          const srcData = await srcRes.json();
          setSources(srcData.sources || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [userId, id]);

  if (loading) {
    return (
      <div className="p-8 bg-[#0F1115] min-h-screen text-[#A2A8B5]">
        <p className="text-sm font-medium">Loading workspace...</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="p-8 bg-[#0F1115] min-h-screen">
        <div className="rounded-[20px] bg-[#FF6A6A]/10 border border-[#FF6A6A]/20 p-4 text-[#FF6A6A] font-semibold mb-6">
          Error: {error || 'Workspace not found'}
        </div>
        <Link href="/workspace" className="text-[#7C5CFF] font-bold hover:underline">
          ← Back to Workspaces
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#0F1115] min-h-screen text-[#F5F6F8]" style={{ fontFamily: "Geist, 'Inter', sans-serif" }}>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link href="/workspace" className="text-[#7C5CFF] hover:underline text-sm font-bold mb-4 inline-block">
            ← Back to Workspaces
          </Link>
          <h1 className="text-3xl font-bold text-[#F5F6F8]">{workspace.title}</h1>
          {workspace.description && (
            <p className="mt-2 text-[#A2A8B5]">{workspace.description}</p>
          )}
          <div className="mt-4 flex gap-4 text-sm text-[#A2A8B5]">
            <span>📚 {workspace.sourceCount} sources</span>
            <span>✓ {workspace.completedUnits}/{workspace.totalUnits} units completed</span>
          </div>
        </div>
        <Link
          href={`/import?workspace=${id}`}
          className="rounded-[14px] bg-[#7C5CFF] px-5 py-2.5 text-white font-bold hover:bg-[#7C5CFF]/90 transition-colors shadow-sm"
        >
          Add Source
        </Link>
      </div>

      {/* Sources Grid */}
      {sources.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-[#252B36] bg-[#151922] p-12 text-center">
          <p className="text-[#A2A8B5] mb-4 font-medium">No sources added yet</p>
          <Link
            href={`/import?workspace=${id}`}
            className="inline-block rounded-[14px] bg-[#7C5CFF] px-6 py-2.5 text-white font-bold hover:bg-[#7C5CFF]/90 transition-colors shadow-sm"
          >
            Add Your First Source
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sources.map(source => (
            <Link
              key={source.$id}
              href={`/learn/${id}/${source.$id}`}
              className="rounded-[20px] border border-[#252B36] bg-[#151922] p-6 hover:border-[#7C5CFF]/50 transition-all hover:-translate-y-0.5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">
                  {source.sourceType === 'youtube' && '📹'}
                  {source.sourceType === 'pdf' && '📄'}
                  {source.sourceType === 'url' && '🔗'}
                  {source.sourceType === 'text' && '📝'}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#F5F6F8] line-clamp-2">{source.title}</h3>
                  <p className="text-xs text-[#A2A8B5] mt-1 capitalize font-medium">{source.sourceType}</p>
                  <p className="text-xs text-[#A2A8B5] mt-2 font-medium">
                    Status: <span className={
                      source.status === 'ready' ? 'text-[#42C67A] font-bold' :
                      source.status === 'processing' ? 'text-[#7C5CFF] font-bold' :
                      'text-[#FF6A6A] font-bold'
                    }>{source.status}</span>
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
