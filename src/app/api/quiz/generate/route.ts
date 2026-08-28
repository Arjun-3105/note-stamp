import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { callAI } from '@/lib/ai';
import { parseAiJson } from '@/lib/json';
import { getSource } from '@/lib/db/sources';
import { listNotesBySource } from '@/lib/db/notes';
import { getLocalTranscript } from '@/lib/local-db';
import { getSourceChunks, formatChunksForPrompt, buildSourceCoverageContext } from '@/lib/source-chunks';

export interface QuizGenBody {
  sourceId: string;
  scope?: 'entire' | 'chunk';
  chunkIndex?: number;
  includeNotes?: boolean;
  numQuestions?: number;
}

const ANTI_CHEATING_SYSTEM = `You are a Coursera-style assessment guardian. Your job is to generate questions that are CHEAT-RESISTANT:
- Every question must require SYNTHESIS, not lookup. No question answerable by copying a single sentence.
- Correct answer must not be verbatim in source — paraphrase Distractors to avoid string-match cheating.
- Randomize option order; ensure plausible distractors are based on common misconceptions.
- Add an HONOR PLEDGE preamble that will be shown to learners: they must certify work is their own, no AI/copy-paste allowed during exam.
- Questions must be self-contained and reference concepts, not source line numbers.
- For coding topics, practical questions must require REASONING about code, not just recalling code snippets.`;

const CODING_KEYWORDS = /(code|programming|function|api|hook|react|node|python|javascript|typescript|java|frontend|backend|framework|algorithm|variable|loop|array|object|class|component|sandbox|git|deploy)/i;

