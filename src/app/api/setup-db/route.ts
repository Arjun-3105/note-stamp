import { NextResponse } from 'next/server';
import { supabaseServer, TABLES } from '@/lib/supabase-server';

/**
 * GET /api/setup-db
 * Checks health & existence of all 12 Supabase database tables for LearnLoop.
 */
export async function GET() {
  const tableStatuses: Record<string, boolean> = {};

  for (const [key, tableName] of Object.entries(TABLES)) {
    try {
      const { error } = await supabaseServer
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      tableStatuses[tableName] = !error;
    } catch {
      tableStatuses[tableName] = false;
    }
  }

  const allReady = Object.values(tableStatuses).every(Boolean);

  return NextResponse.json({
    status: allReady ? 'healthy' : 'tables_missing',
    tables: tableStatuses,
    instructions: 'If any table is missing, execute scripts/setup-db.sql in your Supabase SQL Editor (https://supabase.com/dashboard).',
  });
}
