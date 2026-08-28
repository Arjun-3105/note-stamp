import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

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
  const { data: doc, error } = await supabaseServer
    .from(TABLES.BADGES)
    .insert({
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
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create badge: ${error.message}`);
  return mapDoc<Badge>(doc);
}

export async function getBadge(badgeId: string): Promise<Badge | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.BADGES)
      .select('*')
      .eq('id', badgeId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<Badge>(data);
  } catch {
    return null;
  }
}

export async function listBadgesByUser(userId: string, type?: BadgeType): Promise<Badge[]> {
  let query = supabaseServer
    .from(TABLES.BADGES)
    .select('*')
    .eq('userId', userId);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query.order('createdAt', { ascending: false });

  if (error || !data) return [];
  return mapDoc<Badge[]>(data);
}

export async function getBadgeByIdempotencyKey(idempotencyKey: string): Promise<Badge | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.BADGES)
      .select('*')
      .eq('idempotencyKey', idempotencyKey)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<Badge>(data);
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
  const { data, error } = await supabaseServer
    .from(TABLES.BADGES)
    .update({
      tokenId,
      txHash,
      ipfsHash,
      metadataUri,
      mintedAt: new Date().toISOString(),
    })
    .eq('id', badgeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update badge mint: ${error.message}`);
  return mapDoc<Badge>(data);
}

export function parseBadgeEvidenceIds(badge: Badge): string[] {
  try { return JSON.parse(badge.evidenceIds); } catch { return []; }
}

export function parseBadgeComponentIds(badge: Badge): string[] {
  try { return badge.componentBadgeIds ? JSON.parse(badge.componentBadgeIds) : []; }
  catch { return []; }
}