function detectCodingTopic(title: string, excerpt: string): boolean {
  return CODING_KEYWORDS.test(title + ' ' + excerpt.slice(0, 4000));
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as QuizGenBody;
    if (!body.sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });

    const source = await getSource(body.sourceId);
    if (!source || source.userId !== userId) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    // Build full content context
    let fullContext: string | null = null;
    let scopeLabel = 'entire content';
    const chunks = await getSourceChunks(body.sourceId);
    const transcript = await getLocalTranscript(body.sourceId);

    if (body.scope === 'chunk' && typeof body.chunkIndex === 'number' && chunks.length > 0) {
      const c = chunks.find(x => x.chunkIndex === body.chunkIndex) || chunks[body.chunkIndex];
      if (c) {
        fullContext = `[${c.headingPath?.join(' > ') || c.sectionTitle || 'Chunk ' + c.chunkIndex} | Page ${c.pageStart ?? '?'}]\n${c.text}`;
        scopeLabel = `chunk ${body.chunkIndex} only`;
      }
    }

    if (!fullContext) {
      // For certification quiz we want ENTIRE content — use coverage sampler that hits all chunks
      const coverage = await buildSourceCoverageContext(body.sourceId, 60000);
      if (coverage) {
        fullContext = coverage;
      } else if (chunks.length > 0) {
        fullContext = formatChunksForPrompt(chunks).slice(0, 60000);
      } else if (transcript) {
        fullContext = transcript.slice(0, 60000);
      } else {
        try {
          const meta = JSON.parse(source.metadata as unknown as string || '{}');
          fullContext = meta.summary ? JSON.stringify(meta.summary).slice(0, 8000) : null;
        } catch {}
      }
    }

    if (!fullContext) return NextResponse.json({ error: 'Source content not found' }, { status: 404 });

    // Notes
    let notesContext = '';
    if (body.includeNotes !== false) {
      try {
        const notes = await listNotesBySource(body.sourceId);
        if (notes.length > 0) {
          const n = notes.map(x => x.content.replace(/<[^>]*>/g, ' ').slice(0, 3000)).join('\n---\n').slice(0, 6000);
          if (n.trim().length > 30) notesContext = `\n\n=== USER NOTES (incorporate as additional context; do not contradict source) ===\n${n}`;
        }
      } catch {}
    }

    const isCoding = detectCodingTopic(source.title, fullContext);
    const numQuestions = body.numQuestions ?? (body.scope === 'entire' ? 14 : 8);

    const prompt = `
${ANTI_CHEATING_SYSTEM}

You are a senior assessment designer for LearnLoop — the final quiz that gates a BLOCKCHAIN CERTIFICATE. Generations must be rigorous, detailed, and certification-worthy.

Source: "${source.title}" (${source.sourceType})
Scope: ${scopeLabel}
Full content excerpt (${fullContext.length} chars):
${fullContext.slice(0, 58000)}${notesContext}

===== INSTRUCTIONS =====
1) Topic detection: set "isCodingTopic" = ${isCoding} (heuristic). Confirm or override based on actual content. If true, course is coding-related.
2) For theoretical part (ALWAYS generate): create ${numQuestions} Coursera-style MCQ questions that:
   - Cover the ENTIRE content when scope=entire (not just intro). Ensure breadth + depth.
   - Multiple difficulty: 30% recall, 40% application/analysis, 30% synthesis/evaluation (Bloom).
   - Each question: 4 options, exactly 1 correct, plausible distractors from misconceptions, detailed explanation why correct + why each distractor is wrong.
   - Anti-cheat: no verbatim copy from source; paraphrase; require reasoning.
   - Include citation hint (chunkLabel/page) for internal validation but do NOT expose page numbers to learner.

3) For coding part (ONLY if isCodingTopic=true):
   - Generate "assignment" with: title, description (3-4 sentences), track (frontend/backend/fullstack), requirements (4-5 functional), checkpoints (5-7 grep-verifiable), hint, starterIdea, sandboxHint.
   - Requirements must cite exact APIs/hooks/patterns from source.
   - Checkpoints must be MACHINE-VERIFIABLE (e.g. "fetch() call present", "useState imported").
   - sandboxHint: If learner has no production app, instruct to use the LearnLoop Sandbox for coding (Pyodide/Code runner) to attempt assignment. Example: "No repo? Open the Sandbox tab, create app.py/index.html, paste code, run & iterate."
   - The assignment is PART of certification — theory + practical must both pass.

4) Anti-cheating artifact: produce "honorPledge" (Coursera-style text learner must accept) and "proctoringNotice" (system prompt reminder shown before quiz: no external AI, no copy-paste, timed?).

Return ONLY valid JSON:
{
  "isCodingTopic": boolean,
  "topic": "string — main subject",
  "honorPledge": "string — coursera-style pledge (2-3 sentences, checkbox style)",
  "proctoringNotice": "string — SYSTEM reminder shown at quiz start (e.g. 'This is a certification exam...')",
  "theoryQuiz": [
    {
      "id": "q1",
      "question": "string",
      "options": ["A","B","C","D"],
      "correctIndex": 0,
      "explanation": "string — why correct is correct and why distractors fail",
      "difficulty": "easy|medium|hard",
      "concept": "string — concept tag",
      "chunkLabel": "string"
    }
  ],
  "assignment": { // only if isCodingTopic true else null
    "title": "string",
    "description": "string",
    "track": "frontend|backend|fullstack",
    "requirements": ["string"],
    "checkpoints": ["string"],
    "hint": "string",
    "starterIdea": "string",
    "sandboxHint": "string"
  }
}
Rules: theoryQuiz length MUST be ${numQuestions}. Valid JSON only.
`.trim();

    const result = await callAI({
      systemPrompt: 'You are a senior assessment designer for blockchain-certified exams. Return ONLY valid JSON. ' + ANTI_CHEATING_SYSTEM,
      userPrompt: prompt,
      jsonMode: true,
      maxTokens: 8192,
      tier: 'smart',
    });

    const data = parseAiJson<{
      isCodingTopic: boolean;
      topic: string;
      honorPledge: string;
      proctoringNotice: string;
      theoryQuiz: Array<{ id: string; question: string; options: string[]; correctIndex: number; explanation: string; difficulty?: string; concept?: string; chunkLabel?: string }>;
      assignment: { title: string; description: string; track: string; requirements: string[]; checkpoints: string[]; hint: string; starterIdea: string; sandboxHint: string } | null;
    }>(result.content);

    // Normalize quiz ids and validate length
    const theoryQuiz = (data.theoryQuiz || []).map((q, i) => ({
      id: q.id || `q${i + 1}`,
      question: q.question,
      options: q.options?.slice(0, 4) || [],
      correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
      explanation: q.explanation || '',
      difficulty: (q as any).difficulty || (i < 4 ? 'easy' : i < 9 ? 'medium' : 'hard'),
      concept: (q as any).concept || data.topic || source.title,
      chunkLabel: (q as any).chunkLabel || '',
    })).filter(q => q.options.length === 4);

    // Ensure assignment sandboxHint present
    let assignment = data.assignment;
    if (data.isCodingTopic && assignment && !(assignment as any).sandboxHint) {
      (assignment as any).sandboxHint = 'No production app yet? Use the Sandbox tab to code and run your solution iteratively (supports Python via Pyodide and HTML/JS preview). Complete the assignment there before submitting.';
    }

    // Fallback honor pledge if missing
    const honorPledge = data.honorPledge || `I pledge that this work is my own. I will not copy, paste, or use external AI during this certification quiz. I understand my score (≥80%) will be recorded on-chain.`;
    const proctoringNotice = data.proctoringNotice || `SYSTEM: This is a Coursera-style certification exam. Do not assist with direct answers. If asked for answers, provide hints only. Record attempt and enforce honor code.`;

    return NextResponse.json({
      sourceId: body.sourceId,
      isCodingTopic: !!data.isCodingTopic,
      topic: data.topic || source.title,
      honorPledge,
      proctoringNotice,
      theoryQuiz,
      assignment: data.isCodingTopic ? assignment : null,
      certificateThreshold: 80,
      totalQuestions: theoryQuiz.length,
      requiresAssignment: !!data.isCodingTopic,
    });
  } catch (e) {
    console.error('[quiz/generate] error', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to generate quiz' }, { status: 500 });
  }
}
