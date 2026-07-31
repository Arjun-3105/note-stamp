'use client';

/**
 * useWorkspace — fetches workspace data and its sources for a given workspaceId.
 * Re-exports data in a clean shape for workspace page components.
 */
import { useState, useEffect, useCallback } from 'react';

export interface WorkspaceData {
  $id: string;
  title: string;
  description?: string;
  status: 'active' | 'archived';
  sourceCount: number;
  completedUnits: number;
  totalUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceData {
  $id: string;
  title: string;
  sourceType: string;
  status: 'processing' | 'ready' | 'failed';
  url?: string;
  createdAt: string;
}

export interface UseWorkspaceReturn {
  workspace: WorkspaceData | null;
  sources: SourceData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useWorkspace(workspaceId: string | null): UseWorkspaceReturn {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [wsRes, srcRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}`),
        fetch(`/api/workspaces/${workspaceId}/sources`),
      ]);

      if (!wsRes.ok) throw new Error(`Failed to load workspace: ${wsRes.status}`);

      const wsData = await wsRes.json();
      setWorkspace(wsData);

      if (srcRes.ok) {
        const srcData = await srcRes.json();
        setSources(srcData.sources || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { workspace, sources, isLoading, error, refetch: fetchData };
}
