import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTrace, parseTraceFrames, parseTestResults } from '@/lib/db/sandbox';

/**
 * GET /api/sandbox/trace?submissionId=X
 * Fetches a previously saved execution trace.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submissionId = req.nextUrl.searchParams.get('submissionId');
    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
    }

    const trace = await getTrace(submissionId);
    if (!trace) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }

    // Authorization: only the owner can retrieve their trace
    if (trace.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      submissionId: trace.submissionId,
      code: trace.code,
      stdout: trace.stdout,
      stderr: trace.stderr,
      frames: parseTraceFrames(trace),
      testResults: parseTestResults(trace),
      createdAt: trace.createdAt,
    });
  } catch (error) {
    console.error('[sandbox/trace] error:', error);
    return NextResponse.json({ error: 'Failed to retrieve trace' }, { status: 500 });
  }
}
