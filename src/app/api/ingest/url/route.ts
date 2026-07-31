import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSource, updateSourceStatus } from '@/lib/db/sources';
import { calculateInputHash, normalizeText, extractMetadata, isEducationalContent } from '@/lib/ingestion/helpers';
import { z } from 'zod';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const RequestSchema = z.object({
  url: z.string(),
  workspaceId: z.string(),
});

/**
 * POST /api/ingest/url
 * Scrape and extract content from URL
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let { url, workspaceId } = RequestSchema.parse(body);

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    // Fetch URL content
    let htmlContent: string;
    let title: string;
    let fetchedUrl: string;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${response.statusText}` },
          { status: 400 }
        );
      }

      htmlContent = await response.text();
      fetchedUrl = response.url;

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        return NextResponse.json(
          { error: 'URL must return HTML or text content' },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${error}` },
        { status: 400 }
      );
    }

    // Parse HTML and extract readable content
    let extractedText: string = '';
    try {
      const dom = new JSDOM(htmlContent, { url: fetchedUrl });
      const readability = new Readability(dom.window.document);
      const article = readability.parse();

      if (!article) {
        return NextResponse.json(
          { error: 'Could not extract readable content from URL' },
          { status: 400 }
        );
      }

      title = article.title || new URL(url).hostname;
      // Convert HTML to plain text
      extractedText = article.textContent || '';
    } catch (error) {
      console.error('Readability error:', error);
      return NextResponse.json(
        { error: 'Failed to parse HTML content' },
        { status: 400 }
      );
    }

    const normalizedText = normalizeText(extractedText);

    // Check if educational
    if (!isEducationalContent(normalizedText)) {
      return NextResponse.json(
        {
          error: 'URL content does not appear to be educational',
          hint: 'Please share URLs to educational articles, tutorials, or documentation',
        },
        { status: 400 }
      );
    }

    // Calculate hash
    const inputHash = calculateInputHash(normalizedText);

    // Extract metadata
    const metadata = {
      ...extractMetadata(normalizedText, 'url'),
      sourceUrl: fetchedUrl,
      domain: new URL(fetchedUrl).hostname,
    };

    // Create source
    const source = await createSource({
      workspaceId,
      userId,
      sourceType: 'url',
      title,
      url: fetchedUrl,
      inputHash,
      metadata,
    });

    // Update status
    await updateSourceStatus(source.$id, 'ready');

    return NextResponse.json({
      sourceId: source.$id,
      title,
      url: fetchedUrl,
      wordCount: metadata.wordCount,
      textLength: normalizedText.length,
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

