import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSource, updateSourceStatus } from '@/lib/db/sources';
import { calculateInputHash, normalizeText, extractMetadata, isEducationalContent } from '@/lib/ingestion/helpers';
import { z } from 'zod';

const RequestSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(50),
  workspaceId: z.string(),
});

/**
 * POST /api/ingest/text
 * Accept direct text input as a source
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, text, workspaceId } = RequestSchema.parse(body);

    const normalizedText = normalizeText(text);

    // Validate minimum content
    if (normalizedText.length < 50) {
      return NextResponse.json(
        { error: 'Text must be at least 50 characters' },
        { status: 400 }
      );
    }

    // Check if educational
    if (!isEducationalContent(normalizedText)) {
      return NextResponse.json(
        {
          error: 'Content does not appear to be educational',
          hint: 'Please provide educational content (notes, explanations, assignments, etc.)',
        },
        { status: 400 }
      );
    }

    // Calculate hash for deduplication
    const inputHash = calculateInputHash(normalizedText);

    // Extract metadata
    const metadata = {
      ...extractMetadata(normalizedText, 'text'),
      sourceType: 'manual',
    };

    // Create source
    const source = await createSource({
      workspaceId,
      userId,
      sourceType: 'text',
      title,
      inputHash,
      metadata,
    });

    // Update status
    await updateSourceStatus(source.$id, 'ready');

    return NextResponse.json({
      sourceId: source.$id,
      title,
      wordCount: metadata.wordCount,
      textLength: normalizedText.length,
      message: 'Text content added to workspace',
    });
  } catch (error) {
    console.error('Text ingest error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to ingest text content' },
      { status: 500 }
    );
  }
}

