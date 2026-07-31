import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

export type SourceType = 'youtube' | 'pdf' | 'url' | 'text' | 'audio';
export type SourceStatus = 'processing' | 'ready' | 'failed';

// Note: sources use 'type' in Appwrite but we expose 'sourceType' for convenience
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

export async function createSource(data: CreateSourceInput): Promise<Source> {
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.SOURCES, ID.unique(), {
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
  }) as unknown as Source;
}

export async function getSource(sourceId: string): Promise<Source | null> {
  try {
    const doc = await serverDatabases.getDocument(DB_ID, COLLECTIONS.SOURCES, sourceId);
    return { ...doc, sourceType: (doc as any).type } as unknown as Source;
  } catch {
    return null;
  }
}

export async function listSourcesByWorkspace(workspaceId: string): Promise<Source[]> {
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.SOURCES, [
    Query.equal('workspaceId', workspaceId),
    Query.orderDesc('createdAt'),
  ]);
  return result.documents.map((d: any) => ({ ...d, sourceType: d.type })) as unknown as Source[];
}

export async function findSourceByInputHash(
  inputHash: string,
  userId: string
): Promise<Source | null> {
  try {
    const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.SOURCES, [
      Query.equal('inputHash', inputHash),
      Query.equal('userId', userId),
      Query.limit(1),
    ]);
    const doc = result.documents[0];
    return doc ? ({ ...doc, sourceType: (doc as any).type } as unknown as Source) : null;
  } catch {
    return null;
  }
}

export async function updateSourceStatus(
  sourceId: string,
  status: SourceStatus,
  rawTextPath?: string
): Promise<Source> {
  const data: Record<string, unknown> = { status };
  if (rawTextPath) data.rawTextPath = rawTextPath;
  const doc = await serverDatabases.updateDocument(DB_ID, COLLECTIONS.SOURCES, sourceId, data);
  return { ...doc, sourceType: (doc as any).type } as unknown as Source;
}

export async function updateSourceMetadata(
  sourceId: string,
  metadataStr: string
): Promise<Source> {
  const doc = await serverDatabases.updateDocument(DB_ID, COLLECTIONS.SOURCES, sourceId, { metadata: metadataStr });
  return { ...doc, sourceType: (doc as any).type } as unknown as Source;
}

