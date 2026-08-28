import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSource } from '@/lib/db/sources';
import { getLocalTranscript } from '@/lib/local-db';
import { getSourceChunks, type SourceChunk } from '@/lib/source-chunks';
import { getSourcePages } from '@/lib/source-pages';
import { verifySourceAccess } from '@/lib/auth/workspace';

const DEFAULT_CHUNK_LIMIT = 24;
const MAX_CHUNK_LIMIT = 100;

function parsePageNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseChunkWindow(req: NextRequest, sourceType: string): { offset: number; limit: number } {
  const rawLimit = req.nextUrl.searchParams.get('chunkLimit');
  const rawOffset = req.nextUrl.searchParams.get('chunkOffset');

  const limit = rawLimit !== null
    ? (Number.isFinite(Number.parseInt(rawLimit, 10))
        ? Math.min(Math.max(Number.parseInt(rawLimit, 10), 0), MAX_CHUNK_LIMIT)
        : DEFAULT_CHUNK_LIMIT)
    : sourceType === 'pdf' ? 0 : DEFAULT_CHUNK_LIMIT;

  const offset = rawOffset !== null && Number.isFinite(Number.parseInt(rawOffset, 10))
    ? Math.max(Number.parseInt(rawOffset, 10), 0)
    : 0;

  return { offset, limit };
}

function chunkCoverage(chunks: SourceChunk[]): { startPage?: number; endPage?: number } {
  let startPage: number | undefined;
  let endPage: number | undefined;

  for (const chunk of chunks) {
    if (typeof chunk.pageStart === 'number') {
      startPage = startPage === undefined ? chunk.pageStart : Math.min(startPage, chunk.pageStart);
      endPage = endPage === undefined ? chunk.pageStart : Math.max(endPage, chunk.pageStart);
    }
    if (typeof chunk.pageEnd === 'number') {
      endPage = endPage === undefined ? chunk.pageEnd : Math.max(endPage, chunk.pageEnd);
    }
  }

  return { startPage, endPage };
}

function serializeChunk(chunk: SourceChunk) {
  return {
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    sectionTitle: chunk.sectionTitle,
    headingPath: chunk.headingPath,
  };
}

function parseMetadata(source: { metadata?: unknown }): Record<string, unknown> {
  try {
    return JSON.parse(String(source.metadata || '{}')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function fallbackPagesFromTranscript(transcript: string): Array<{ pageNumber: number; text: string }> {
  const markerPattern = /\[\[PAGE\s+(\d+)\]\]\s*/g;
  const matches = [...transcript.matchAll(markerPattern)];

  if (matches.length > 0) {
    return matches.map((match, index) => {
      const pageNumber = Number.parseInt(match[1], 10);
      const start = (match.index ?? 0) + match[0].length;
      const end = index + 1 < matches.length ? (matches[index + 1].index ?? transcript.length) : transcript.length;
      return {
        pageNumber,
        text: transcript.slice(start, end).trim(),
      };
    });
  }

  return [];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceId } = await params;
    let source;
    try {
      source = await verifySourceAccess(sourceId, userId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Access denied';
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    const requestedPage = parsePageNumber(req.nextUrl.searchParams.get('page'));
    const metadata = parseMetadata(source);
    const chunks = await getSourceChunks(sourceId);
    const text = await getLocalTranscript(sourceId);
    const { offset: chunkOffset, limit: chunkLimit } = parseChunkWindow(req, source.sourceType);
    const coverage = chunkCoverage(chunks);

    if (source.sourceType === 'pdf') {
      let pages = await getSourcePages(sourceId);
      if (pages.length === 0 && text) {
        pages = fallbackPagesFromTranscript(text);
      }

      const totalPages = pages.length || Number(metadata.pages) || 0;
      const currentPage = requestedPage ? Math.min(requestedPage, totalPages || requestedPage) : 1;
      const page =
        pages.length > 0
          ? pages.find(entry => entry.pageNumber === currentPage) ?? pages[currentPage - 1] ?? null
          : null;

      return NextResponse.json({
        sourceId,
        title: source.title,
        sourceType: source.sourceType,
        totalPages,
        currentPage: page?.pageNumber ?? currentPage,
        page: page
          ? {
              pageNumber: page.pageNumber,
              text: page.text,
            }
          : null,
        hasStructuredPages: pages.length > 0,
        needsReimport: pages.length === 0,
        totalChunks: chunks.length,
        chunks: chunks.slice(chunkOffset, chunkOffset + chunkLimit).map(serializeChunk),
        chunkCoverage: coverage,
      });
    }

    return NextResponse.json({
      sourceId,
      title: source.title,
      sourceType: source.sourceType,
      textPreview: text ? text.slice(0, 20000) : '',
      totalChunks: chunks.length,
      chunks: chunks.slice(chunkOffset, chunkOffset + chunkLimit).map(serializeChunk),
      chunkCoverage: coverage,
    });
  } catch (error) {
    console.error('Source content error:', error);
    return NextResponse.json({ error: 'Failed to load source content' }, { status: 500 });
  }
}
