import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

export interface UsageLog {
  $id: string;
  userId: string;
  route: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cached: boolean;
  durationMs?: number;
  createdAt: string;
}

export interface CreateUsageLogInput {
  userId: string;
  route: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cached?: boolean;
  durationMs?: number;
}

export async function logUsage(data: CreateUsageLogInput): Promise<void> {
  // Fire-and-forget usage logging — callers should not await this
  try {
    await serverDatabases.createDocument(DB_ID, COLLECTIONS.USAGE_LOG, ID.unique(), {
      userId: data.userId,
      route: data.route,
      model: data.model || null,
      inputTokens: data.inputTokens || 0,
      outputTokens: data.outputTokens || 0,
      cached: data.cached || false,
      durationMs: data.durationMs || 0,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[usage] Failed to log usage:', err);
  }
}

export async function getMonthlyAICallCount(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.USAGE_LOG, [
    Query.equal('userId', userId),
    Query.greaterThanEqual('createdAt', startOfMonth.toISOString()),
    Query.limit(1000),
  ]);

  return result.total;
}

export async function getMonthlyTokenUsage(
  userId: string
): Promise<{ inputTokens: number; outputTokens: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.USAGE_LOG, [
    Query.equal('userId', userId),
    Query.greaterThanEqual('createdAt', thirtyDaysAgo.toISOString()),
    Query.limit(1000),
  ]);

  const logs = result.documents as unknown as UsageLog[];
  return {
    inputTokens: logs.reduce((sum, log) => sum + (log.inputTokens || 0), 0),
    outputTokens: logs.reduce((sum, log) => sum + (log.outputTokens || 0), 0),
  };
}

export async function getCachedHitRate(userId: string): Promise<number> {
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.USAGE_LOG, [
    Query.equal('userId', userId),
    Query.orderDesc('createdAt'),
    Query.limit(100),
  ]);

  const logs = result.documents as unknown as UsageLog[];
  if (logs.length === 0) return 0;

  const cached = logs.filter(log => log.cached).length;
  return Math.round((cached / logs.length) * 100);
}
