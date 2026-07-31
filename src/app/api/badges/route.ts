import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listBadgesByUser, createBadge, type BadgeType } from '@/lib/db/badges';
import { z } from 'zod';

/**
 * GET /api/badges
 * List all badges for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const type = req.nextUrl.searchParams.get('type') as BadgeType | null;
    const badges = await listBadgesByUser(userId, type || undefined);

    return NextResponse.json({ badges, count: badges.length });
  } catch (error) {
    console.error('[badges] List error:', error);
    return NextResponse.json({ error: 'Failed to list badges' }, { status: 500 });
  }
}

const CreateBadgeSchema = z.object({
  type: z.enum(['micro', 'skill', 'master']),
  title: z.string().min(1),
  skill: z.string().min(1),
  sourceId: z.string().optional(),
  workspaceId: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  componentBadgeIds: z.array(z.string()).optional(),
  score: z.number().min(0).max(100),
  idempotencyKey: z.string().min(1),
});

/**
 * POST /api/badges
 * Create a new badge (for testing — in production, created by AI assessment)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateBadgeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const badge = await createBadge({ userId, ...parsed.data });
    return NextResponse.json(badge, { status: 201 });
  } catch (error) {
    console.error('[badges] Create error:', error);
    return NextResponse.json({ error: 'Failed to create badge' }, { status: 500 });
  }
}
