import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProgress, saveProgress, listProgressByUser, listProgressByWorkspace, type UserProgress } from '@/lib/progress';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = req.nextUrl;
    const sourceId = url.searchParams.get('sourceId');
    const workspaceId = url.searchParams.get('workspaceId');

    if (sourceId) {
      const p = await getProgress(userId, sourceId);
      return NextResponse.json({ progress: p });
    }
    if (workspaceId) {
      const list = await listProgressByWorkspace(userId, workspaceId);
      return NextResponse.json({ progresses: list });
    }
    const list = await listProgressByUser(userId);
    return NextResponse.json({ progresses: list });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to fetch progress' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json() as Partial<UserProgress> & { sourceId: string; workspaceId: string };
    if (!body.sourceId || !body.workspaceId) return NextResponse.json({ error: 'sourceId and workspaceId required' }, { status: 400 });

    const existing = await getProgress(userId, body.sourceId);

    const merged: UserProgress = {
      userId,
      workspaceId: body.workspaceId,
      sourceId: body.sourceId,
      completedChunks: body.completedChunks ?? existing?.completedChunks ?? [],
      completedPages: body.completedPages ?? existing?.completedPages ?? [],
      completedTopics: body.completedTopics ?? existing?.completedTopics ?? [],
      totalChunks: body.totalChunks ?? existing?.totalChunks,
      totalPages: body.totalPages ?? existing?.totalPages,
      totalTopics: body.totalTopics ?? existing?.totalTopics,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveProgress(merged);
    return NextResponse.json({ progress: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to save progress' }, { status: 500 });
  }
}
