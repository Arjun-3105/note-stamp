import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

export type SourceType = 'youtube' | 'pdf' | 'url' | 'text' | 'audio';
export type SourceStatus = 'processing' | 'ready' | 'failed';

export interface Source {
  $id: string;
  workspaceId: string;
  userId: string;
  sourceType: SourceType;
  title: string;
  url?: string;
  inputHash: string;
  rawTextPath?: string;
  metadata?: string;
  status: SourceStatus;
  createdAt: string;
}

export interface CreateSourceInput {
  workspaceId: string;
  userId: string;
  sourceType: SourceType;
  title: string;
  url?: string;
  inputHash: string;
  metadata?: Record<string, unknown>;
}

function mapSource(doc: any): Source {
  const mapped = mapDoc<any>(doc);
  if (!mapped) return mapped;
  return {
    ...mapped,
    sourceType: mapped.type,
  };
}

export async function createSource(data: CreateSourceInput): Promise<Source> {
  const { data: doc, error } = await supabaseServer
    .from(TABLES.SOURCES)
    .insert({
      workspaceId: data.workspaceId,
      userId: data.userId,
      type: data.sourceType,
      title: data.title,
      url: data.url || null,
      inputHash: data.inputHash,
      rawTextPath: null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      status: 'processing',
      createdAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create source: ${error.message}`);
  return mapSource(doc);
}

export async function getSource(sourceId: string): Promise<Source | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.SOURCES)
      .select('*')
      .eq('id', sourceId)
      .maybeSingle();

    if (error || !data) return null;
    return mapSource(data);
  } catch {
    return null;
  }
}

export async function listSourcesByWorkspace(workspaceId: string): Promise<Source[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.SOURCES)
    .select('*')
    .eq('workspaceId', workspaceId)
    .order('createdAt', { ascending: false });

  if (error || !data) return [];
  return data.map(mapSource);
}

export async function findSourceByInputHash(
  inputHash: string,
  userId: string
): Promise<Source | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.SOURCES)
      .select('*')
      .eq('inputHash', inputHash)
      .eq('userId', userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return mapSource(data);
  } catch {
    return null;
  }
}

export async function updateSourceStatus(
  sourceId: string,
  status: SourceStatus,
  rawTextPath?: string
): Promise<Source> {
  const updatePayload: Record<string, unknown> = { status };
  if (rawTextPath) updatePayload.rawTextPath = rawTextPath;

  const { data, error } = await supabaseServer
    .from(TABLES.SOURCES)
    .update(updatePayload)
    .eq('id', sourceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update source status: ${error.message}`);
  return mapSource(data);
}

export async function updateSourceMetadata(
  sourceId: string,
  metadataStr: string
): Promise<Source> {
  const { data, error } = await supabaseServer
    .from(TABLES.SOURCES)
    .update({ metadata: metadataStr })
    .eq('id', sourceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update source metadata: ${error.message}`);
  return mapSource(data);
}
