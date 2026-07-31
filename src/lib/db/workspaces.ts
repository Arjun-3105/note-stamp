import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

export interface Workspace {
  $id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'active' | 'archived';
  sourceCount: number;
  completedUnits: number;
  totalUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  userId: string;
  title: string;
  description?: string;
}

export async function createWorkspace(data: CreateWorkspaceInput): Promise<Workspace> {
  const now = new Date().toISOString();
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.WORKSPACES, ID.unique(), {
    userId: data.userId,
    title: data.title,
    description: data.description || null,
    status: 'active',
    sourceCount: 0,
    completedUnits: 0,
    totalUnits: 0,
    createdAt: now,
    updatedAt: now,
  }) as unknown as Workspace;
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  try {
    return await serverDatabases.getDocument(
      DB_ID,
      COLLECTIONS.WORKSPACES,
      workspaceId
    ) as unknown as Workspace;
  } catch {
    return null;
  }
}

export async function listWorkspacesByUser(userId: string): Promise<Workspace[]> {
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.WORKSPACES, [
    Query.equal('userId', userId),
    Query.orderDesc('createdAt'),
  ]);
  return result.documents as unknown as Workspace[];
}

export async function updateWorkspace(
  workspaceId: string,
  data: Partial<Workspace>
): Promise<Workspace> {
  return serverDatabases.updateDocument(DB_ID, COLLECTIONS.WORKSPACES, workspaceId, {
    ...data,
    updatedAt: new Date().toISOString(),
  }) as unknown as Workspace;
}

export async function updateWorkspaceSourceCount(
  workspaceId: string,
  delta: number
): Promise<Workspace> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error('Workspace not found');
  return updateWorkspace(workspaceId, {
    sourceCount: Math.max(0, workspace.sourceCount + delta),
  });
}

export async function updateWorkspaceProgress(
  workspaceId: string,
  completedUnits: number,
  totalUnits: number
): Promise<Workspace> {
  return updateWorkspace(workspaceId, { completedUnits, totalUnits });
}

export async function archiveWorkspace(workspaceId: string): Promise<Workspace> {
  return updateWorkspace(workspaceId, { status: 'archived' });
}

