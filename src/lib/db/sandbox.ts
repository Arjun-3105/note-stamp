import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

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
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.SANDBOX_TRACES, ID.unique(), {
    submissionId: data.submissionId,
    userId: data.userId,
    sourceId: data.sourceId || null,
    code: data.code,
    frames: JSON.stringify(data.frames),
    testResults: data.testResults ? JSON.stringify(data.testResults) : null,
    stdout: data.stdout,
    stderr: data.stderr || null,
    createdAt: new Date().toISOString(),
  }) as unknown as SandboxTrace;
}

export async function getTrace(submissionId: string): Promise<SandboxTrace | null> {
  try {
    const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.SANDBOX_TRACES, [
      Query.equal('submissionId', submissionId),
      Query.limit(1),
    ]);
    return (result.documents[0] as unknown as SandboxTrace) ?? null;
  } catch {
    return null;
  }
}

export async function listTracesByUser(userId: string, sourceId?: string): Promise<SandboxTrace[]> {
  const queries = [Query.equal('userId', userId), Query.orderDesc('createdAt'), Query.limit(20)];
  if (sourceId) queries.push(Query.equal('sourceId', sourceId));
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.SANDBOX_TRACES, queries);
  return result.documents as unknown as SandboxTrace[];
}

export function parseTraceFrames(trace: SandboxTrace): TraceFrame[] {
  try { return JSON.parse(trace.frames); } catch { return []; }
}

export function parseTestResults(trace: SandboxTrace): TestResult[] {
  try { return JSON.parse(trace.testResults || '[]'); } catch { return []; }
}
