import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';

const RequestSchema = z.object({
  studentId: z.string(),
  conceptId: z.string(),
  workspaceId: z.string(),
  // Raw score signal: 0–1 scale
  // For quiz: pass % / 100. For sandbox: test pass ratio. For math: steps correct ratio.
  rawScore: z.number().min(0).max(1),
  sourceOfMastery: z.enum(['quiz', 'sandbox_trace', 'step_verification']),
});

/**
 * POST /api/mastery/update
 *
 * Updates a student's mastery score for a concept using a simplified FSRS-inspired
 * calculation on top of the ts-fsrs library.
 *
 * Called after:
 *  - quiz submission (sourceOfMastery: "quiz")
 *  - sandbox test pass (sourceOfMastery: "sandbox_trace")
 *  - math step verification completion (sourceOfMastery: "step_verification")
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, conceptId, workspaceId, rawScore, sourceOfMastery } = RequestSchema.parse(body);

    // Only allow updating own mastery
    if (studentId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { upsertMastery, getMastery } = await import('@/lib/db/mastery');
    const { fsrs, createEmptyCard, Rating } = await import('ts-fsrs');

    const f = fsrs();
    const existing = await getMastery(studentId, conceptId);

    // Map raw score to FSRS rating (numeric values matching Rating enum)
    // > 0.85 = Easy(4), 0.65–0.85 = Good(3), 0.45–0.65 = Hard(2), < 0.45 = Again(1)
    let ratingValue: number;
    let ratingName: string;
    if (rawScore >= 0.85) { ratingValue = Rating.Easy; ratingName = 'Easy'; }
    else if (rawScore >= 0.65) { ratingValue = Rating.Good; ratingName = 'Good'; }
    else if (rawScore >= 0.45) { ratingValue = Rating.Hard; ratingName = 'Hard'; }
    else { ratingValue = Rating.Again; ratingName = 'Again'; }

    // Build or reconstruct the FSRS card state
    const now = new Date();
    let card = createEmptyCard(now);

    // If we have prior history, approximate the card state from stored values
    if (existing) {
      card = {
        ...card,
        stability: existing.stability,
        difficulty: Math.max(0, Math.min(10, (1 - existing.masteryScore) * 10)),
        due: new Date(existing.lastReviewed),
        last_review: new Date(existing.lastReviewed),
        reps: 1,
        lapses: 0,
        state: existing.masteryScore >= 0.75 ? 2 : 1, // Review or Learning
      };
    }

    // Run FSRS scheduling — f.repeat returns a Record<Rating, RecordLogItem>
    const schedulingCards = f.repeat(card, now);
    // Cast via unknown to satisfy TS — IPreview is indexed by Rating enum values (numbers)
    const schedulingEntry = (schedulingCards as unknown as Record<number, { card: { stability: number } }>)[ratingValue];
    const newCard = schedulingEntry?.card ?? card;

    // Blend FSRS stability with raw score to get masteryScore
    const retentionEstimate = Math.min(1, newCard.stability / 30); // 30-day reference
    const masteryScore = (rawScore * 0.6) + (retentionEstimate * 0.4);

    const updated = await upsertMastery({
      studentId,
      conceptId,
      workspaceId,
      masteryScore: Math.min(1, Math.max(0, masteryScore)),
      stability: newCard.stability,
      sourceOfMastery,
    });

    return NextResponse.json({
      conceptId,
      masteryScore: updated.masteryScore,
      stability: updated.stability,
      rating: ratingName,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 });
    }
    console.error('[mastery/update] error:', error);
    return NextResponse.json({ error: 'Failed to update mastery' }, { status: 500 });
  }
}
