import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSource, updateSourceStatus } from '@/lib/db/sources';
import { calculateInputHash, normalizeText, extractMetadata, isEducationalContent } from '@/lib/ingestion/helpers';
import pdf from 'pdf-parse';

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

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    let pdfData;
    try {
      pdfData = await pdf(buffer);
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to parse PDF. File may be corrupted or use unsupported format.' },
        { status: 400 }
      );
    }

    const rawText = pdfData.text || '';
    const normalizedText = normalizeText(rawText);

    // Check if educational
    if (!isEducationalContent(normalizedText)) {
      return NextResponse.json(
        {
          error: 'PDF does not appear to contain educational content',
          hint: 'Please upload academic materials, tutorials, or educational documents',
        },
        { status: 400 }
      );
    }

    // Calculate hash
    const inputHash = calculateInputHash(normalizedText);

    // Extract metadata
    const pageCount = pdfData.numpages || 0;
    const metadata = {
      ...extractMetadata(normalizedText, 'pdf'),
      pages: pageCount,
      fileName: file.name,
      fileSize: file.size,
    };

    // Create source document
    const source = await createSource({
      workspaceId,
      userId,
      sourceType: 'pdf',
      title: file.name.replace('.pdf', ''),
      inputHash,
      metadata,
    });

    // Update status to ready
    await updateSourceStatus(source.$id, 'ready');

    return NextResponse.json({
      sourceId: source.$id,
      title: source.title,
      pageCount,
      wordCount: metadata.wordCount,
      textLength: normalizedText.length,
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

