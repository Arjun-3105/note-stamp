import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

export interface TraceFrame {
  line: number;
  event: 'call' | 'return' | 'line' | 'exception';
  variables: Record<string, string>;
  callStack: string[];
  returnValue?: string;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
}

export interface SandboxTrace {
  $id: string;
  submissionId: string;
  userId: string;
  sourceId?: string;
  code: string;
  frames: string;      // JSON stringified TraceFrame[]
  testResults?: string; // JSON stringified TestResult[]
  stdout: string;
  stderr?: string;
  createdAt: string;
}

export interface CreateTraceInput {
  submissionId: string;
  userId: string;
  sourceId?: string;
  code: string;
  frames: TraceFrame[];
  testResults?: TestResult[];
  stdout: string;
  stderr?: string;
}

export async function createTrace(data: CreateTraceInput): Promise<SandboxTrace> {
  const { data: doc, error } = await supabaseServer
    .from(TABLES.SANDBOX_TRACES)
    .insert({
      submissionId: data.submissionId,
      userId: data.userId,
      sourceId: data.sourceId || null,
      code: data.code,
      frames: JSON.stringify(data.frames),
      testResults: data.testResults ? JSON.stringify(data.testResults) : null,
      stdout: data.stdout,
      stderr: data.stderr || null,
      createdAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create trace: ${error.message}`);
  return mapDoc<SandboxTrace>(doc);
}

export async function getTrace(submissionId: string): Promise<SandboxTrace | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.SANDBOX_TRACES)
      .select('*')
      .eq('submissionId', submissionId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<SandboxTrace>(data);
  } catch {
    return null;
  }
}

export async function listTracesByUser(userId: string, sourceId?: string): Promise<SandboxTrace[]> {
  let query = supabaseServer
    .from(TABLES.SANDBOX_TRACES)
    .select('*')
    .eq('userId', userId);

  if (sourceId) {
    query = query.eq('sourceId', sourceId);
  }

  const { data, error } = await query
    .order('createdAt', { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return mapDoc<SandboxTrace[]>(data);
}

export function parseTraceFrames(trace: SandboxTrace): TraceFrame[] {
  try { return JSON.parse(trace.frames); } catch { return []; }
}

export function parseTestResults(trace: SandboxTrace): TestResult[] {
  try { return JSON.parse(trace.testResults || '[]'); } catch { return []; }
}
