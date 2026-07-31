/**
 * Rate limiting using Upstash Redis.
 * If Upstash env vars are not set, falls back gracefully (no-op — useful for local dev).
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
}

// 20 requests per minute per user for AI assistant routes
const _assistantLimiter = new Map<string, Ratelimit>();
function getAssistantLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_assistantLimiter.has('default')) {
    _assistantLimiter.set(
      'default',
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        prefix: 'rl:assistant',
        analytics: true,
      })
    );
  }
  return _assistantLimiter.get('default')!;
}

// 60 requests per minute per user for general AI routes (flashcards, quiz, etc.)
const _aiLimiter = new Map<string, Ratelimit>();
function getAILimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_aiLimiter.has('default')) {
    _aiLimiter.set(
      'default',
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '1 m'),
        prefix: 'rl:ai',
        analytics: true,
      })
    );
  }
  return _aiLimiter.get('default')!;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

export async function checkAssistantRateLimit(userId: string): Promise<RateLimitResult> {
  const limiter = getAssistantLimiter();
  if (!limiter) return { success: true, remaining: 999, reset: 0, limit: 999 };
  const result = await limiter.limit(userId);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
    limit: result.limit,
  };
}

export async function checkAIRateLimit(userId: string): Promise<RateLimitResult> {
  const limiter = getAILimiter();
  if (!limiter) return { success: true, remaining: 999, reset: 0, limit: 999 };
  const result = await limiter.limit(userId);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
    limit: result.limit,
  };
}

