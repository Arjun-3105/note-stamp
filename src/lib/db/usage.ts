import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

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
    await supabaseServer
      .from(TABLES.USAGE_LOG)
      .insert({
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

  const { count, error } = await supabaseServer
    .from(TABLES.USAGE_LOG)
    .select('*', { count: 'exact', head: true })
    .eq('userId', userId)
    .gte('createdAt', startOfMonth.toISOString());

  if (error || count === null) return 0;
  return count;
}

export async function getMonthlyTokenUsage(
  userId: string
): Promise<{ inputTokens: number; outputTokens: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabaseServer
    .from(TABLES.USAGE_LOG)
    .select('inputTokens, outputTokens')
    .eq('userId', userId)
    .gte('createdAt', thirtyDaysAgo.toISOString())
    .limit(1000);

  if (error || !data) return { inputTokens: 0, outputTokens: 0 };
  return {
    inputTokens: data.reduce((sum, log) => sum + (log.inputTokens || 0), 0),
    outputTokens: data.reduce((sum, log) => sum + (log.outputTokens || 0), 0),
  };
}

export async function getCachedHitRate(userId: string): Promise<number> {
  const { data, error } = await supabaseServer
    .from(TABLES.USAGE_LOG)
    .select('cached')
    .eq('userId', userId)
    .order('createdAt', { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) return 0;

  const cached = data.filter(log => log.cached).length;
  return Math.round((cached / data.length) * 100);
}
