import { createClient } from '@supabase/supabase-js';

const rawUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const rawKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  '';

const isConfigured = Boolean(rawUrl && rawUrl !== 'https://your-supabase-project.supabase.co');

if (!isConfigured) {
  console.warn(
    '[Supabase] Warning: Real Supabase credentials not found in .env. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
}

const supabaseUrl = isConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseKey = isConfigured ? rawKey : 'placeholder-key';

export const supabaseServer = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export const TABLES = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  SOURCES: 'sources',
  NOTES: 'notes',
  FLASHCARD_SETS: 'flashcard_sets',
  QUIZ_ATTEMPTS: 'quiz_attempts',
  BADGES: 'badges',
  USAGE_LOG: 'usage_log',
  CHAT_SESSIONS: 'chat_sessions',
  SANDBOX_TRACES: 'sandbox_traces',
  MATH_ATTEMPTS: 'math_attempts',
  CONCEPT_MASTERY: 'concept_mastery',
} as const;

/**
 * Helper to map Supabase row object with `id` to `$id` for compatibility
 * with existing LearnLoop interfaces.
 */
export function mapDoc<T>(row: any): T {
  if (!row) return row;
  if (Array.isArray(row)) {
    return row.map(r => mapDoc(r)) as unknown as T;
  }
  const { id, ...rest } = row;
  return {
    ...rest,
    $id: id,
  } as unknown as T;
}
