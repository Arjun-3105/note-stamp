import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSource, updateSourceStatus } from '@/lib/db/sources';
import { calculateInputHash, normalizeText, extractMetadata, isEducationalContent } from '@/lib/ingestion/helpers';
import { extractUrlContent } from '@/lib/ingestion/url-extract';
import { z } from 'zod';
import { saveLocalTranscript } from '@/lib/local-db';
import { chunkSections, saveSourceChunks } from '@/lib/source-chunks';

const RequestSchema = z.object({
  url: z.string(),
  workspaceId: z.string(),
});

/**
 * POST /api/ingest/url
 * Extract article content from URL (Readability first, ScrapeGraphAI fallback when needed)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { url, workspaceId } = RequestSchema.parse(body);

    let extracted;
    try {
      extracted = await extractUrlContent(url);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch URL content' },
        { status: 400 }
      );
    }

    const normalizedText = normalizeText(extracted.transcript);

    if (!isEducationalContent(normalizedText)) {
      return NextResponse.json(
        {
          error: 'URL content does not appear to be educational',
          hint: 'Please share URLs to educational articles, tutorials, or documentation',
        },
        { status: 400 }
      );
    }

    const inputHash = calculateInputHash(normalizedText);
    const metadata = {
      ...extractMetadata(normalizedText, 'url'),
      sourceUrl: extracted.fetchedUrl,
      domain: new URL(extracted.fetchedUrl).hostname,
      extractor: extracted.extractor,
      sectionCount: extracted.sections.length,
    };

    const source = await createSource({
      workspaceId,
      userId,
      sourceType: 'url',
      title: extracted.title,
      url: extracted.fetchedUrl,
      inputHash,
      metadata,
    });

    await saveLocalTranscript(source.$id, extracted.transcript);
    await saveSourceChunks(
      source.$id,
      chunkSections(source.$id, extracted.sections, { documentTitle: extracted.title })
    );

    await updateSourceStatus(source.$id, 'ready', `data/transcripts/${source.$id}.txt`);

    return NextResponse.json({
      sourceId: source.$id,
      title: extracted.title,
      url: extracted.fetchedUrl,
      wordCount: metadata.wordCount,
      textLength: extracted.transcript.length,
      extractor: extracted.extractor,
      sectionCount: extracted.sections.length,
      message: 'URL content imported successfully',
    });
  } catch (error) {
    console.error('URL ingest error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to ingest URL content' },
      { status: 500 }
    );
  }
}
