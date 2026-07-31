import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

export type BadgeType = 'micro' | 'skill' | 'master';

export interface Badge {
  $id: string;
  userId: string;
  type: BadgeType;
  title: string;
  skill: string;
  sourceId?: string;
  workspaceId?: string;
  evidenceIds: string;       // JSON stringified string[]
  componentBadgeIds?: string; // JSON stringified string[]
  score: number;
  tokenId?: string;
  txHash?: string;
  ipfsHash?: string;
  metadataUri?: string;
  mintedAt?: string;
  createdAt: string;
  idempotencyKey: string;
}

export interface CreateBadgeInput {
  userId: string;
  type: BadgeType;
  title: string;
  skill: string;
  sourceId?: string;
  workspaceId?: string;
  evidenceIds: string[];
  componentBadgeIds?: string[];
  score: number;
  idempotencyKey: string;
}

export async function createBadge(data: CreateBadgeInput): Promise<Badge> {
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.BADGES, ID.unique(), {
    userId: data.userId,
    type: data.type,
    title: data.title,
    skill: data.skill,
    sourceId: data.sourceId || null,
    workspaceId: data.workspaceId || null,
    evidenceIds: JSON.stringify(data.evidenceIds),
    componentBadgeIds: data.componentBadgeIds ? JSON.stringify(data.componentBadgeIds) : null,
    score: data.score,
    tokenId: null,
    txHash: null,
    ipfsHash: null,
    metadataUri: null,
    mintedAt: null,
    createdAt: new Date().toISOString(),
    idempotencyKey: data.idempotencyKey,
  }) as unknown as Badge;
}

export async function getBadge(badgeId: string): Promise<Badge | null> {
  try {
    return await serverDatabases.getDocument(DB_ID, COLLECTIONS.BADGES, badgeId) as unknown as Badge;
  } catch {
    return null;
  }
}

export async function listBadgesByUser(userId: string, type?: BadgeType): Promise<Badge[]> {
  const queries = [Query.equal('userId', userId), Query.orderDesc('$createdAt')];
  if (type) queries.push(Query.equal('type', type));
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.BADGES, queries);
  return result.documents as unknown as Badge[];
}

export async function getBadgeByIdempotencyKey(idempotencyKey: string): Promise<Badge | null> {
  try {
    const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.BADGES, [
      Query.equal('idempotencyKey', idempotencyKey),
      Query.limit(1),
    ]);
    return (result.documents[0] as unknown as Badge) || null;
  } catch {
    return null;
  }
}

export async function updateBadgeMint(
  badgeId: string,
  tokenId: string,
  txHash: string,
  ipfsHash: string,
  metadataUri: string
): Promise<Badge> {
  return serverDatabases.updateDocument(DB_ID, COLLECTIONS.BADGES, badgeId, {
    tokenId,
    txHash,
    ipfsHash,
    metadataUri,
    mintedAt: new Date().toISOString(),
  }) as unknown as Badge;
}

export function parseBadgeEvidenceIds(badge: Badge): string[] {
  try { return JSON.parse(badge.evidenceIds); } catch { return []; }
}

export function parseBadgeComponentIds(badge: Badge): string[] {
  try { return badge.componentBadgeIds ? JSON.parse(badge.componentBadgeIds) : []; }
  catch { return []; }
}

