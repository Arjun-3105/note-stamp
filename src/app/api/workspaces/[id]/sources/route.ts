import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listSourcesByWorkspace } from '@/lib/db/sources';
import { getWorkspace } from '@/lib/db/workspaces';

/**
 * GET /api/workspaces/:id/sources
 * List all sources in a workspace
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify user owns the workspace
    const workspace = await getWorkspace(id);
    if (!workspace || workspace.userId !== userId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const sources = await listSourcesByWorkspace(id);

    return NextResponse.json({
      sources,
      count: sources.length,
    });
  } catch (error) {
    console.error('List sources error:', error);
    return NextResponse.json(
      { error: 'Failed to list sources' },
      { status: 500 }
    );
  }
}
