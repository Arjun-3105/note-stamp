import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createTrace } from '@/lib/db/sandbox';
import { type TraceFrame, type TestResult } from '@/lib/db/sandbox';
import { z } from 'zod';
import { ID } from 'node-appwrite';

const RequestSchema = z.object({
  code: z.string().min(1),
  frames: z.array(z.object({
    line: z.number(),
    event: z.enum(['call', 'return', 'line', 'exception']),
    variables: z.record(z.string()),
    callStack: z.array(z.string()),
    returnValue: z.string().optional(),
  })),
  stdout: z.string(),
  stderr: z.string().optional(),
  testResults: z.array(z.object({
    testCaseId: z.string(),
    passed: z.boolean(),
    actualOutput: z.string(),
    expectedOutput: z.string(),
  })).optional(),
  sourceId: z.string().optional(),
});

/**
 * POST /api/sandbox/execute
 *
 * Persists an execution trace that was captured client-side via Pyodide.
 * The actual code execution happens in the browser (WASM) — this route
 * only handles storage and returns a submissionId for later retrieval.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = RequestSchema.parse(body);

    const submissionId = ID.unique();

    await createTrace({
      submissionId,
      userId,
      sourceId: parsed.sourceId,
      code: parsed.code,
      frames: parsed.frames as TraceFrame[],
      testResults: parsed.testResults as TestResult[] | undefined,
      stdout: parsed.stdout,
      stderr: parsed.stderr,
    });

    return NextResponse.json({ submissionId, frameCount: parsed.frames.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 });
    }
    console.error('[sandbox/execute] error:', error);
    return NextResponse.json({ error: 'Failed to save execution trace' }, { status: 500 });
  }
}
