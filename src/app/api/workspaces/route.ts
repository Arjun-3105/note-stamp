import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listWorkspacesByUser } from '@/lib/db/workspaces';

/**
 * GET /api/workspaces
 * List all workspaces for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaces = await listWorkspacesByUser(userId);

    return NextResponse.json({
      workspaces,
      count: workspaces.length,
    });
  } catch (error) {
    console.error('Workspaces list error:', error);
    return NextResponse.json(
      { error: 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}

