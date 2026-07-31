import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkspace } from '@/lib/db/workspaces';

/**
 * GET /api/workspaces/:id
 * Get a specific workspace
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
    const workspace = await getWorkspace(id);
    if (!workspace || workspace.userId !== userId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Get workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to get workspace' },
      { status: 500 }
    );
  }
}
