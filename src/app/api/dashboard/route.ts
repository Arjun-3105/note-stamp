import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listWorkspacesByUser } from '@/lib/db/workspaces';
import { listSourcesByWorkspace } from '@/lib/db/sources';
import { listBadgesByUser } from '@/lib/db/badges';
import { listNotesBySource } from '@/lib/db/notes';
import { listQuizAttemptsByUser } from '@/lib/db/quizzes';
import { getMonthlyTokenUsage } from '@/lib/db/usage';
import { getUser } from '@/lib/db/users';
import { listProgressByUser } from '@/lib/progress';

/**
 * GET /api/dashboard
 * Aggregated data for the home dashboard — workspaces, sources, notes,
 * quiz attempts, badges, streak, and usage — all in one round-trip.
 */
export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parallel top-level fetches ────────────────────────────────
    const [user, workspacesRaw, badgesRaw, quizAttempts, usage] = await Promise.all([
      getUser(userId),
      listWorkspacesByUser(userId),
      listBadgesByUser(userId),
      listQuizAttemptsByUser(userId),
      getMonthlyTokenUsage(userId),
    ]);

    // ── Active workspaces (exclude archived) ──────────────────────
    const workspaces = workspacesRaw.filter(w => w.status === 'active');

    // ── Progress aggregates per workspace (backend-backed chunk/page/topic tracking) ──
    const allProgress = await listProgressByUser(userId);
    const progressByWs = new Map<string, {done:number,total:number}>();
    for(const p of allProgress){
      const ws = p.workspaceId;
      if(!ws) continue;
      const done = (p.completedChunks?.length||0)+(p.completedPages?.length||0)+(p.completedTopics?.length||0);
      const total = (p.totalChunks||0)+(p.totalPages||0)+(p.totalTopics||0);
      if(!total) continue;
      const agg = progressByWs.get(ws) || {done:0,total:0};
      agg.done += done; agg.total += total;
      progressByWs.set(ws, agg);
    }

    // ── Pull sources for the 8 most recently-updated workspaces ──
    // (avoids a fan-out for large accounts) — also fixes stale sourceCount
    const recentWs = workspaces.slice(0, 8);
    const sourcesPerWs = await Promise.all(
      recentWs.map(ws => listSourcesByWorkspace(ws.$id))
    );
    const sourceCountMap = new Map<string, number>();
    sourcesPerWs.forEach((srcs,i)=> sourceCountMap.set(recentWs[i].$id, srcs.length));

    // Flatten sources and annotate with workspace info
    const recentSources = sourcesPerWs
      .flatMap((srcs, i) =>
        srcs.map(s => ({ ...s, workspaceTitle: recentWs[i].title, workspaceId: recentWs[i].$id }))
      )
      .filter(s => s.status === 'ready')
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
      .slice(0, 5);

    // ── Notes count (recent sources only) ─────────────────────────
    const notesCountMap: Record<string, number> = {};
    if (recentSources.length > 0) {
      const notesCounts = await Promise.all(
        recentSources.map(s => listNotesBySource(s.$id))
      );
      recentSources.forEach((s, i) => {
        notesCountMap[s.$id] = notesCounts[i].length;
      });
    }

    // ── Streak calculation ────────────────────────────────────────
    // Build an ordered list of dates (UTC) on which the user took a quiz
    const quizDates = quizAttempts
      .map(q => q.takenAt.slice(0, 10)) // YYYY-MM-DD
      .filter((v, i, a) => a.indexOf(v) === i) // dedupe
      .sort()
      .reverse(); // newest first

    let currentStreak = 0;
    let bestStreak = 0;
    let runStreak = 0;
    {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      let expect = new Date(today);

      for (const d of quizDates) {
        const dt = new Date(d);
        dt.setUTCHours(0, 0, 0, 0);
        if (dt.getTime() === expect.getTime()) {
          runStreak++;
          expect.setUTCDate(expect.getUTCDate() - 1);
          if (currentStreak === 0 &&
            (dt.getTime() === today.getTime() ||
             dt.getTime() === today.getTime() - 86400000)) {
            currentStreak = runStreak;
          }
        } else if (dt < expect) {
          // gap — reset
          if (bestStreak < runStreak) bestStreak = runStreak;
          runStreak = 1;
          expect = new Date(dt);
          expect.setUTCDate(expect.getUTCDate() - 1);
        }
      }
      if (bestStreak < runStreak) bestStreak = runStreak;
    }

    // Last 7 days activity (for streak dots)
    const last7: boolean[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return quizDates.includes(key);
    });

    // ── Today's checkpoints (quiz score proxy) ────────────────────
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayAttempts = quizAttempts.filter(q => q.takenAt.startsWith(todayKey));
    const todayCheckpoints = todayAttempts.filter(q => q.passed).length;

    // ── Recommended next: workspaces with lowest progress first ──
    const recommended = workspaces
      .filter(w => w.totalUnits > 0)
      .sort((a, b) => {
        const pctA = a.completedUnits / a.totalUnits;
        const pctB = b.completedUnits / b.totalUnits;
        return pctA - pctB; // ascending: lowest first
      })
      .slice(0, 3)
      .map(w => ({
        id: w.$id,
        title: w.title,
        pct: w.totalUnits > 0 ? Math.round((w.completedUnits / w.totalUnits) * 100) : 0,
      }));

    // ── Recent activity ───────────────────────────────────────────
    // Combine quiz attempts + sources into a timeline
    const activity = [
      ...quizAttempts.slice(0, 5).map(q => ({
        type: 'quiz' as const,
        title: `Quiz attempt`,
        sourceId: q.sourceId,
        time: q.takenAt,
        score: q.score,
        passed: q.passed,
      })),
      ...recentSources.slice(0, 5).map(s => ({
        type: 'source' as const,
        title: s.title,
        sourceId: s.$id,
        workspaceId: (s as any).workspaceId,
        time: s.createdAt,
        sourceType: s.sourceType,
      })),
    ]
      .sort((a, b) => (b.time > a.time ? 1 : -1))
      .slice(0, 6);

    // ── Response ──────────────────────────────────────────────────
    return NextResponse.json({
      plan: user?.plan ?? 'free',
      usage: {
        totalTokens: usage.inputTokens + usage.outputTokens,
        freeLimit: 100_000,
        isPro: user?.plan === 'pro',
      },
      workspaces: workspaces.slice(0, 8).map(w => {
        const actualSourceCount = sourceCountMap.get(w.$id) ?? w.sourceCount;
        const prog = progressByWs.get(w.$id);
        const trackedPct = prog && prog.total ? Math.round((prog.done / prog.total)*100) : null;
        // Prefer tracked progress if available, else DB totalUnits
        const pct = trackedPct !== null ? trackedPct : (w.totalUnits > 0 ? Math.round((w.completedUnits / w.totalUnits) * 100) : 0);
        return {
          id: w.$id,
          title: w.title,
          description: w.description,
          sourceCount: actualSourceCount,
          completedUnits: w.completedUnits,
          totalUnits: w.totalUnits,
          pct,
          trackedPct,
          progress: prog ? { done: prog.done, total: prog.total } : null,
          updatedAt: w.updatedAt,
        };
      }),
      recentSources: recentSources.map(s => ({
        id: s.$id,
        title: s.title,
        sourceType: s.sourceType,
        workspaceId: (s as any).workspaceId,
        workspaceTitle: (s as any).workspaceTitle,
        notesCount: notesCountMap[s.$id] ?? 0,
        createdAt: s.createdAt,
      })),
      badges: badgesRaw.slice(0, 5).map(b => ({
        id: b.$id,
        title: b.title,
        skill: b.skill,
        type: b.type,
        score: b.score,
        mintedAt: b.mintedAt,
        createdAt: b.createdAt,
      })),
      streak: {
        current: currentStreak,
        best: bestStreak,
        last7,
      },
      todayCheckpoints,
      todayGoal: 5, // configurable in future
      recommended,
      activity,
      totalWorkspaces: workspaces.length,
      totalBadges: badgesRaw.length,
      totalQuizAttempts: quizAttempts.length,
    });
  } catch (error) {
    console.error('[dashboard] Error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
