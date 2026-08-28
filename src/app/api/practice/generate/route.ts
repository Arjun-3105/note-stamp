import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { callAI } from '@/lib/ai';
import { parseAiJson } from '@/lib/json';
import { getSource } from '@/lib/db/sources';
import { listNotesBySource } from '@/lib/db/notes';
import { getSourceChunks, formatChunkLabel } from '@/lib/source-chunks';
import { getLocalTranscript } from '@/lib/local-db';

/**
 * POST /api/practice/generate
 * Generates a practice question either from current chunk or from chunks covered till now.
 *
 * Body:
 *  - sourceId: string
 *  - mode: 'current' | 'covered' | 'entire'  (default covered)
 *  - chunkIndex?: number  (when mode=current)
 *  - completedChunkIndexes?: number[] (when mode=covered -> sample from these; if not supplied, uses first N chunks)
 *  - difficulty?: 'easy'|'medium'|'hard'
 *  - includeNotes?: boolean
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as {
      sourceId: string;
      mode?: 'current' | 'covered' | 'entire';
      chunkIndex?: number;
      completedChunkIndexes?: number[];
      difficulty?: string;
      includeNotes?: boolean;
    };

    if (!body.sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });

    const source = await getSource(body.sourceId);
    if (!source || source.userId !== userId) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const chunks = await getSourceChunks(body.sourceId);
    const transcript = await getLocalTranscript(body.sourceId);

    let selectedChunks: typeof chunks = [];
    let scopeLabel = '';

    if (body.mode === 'current' && typeof body.chunkIndex === 'number' && chunks.length > 0) {
      const c = chunks.find(x => x.chunkIndex === body.chunkIndex) ?? chunks[body.chunkIndex];
      if (c) selectedChunks = [c];
      scopeLabel = `current chunk ${body.chunkIndex}`;
    } else if (body.mode === 'entire') {
      selectedChunks = chunks.length > 0 ? chunks.slice(0, 12) : [];
      scopeLabel = 'entire source';
    } else {
      // covered till now
      const idxs = body.completedChunkIndexes && body.completedChunkIndexes.length > 0
        ? body.completedChunkIndexes
        : chunks.slice(0, Math.min(chunks.length, 6)).map(c => c.chunkIndex);
      selectedChunks = chunks.filter(c => idxs.includes(c.chunkIndex));
      if (selectedChunks.length === 0 && chunks.length > 0) selectedChunks = chunks.slice(0, 3);
      scopeLabel = `chunks covered till now [${idxs.join(',')}]`;
    }

    let context = '';
    let labels: string[] = [];
    if (selectedChunks.length > 0) {
      context = selectedChunks.map(c => `[${formatChunkLabel(c)}]\n${c.text}`).join('\n\n---\n\n').slice(0, 9000);
      labels = selectedChunks.map(c => formatChunkLabel(c));
    } else if (transcript) {
      context = transcript.slice(0, 9000);
      labels = ['Transcript'];
    } else {
      return NextResponse.json({ error: 'No content for practice' }, { status: 404 });
    }

    let notesCtx = '';
    if (body.includeNotes !== false) {
      try {
        const notes = await listNotesBySource(body.sourceId);
        if (notes.length > 0) {
          const n = notes.map(x => x.content.replace(/<[^>]*>/g, ' ').slice(0, 2000)).join('\n---\n').slice(0, 3000);
          if (n.trim().length > 20) notesCtx = `\n\nUSER NOTES:\n${n}`;
        }
      } catch {}
    }

    const difficulty = body.difficulty || 'medium';

    const prompt = `
You are a practice tutor that generates ONE high-quality practice question at a time — with step-wise marking and suggestive teaching (like a maths simulator).

Source: "${source.title}" (${source.sourceType}) — scope: ${scopeLabel}
Chunk labels: ${labels.join(' | ')}

Context for this practice question (${context.length} chars):
${context}${notesCtx}

===== REQUIREMENTS =====
- Generate exactly 1 question appropriate for difficulty "${difficulty}".
- Question may be MCQ (4 options), short-answer, or numeric/calculation — choose the best format for the chunk.
- Provide:
  - "question": string
  - "type": "mcq" | "short" | "numeric" | "code"
  - "options"?: string[4] (if mcq)
  - "correctIndex"?: number (if mcq)
  - "expectedAnswer": string (canonical answer, or numeric value with tolerance)
  - "tolerance"?: number (for numeric)
  - "difficulty": string
  - "concept": string
  - "chunkLabel": string (one of the labels above)
  - "steps": array of { title, instruction, hint } — 2-4 suggested teaching steps to solve (scaffolding, not full answer)
  - "markingRubric": array of { criterion, marks, whatToCheck } — total 10 marks, split across steps
  - "hints": string[] — 2-3 progressive hints (nudge → stronger hint)
  - "workedSolution": string — full solution shown after attempt
  - "commonMistakes": string[] — 2-3 typical errors
  - "nextSuggestion": string — what to do after mastering this

Keep question grounded in the provided context. Do not invent facts outside it.
Return ONLY valid JSON:
{
  "question": "...",
  "type": "mcq|short|numeric|code",
  "options": ["..."],
  "correctIndex": 0,
  "expectedAnswer": "...",
  "difficulty": "easy|medium|hard",
  "concept": "...",
  "chunkLabel": "...",
  "steps": [{"title":"Step 1: ...","instruction":"...","hint":"..."}],
  "markingRubric": [{"criterion":"...","marks":3,"whatToCheck":"..."}],
  "hints": ["hint1","hint2"],
  "workedSolution": "...",
  "commonMistakes": ["..."],
  "nextSuggestion": "..."
}
`.trim();

    const result = await callAI({
      systemPrompt: 'You are a supportive practice tutor with step-wise marking and suggestive teaching. Return ONLY valid JSON.',
      userPrompt: prompt,
      jsonMode: true,
      maxTokens: 2048,
      tier: 'fast',
    });

    const data = parseAiJson<any>(result.content);

    // Normalize
    if (!data.chunkLabel && labels[0]) data.chunkLabel = labels[0];

    return NextResponse.json({ sourceId: body.sourceId, scopeLabel, chunkLabels: labels, practice: data });
  } catch (e) {
    console.error('[practice/generate] error', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to generate practice' }, { status: 500 });
  }
}
