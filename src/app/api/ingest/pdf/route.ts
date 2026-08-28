import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSource, updateSourceStatus } from '@/lib/db/sources';
import { calculateInputHash, normalizeText, extractMetadata, isEducationalContent } from '@/lib/ingestion/helpers';
import { extractPdfPages } from '@/lib/ingestion/pdf-pages';
import { saveLocalTranscript } from '@/lib/local-db';
import { chunkPages, saveSourceChunks } from '@/lib/source-chunks';
import { saveSourcePages } from '@/lib/source-pages';

/**
 * POST /api/ingest/pdf
 * Extract text from uploaded PDF file
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspaceId') as string;

    if (!file || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing file or workspaceId' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extracted;
    try {
      extracted = await extractPdfPages(buffer);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse PDF. File may be corrupted or use unsupported format.' },
        { status: 400 }
      );
    }

    const structuredText = extracted.fullText;
    const normalizedText = normalizeText(structuredText);

    if (!isEducationalContent(normalizedText)) {
      return NextResponse.json(
        {
          error: 'PDF does not appear to contain educational content',
          hint: 'Please upload academic materials, tutorials, or educational documents',
        },
        { status: 400 }
      );
    }

    const inputHash = calculateInputHash(normalizedText);
    const pageCount = extracted.pageCount;
    const metadata = {
      ...extractMetadata(normalizedText, 'pdf'),
      pages: pageCount,
      fileName: file.name,
      fileSize: file.size,
    };

    const source = await createSource({
      workspaceId,
      userId,
      sourceType: 'pdf',
      title: file.name.replace('.pdf', ''),
      inputHash,
      metadata,
    });

    await saveLocalTranscript(source.$id, structuredText);
    await saveSourcePages(source.$id, extracted.pages);
    await saveSourceChunks(source.$id, chunkPages(source.$id, extracted.pages));

    await updateSourceStatus(source.$id, 'ready', `data/transcripts/${source.$id}.txt`);

    return NextResponse.json({
      sourceId: source.$id,
      title: source.title,
      pageCount,
      wordCount: metadata.wordCount,
      textLength: structuredText.length,
      message: 'PDF imported successfully',
    });
  } catch (error) {
    console.error('PDF ingest error:', error);
    return NextResponse.json(
      { error: 'Failed to ingest PDF' },
      { status: 500 }
    );
  }
}
