import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listWorkspacesByUser } from '@/lib/db/workspaces';
import { listSourcesByWorkspace } from '@/lib/db/sources';

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
    const workspacesWithCounts = await Promise.all(
      workspaces.map(async (ws) => {
        const sources = await listSourcesByWorkspace(ws.$id);
        return {
          ...ws,
          sourceCount: sources.length,
        };
      })
    );

    return NextResponse.json({
      workspaces: workspacesWithCounts,
      count: workspacesWithCounts.length,
    });
  } catch (error) {
    console.error('Workspaces list error:', error);
    return NextResponse.json(
      { error: 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}

