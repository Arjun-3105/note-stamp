import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkGate, listMasteryForStudent, MASTERY_GATE_THRESHOLD } from '@/lib/db/mastery';
import { getLocalRoadmap } from '@/lib/local-db';

/**
 * GET /api/mastery/gate-check?conceptId=X&sourceId=Y
 *
 * Checks whether a student's prerequisite concepts for conceptId are all
 * at or above the mastery gate threshold (0.7 by default).
 * Prerequisite list is derived from the stored prerequisite DAG for the source.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conceptId = req.nextUrl.searchParams.get('conceptId');
    const sourceId = req.nextUrl.searchParams.get('sourceId');

    if (!conceptId) {
      return NextResponse.json({ error: 'conceptId is required' }, { status: 400 });
    }

    // Load prerequisite DAG from local roadmap cache (same storage used by concept-map)
    let prerequisiteIds: string[] = [];
    if (sourceId) {
      const roadmap = await getLocalRoadmap(sourceId, false);
      if (roadmap?.edges && Array.isArray(roadmap.edges)) {
        // Edges in the concept map represent "source is prerequisite of target"
        // Find all nodes that point TO this conceptId
        prerequisiteIds = roadmap.edges
          .filter((e: { source: string; target: string }) => e.target === conceptId)
          .map((e: { source: string; target: string }) => e.source);
      }
    }

    const gateOpen = await checkGate(userId, prerequisiteIds);

    // Also return individual mastery scores for prerequisites
    const masteryList = await listMasteryForStudent(userId);
    const prereqMastery = prerequisiteIds.map(id => {
      const m = masteryList.find(m => m.conceptId === id);
      return {
        conceptId: id,
        masteryScore: m?.masteryScore ?? 0,
        met: (m?.masteryScore ?? 0) >= MASTERY_GATE_THRESHOLD,
      };
    });

    return NextResponse.json({
      conceptId,
      gateOpen,
      threshold: MASTERY_GATE_THRESHOLD,
      prerequisites: prereqMastery,
    });
  } catch (error) {
    console.error('[mastery/gate-check] error:', error);
    return NextResponse.json({ error: 'Failed to check gate' }, { status: 500 });
  }
}

/**
 * GET /api/mastery/gate-check (no conceptId) — returns full mastery map for the user
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await req.json();
    const masteryList = await listMasteryForStudent(userId, workspaceId);

    return NextResponse.json({ mastery: masteryList });
  } catch (error) {
    console.error('[mastery/gate-check POST] error:', error);
    return NextResponse.json({ error: 'Failed to fetch mastery' }, { status: 500 });
  }
}
