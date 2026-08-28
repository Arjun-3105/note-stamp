import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { callAI } from "@/lib/ai";
import { parseAiJson } from "@/lib/json";
import { getSource } from "@/lib/db/sources";
import { listNotesBySource } from "@/lib/db/notes";
import { getLocalTranscript } from "@/lib/local-db";
import { getSourceChunks, formatChunksForPrompt, formatChunkLabel } from "@/lib/source-chunks";
import { createFlashcardSet } from "@/lib/db/flashcards";

export type Flashcard = {
  id?: string;
  front?: string;
  back?: string;
  title: string;
  explanation: string;
  example: string;
  checkpoint: string;
  timestamp?: number;
  confidenceScore?: number;
  chunkLabel?: string;
  pageStart?: number;
  pageEnd?: number;
};

function cardCountFromLength(len: number): string {
  if (len < 5_000) return "5 to 6";
  if (len < 15_000) return "8 to 10";
  if (len < 40_000) return "10 to 14";
  return "14 to 18";
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      transcript?: string;
      sourceId?: string;
      scope?: 'entire' | 'chunk';
      chunkIndex?: number;
      includeNotes?: boolean;
    };

    // Legacy path: transcript-only (kept for backward compat / direct calls)
    let sourceContent: string | null = null;
    let notesContent: string | null = null;
    let sourceLabel = "Video transcript";
    let chunkLabels: string[] = [];
    let pageHints: Array<{ chunkLabel: string; pageStart?: number; pageEnd?: number }> = [];

    let sourceId = body.sourceId;
    let source: any = null;

    if (sourceId) {
      const { userId } = await auth();
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      source = await getSource(sourceId);
      if (!source || source.userId !== userId) {
        return NextResponse.json({ error: "Source not found" }, { status: 404 });
      }

      const chunks = await getSourceChunks(sourceId);
      const transcript = await getLocalTranscript(sourceId);

      // Determine content based on sourceType and scope
      if (body.scope === 'chunk' && typeof body.chunkIndex === 'number' && chunks.length > 0) {
        const chunk = chunks.find(c => c.chunkIndex === body.chunkIndex) || chunks[body.chunkIndex];
        if (chunk) {
          sourceContent = chunk.text;
          sourceLabel = formatChunkLabel(chunk);
          chunkLabels = [sourceLabel];
          pageHints = [{ chunkLabel: sourceLabel, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd }];
        }
      } else {
        if (source.sourceType === 'youtube') {
          sourceContent = transcript ? transcript.slice(0, 60000) : null;
          sourceLabel = "YouTube transcript";
          if (chunks.length > 0) {
            // Also provide chunk labels for grounding
            chunkLabels = chunks.slice(0, 8).map(c => formatChunkLabel(c));
          }
        } else if (source.sourceType === 'pdf' || source.sourceType === 'url' || source.sourceType === 'text') {
          if (chunks.length > 0) {
            // Use formatted chunks for PDF/URL (preserves page/section grounding)
            // Cap to ~50000 chars for prompt budget
            const formatted = formatChunksForPrompt(chunks);
            sourceContent = formatted.slice(0, 55000);
            chunkLabels = chunks.slice(0, 10).map(c => formatChunkLabel(c));
            pageHints = chunks.slice(0, 18).map(c => ({ chunkLabel: formatChunkLabel(c), pageStart: c.pageStart, pageEnd: c.pageEnd }));
            sourceLabel = chunks[0]?.pageStart ? `PDF chunks (pages ${chunks[0].pageStart}-${chunks[chunks.length-1]?.pageEnd ?? chunks[0].pageStart})` : "PDF chunks";
          } else if (transcript) {
            sourceContent = transcript.slice(0, 55000);
          }
        } else {
          sourceContent = transcript ? transcript.slice(0, 55000) : null;
        }
      }

      // Pull user notes if requested (default: true)
      const shouldIncludeNotes = body.includeNotes !== false;
      if (shouldIncludeNotes) {
        try {
          const notes = await listNotesBySource(sourceId);
          if (notes.length > 0) {
            const rawNotes = notes.map(n => stripHtml(n.content)).filter(Boolean).join("\n\n---\n\n");
            if (rawNotes.length > 40) {
              notesContent = rawNotes.slice(0, 8000);
            }
          }
        } catch {}
      }

      if (!sourceContent) {
        // Fallback: try metadata summary
        try {
          const meta = JSON.parse(source.metadata as unknown as string || '{}');
          if (meta.summary) sourceContent = JSON.stringify(meta.summary).slice(0, 10000);
        } catch {}
      }

      if (!sourceContent) {
        return NextResponse.json({ error: "Source content not found — ingest still processing?" }, { status: 404 });
      }
    } else if (body.transcript) {
      // Legacy transcript path
      sourceContent = body.transcript.slice(0, 14000);
      sourceLabel = "Transcript";
    } else {
      return NextResponse.json({ error: "sourceId or transcript is required" }, { status: 400 });
    }

    const totalLen = sourceContent.length + (notesContent?.length || 0);
    const cardCount = cardCountFromLength(totalLen);

    // Use a slightly larger excerpt budget when we have structured chunks
    const excerpt = sourceContent.slice(0, 14000);
    const notesExcerpt = notesContent ? `\n\n=== USER NOTES (incorporate where relevant; do not hallucinate beyond source) ===\n${notesContent.slice(0, 4000)}` : "";

    // Anki-style prompt: front = question/prompt, back = answer. Keep title/explanation/example/checkpoint for backwards compat
    const prompt = `
You are an expert educator creating ANKI-STYLE flashcards.

Source label: ${sourceLabel}
Total content length: ${totalLen} chars
Cards to generate: EXACTLY ${cardCount}

===== CORE PRINCIPLES (Anki-style) =====
- Each card tests ONE atomic fact/concept (front = single question, back = concise answer).
- Front must be answerable without seeing the back; back must be self-contained.
- Use cloze-friendly phrasing where useful but keep front as natural question.
- Avoid vague fronts like "What is X?" with essay-length backs — keep backs to 1-3 sentences + optional minimal example.
- Order cards from foundational → advanced (dependency order).

===== SOURCE GROUNDING =====
- For PDF sources you have CHUNKED content with [Page X | Chunk N | Section Y] labels. For each card, set "chunkLabel" to the closest chunk label and "pageStart"/"pageEnd" if present. For YouTube, use [Xs] timestamp for "timestamp".
- Every card's content must be VERIFIABLE in the source excerpt — do not invent facts.
- If a concept appears mainly in USER NOTES, you MAY include it but must ensure it is consistent with source; prefer source-backed cards.

===== NOTES INTEGRATION =====
${notesContent ? `- User notes excerpt provided below — WEAVE important points from notes into cards (e.g., their phrasing, gaps, examples). If notes emphasize a subtopic, allocate 1-2 cards to it.` : `- No user notes — base purely on source.`}

===== OUTPUT FORMAT =====
Return ONLY valid JSON. No markdown fences.
{
  "topic": "exact topic name from the source (e.g. 'React Hooks', 'Thermodynamics: Entropy')",
  "cards": [
    {
      "id": "1",
      "front": "Anki front — atomic question/prompt (e.g. 'When should you use useMemo vs useCallback?')",
      "back": "Anki back — concise answer that would pass if recalled (1-3 sentences)",
      "title": "Short concept name (e.g. 'useMemo vs useCallback')",
      "explanation": "2-3 sentence WHY it matters (pedagogy)",
      "example": "Minimal concrete code or real-world example from source",
      "checkpoint": "Self-check question (often same as front but can be deeper)",
      "timestamp": 123,
      "chunkLabel": "Page 3 | Chunk 2 | Section: Hooks",
      "pageStart": 3,
      "pageEnd": 3
    }
  ]
}

Rules:
- Generate EXACTLY ${cardCount} cards — one per major important concept (no filler).
- Cover ALL hooks, APIs, formulas, definitions, or theorems mentioned — do not skip.
- "front" must be a question that tests recall; "back" must be the answer. They form an Anki pair.
- Keep "front" under 160 chars, "back" under 320 chars.
- "example" must be minimal and match source context.
- For PDF chunks, use real chunk/page labels; for YT, provide "timestamp" integer seconds from [Xs] tags if present.
- Ensure all keys double-quoted, escape internal quotes.

Source excerpt (${sourceContent.length} chars total):
${excerpt}${notesExcerpt}
`.trim();

    const result = await callAI({
      systemPrompt: 'You are an expert coding educator. Return ONLY valid JSON matching the specified Anki flashcard format.',
      userPrompt: prompt,
      jsonMode: true,
      maxTokens: 8192,
      tier: 'fast',
    });
    const data = parseAiJson<{ topic: string; cards: Flashcard[] }>(result.content);

    if (!data.cards || data.cards.length === 0) {
      throw new Error("AI returned no flashcards");
    }

    // Normalize to Anki pair: ensure front/back exist, mirror from title/checkpoint if missing
    const normalized = data.cards.map((card: any, idx: number) => {
      const front = card.front || card.checkpoint || card.title || `Concept ${idx + 1}`;
      const back = card.back || card.explanation || card.example || "";
      const id = card.id || String(idx + 1);
      // Attach page hints by proximity if not set
      let pageStart = card.pageStart;
      let pageEnd = card.pageEnd;
      let chunkLabel = card.chunkLabel;
      if (!chunkLabel && pageHints.length > 0) {
        const hint = pageHints[idx % pageHints.length];
        chunkLabel = hint.chunkLabel;
        pageStart = pageStart ?? hint.pageStart;
        pageEnd = pageEnd ?? hint.pageEnd;
      }
      return { ...card, id, front, back, chunkLabel, pageStart, pageEnd };
    });

    // Dual-model verification (lightweight, non-blocking for assignment)
    const verifiedCards = await Promise.all(normalized.map(async (card) => {
      try {
        const verifyPrompt = `Verify if this Anki card is grounded in source.\n\nFront (question): ${card.front}\nBack (answer): ${card.back}\nCheckpoint: ${card.checkpoint}\n\nSource excerpt:\n${excerpt.slice(0, 6000)}\n\nRespond with JSON: { "confidenceScore": number (0-100), "reasoning": "string" }`;
        const verifyResult = await callAI({
          systemPrompt: 'You are a meticulous fact-checker. Return ONLY valid JSON.',
          userPrompt: verifyPrompt,
          jsonMode: true,
          maxTokens: 400,
          tier: 'budget',
        });
        const verifyData = parseAiJson<{ confidenceScore: number; reasoning: string }>(verifyResult.content);
        return { ...card, confidenceScore: verifyData.confidenceScore };
      } catch {
        return card;
      }
    }));

    // Persist if we have a sourceId
    if (sourceId && source) {
      try {
        const { userId } = await auth();
        if (userId) {
          await createFlashcardSet({
            sourceId,
            userId,
            cards: verifiedCards as any,
            promptVersion: 'anki-v2-chunks+notes',
            model: result.model,
          });
        }
      } catch (e) {
        console.warn('[flashcards] persist failed', e);
      }
    }

    return NextResponse.json({ topic: (data as any).topic || source?.title || 'Flashcards', cards: verifiedCards, sourceId: sourceId || null });
  } catch (error) {
    console.error('[flashcards] error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate flashcards" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sourceId = searchParams.get('sourceId');
    if (!sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { getFlashcardSetBySource } = await import('@/lib/db/flashcards');
    const set = await getFlashcardSetBySource(sourceId);
    if (!set) return NextResponse.json({ cards: [], topic: null });
    const { parseFlashcards } = await import('@/lib/db/flashcards');
    const cards = parseFlashcards(set);
    return NextResponse.json({ cards, topic: null, setId: set.$id });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load flashcards' }, { status: 500 });
  }
}
