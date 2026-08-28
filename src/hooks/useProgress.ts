'use client';
import { useCallback, useEffect, useState } from 'react';

export interface ProgressState {
  completedChunks: number[];
  completedPages: number[];
  completedTopics: string[];
  totalChunks?: number;
  totalPages?: number;
  totalTopics?: number;
  updatedAt?: string;
}

export function useProgress(sourceId: string, workspaceId: string) {
  const [progress, setProgress] = useState<ProgressState>({
    completedChunks: [],
    completedPages: [],
    completedTopics: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProgress = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/progress?sourceId=${encodeURIComponent(sourceId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.progress) {
          setProgress({
            completedChunks: data.progress.completedChunks || [],
            completedPages: data.progress.completedPages || [],
            completedTopics: data.progress.completedTopics || [],
            totalChunks: data.progress.totalChunks,
            totalPages: data.progress.totalPages,
            totalTopics: data.progress.totalTopics,
            updatedAt: data.progress.updatedAt,
          });
        }
      }
    } catch {}
    finally { setLoading(false); }
  }, [sourceId]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const save = useCallback(async (next: Partial<ProgressState>) => {
    const merged: ProgressState = { ...progress, ...next };
    // optimistic
    setProgress(merged);
    setSaving(true);
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          workspaceId,
          completedChunks: merged.completedChunks,
          completedPages: merged.completedPages,
          completedTopics: merged.completedTopics,
          totalChunks: merged.totalChunks,
          totalPages: merged.totalPages,
          totalTopics: merged.totalTopics,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.progress) {
          setProgress({
            completedChunks: data.progress.completedChunks || [],
            completedPages: data.progress.completedPages || [],
            completedTopics: data.progress.completedTopics || [],
            totalChunks: data.progress.totalChunks,
            totalPages: data.progress.totalPages,
            totalTopics: data.progress.totalTopics,
            updatedAt: data.progress.updatedAt,
          });
        }
      }
    } catch {}
    finally { setSaving(false); }
  }, [progress, sourceId, workspaceId]);

  const toggleChunk = useCallback((chunkIndex: number) => {
    const exists = progress.completedChunks.includes(chunkIndex);
    const next = exists ? progress.completedChunks.filter(c => c !== chunkIndex) : [...progress.completedChunks, chunkIndex];
    return save({ completedChunks: next });
  }, [progress.completedChunks, save]);

  const togglePage = useCallback((page: number) => {
    const exists = progress.completedPages.includes(page);
    const next = exists ? progress.completedPages.filter(p => p !== page) : [...progress.completedPages, page];
    return save({ completedPages: next });
  }, [progress.completedPages, save]);

  const toggleTopic = useCallback((topicId: string) => {
    const exists = progress.completedTopics.includes(topicId);
    const next = exists ? progress.completedTopics.filter(t => t !== topicId) : [...progress.completedTopics, topicId];
    return save({ completedTopics: next });
  }, [progress.completedTopics, save]);

  const setTotals = useCallback((totals: { totalChunks?: number; totalPages?: number; totalTopics?: number }) => {
    // only update if changed and not already set same value, avoid loop
    const needsUpdate =
      (totals.totalChunks !== undefined && totals.totalChunks !== progress.totalChunks) ||
      (totals.totalPages !== undefined && totals.totalPages !== progress.totalPages) ||
      (totals.totalTopics !== undefined && totals.totalTopics !== progress.totalTopics);
    if (!needsUpdate) return;
    return save({ ...totals });
  }, [progress.totalChunks, progress.totalPages, progress.totalTopics, save]);

  const stats = {
    chunksPct: progress.totalChunks ? Math.round((progress.completedChunks.length / progress.totalChunks) * 100) : 0,
    pagesPct: progress.totalPages ? Math.round((progress.completedPages.length / progress.totalPages) * 100) : 0,
    topicsPct: progress.totalTopics ? Math.round((progress.completedTopics.length / progress.totalTopics) * 100) : 0,
  };

  return {
    progress,
    loading,
    saving,
    toggleChunk,
    togglePage,
    toggleTopic,
    setTotals,
    save,
    stats,
    completedChunks: progress.completedChunks,
    completedPages: progress.completedPages,
    completedTopics: progress.completedTopics,
  };
}
