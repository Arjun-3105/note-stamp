import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

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
  const { data: doc, error } = await supabaseServer
    .from(TABLES.WORKSPACES)
    .insert({
      userId: data.userId,
      title: data.title,
      description: data.description || null,
      status: 'active',
      sourceCount: 0,
      completedUnits: 0,
      totalUnits: 0,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create workspace: ${error.message}`);
  return mapDoc<Workspace>(doc);
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.WORKSPACES)
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<Workspace>(data);
  } catch {
    return null;
  }
}

export async function listWorkspacesByUser(userId: string): Promise<Workspace[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.WORKSPACES)
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false });

  if (error || !data) return [];
  return mapDoc<Workspace[]>(data);
}

export async function updateWorkspace(
  workspaceId: string,
  data: Partial<Workspace>
): Promise<Workspace> {
  const { $id, ...updatePayload } = data;

  const { data: doc, error } = await supabaseServer
    .from(TABLES.WORKSPACES)
    .update({
      ...updatePayload,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update workspace: ${error.message}`);
  return mapDoc<Workspace>(doc);
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
