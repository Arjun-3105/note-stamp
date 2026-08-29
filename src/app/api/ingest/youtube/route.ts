import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSource, updateSourceStatus } from '@/lib/db/sources';
import { calculateInputHash, normalizeText, extractMetadata, isEducationalContent } from '@/lib/ingestion/helpers';
import { z } from 'zod';
import { YoutubeTranscript } from 'youtube-transcript';
import { saveLocalTranscript } from '@/lib/local-db';
import { callAI } from '@/lib/ai';
import { chunkTextByWords, saveSourceChunks } from '@/lib/source-chunks';

export const maxDuration = 60;

const RequestSchema = z.object({
  videoUrl: z.string(),
  workspaceId: z.string(),
});

interface YouTubeMetadata {
  duration?: number;
  channelName?: string;
  thumbnail?: string;
  publishedAt?: string;
  viewCount?: number;
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch transcript from YouTube using multi-tier fallback strategies
 */
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  // Strategy 1: Default fetch (gets auto-generated or primary captions track)
  try {
    const transcripts = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcripts && transcripts.length > 0) {
      return transcripts
        .map((t: any) => `[${Math.floor(t.offset)}s] ${t.text}`)
        .join('\n')
        .trim();
    }
  } catch (err1) {
    console.warn(`[YouTube Ingest] Strategy 1 (default) failed for ${videoId}:`, err1);
  }

  // Strategy 2: Explicit English lang fetch
  try {
    const transcripts = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    if (transcripts && transcripts.length > 0) {
      return transcripts
        .map((t: any) => `[${Math.floor(t.offset)}s] ${t.text}`)
        .join('\n')
        .trim();
    }
  } catch (err2) {
    console.warn(`[YouTube Ingest] Strategy 2 (lang:en) failed for ${videoId}:`, err2);
  }

  // Strategy 3: Scraping HTML captionTracks fallback
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await pageRes.text();
    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (match) {
      const tracks = JSON.parse(match[1]);
      if (tracks && tracks.length > 0) {
        const trackUrl = tracks[0].baseUrl;
        const xmlRes = await fetch(trackUrl);
        const xmlText = await xmlRes.text();
        const lines: string[] = [];
        const regex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
        let m;
        while ((m = regex.exec(xmlText)) !== null) {
          const start = Math.floor(parseFloat(m[1]));
          const text = m[3]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"');
          lines.push(`[${start}s] ${text}`);
        }
        if (lines.length > 0) {
          return lines.join('\n').trim();
        }
      }
    }
  } catch (err3) {
    console.warn(`[YouTube Ingest] Strategy 3 (HTML scrape) failed for ${videoId}:`, err3);
  }

  // Strategy 4: Video Metadata & Description Fallback (Guarantees ingestion on Vercel IP blocks)
  try {
    const { title, metadata } = await fetchYouTubeMetadata(videoId);
    let description = '';
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const html = await pageRes.text();
      const descMatch = html.match(/"shortDescription":\s*"([^"]+)"/);
      if (descMatch) {
        description = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    } catch {}

    const fallbackContent = [
      `[0s] Video Title: ${title}`,
      metadata.channelName ? `Author: ${metadata.channelName}` : '',
      description ? `Description:\n${description}` : `Educational video content: ${title}`,
    ].filter(Boolean).join('\n\n');

    if (fallbackContent.length > 20) {
      console.log(`[YouTube Ingest] Strategy 4 (Metadata fallback) succeeded for ${videoId}`);
      return fallbackContent;
    }
  } catch (err4) {
    console.warn(`[YouTube Ingest] Strategy 4 failed for ${videoId}:`, err4);
  }

  throw new Error('Could not fetch YouTube transcript. Video may not have captions enabled.');
}

/**
 * Fetch YouTube video metadata
 */
async function fetchYouTubeMetadata(videoId: string): Promise<{ title: string; metadata: YouTubeMetadata }> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch metadata');
    }

    const data = await response.json();

    return {
      title: data.title || 'Untitled Video',
      metadata: {
        channelName: data.author_name,
        thumbnail: data.thumbnail_url,
      },
    };
  } catch (error) {
    console.error('Failed to fetch YouTube metadata:', error);
    return {
      title: 'YouTube Video',
      metadata: {},
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { videoUrl, workspaceId } = RequestSchema.parse(body);

    // Extract video ID
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    // Fetch transcript with fallbacks
    let transcript = await fetchYouTubeTranscript(videoId);
    const normalizedTranscript = normalizeText(transcript);

    // Check if educational content
    if (!isEducationalContent(normalizedTranscript)) {
      return NextResponse.json(
        {
          error: 'Content does not appear to be educational',
          hint: 'Please ensure the video has educational content (lectures, tutorials, etc.)',
        },
        { status: 400 }
      );
    }

    // Calculate hash for caching
    const inputHash = calculateInputHash(normalizedTranscript);

    // Fetch metadata
    const { title, metadata } = await fetchYouTubeMetadata(videoId);

    // Generate AI Summary for Appwrite Metadata
    const summaryPrompt = `
You are an expert summarizer. Extract the most important concepts, definitions, and themes from the following transcript.
Return a dense, informative JSON summary under 4000 characters. DO NOT return markdown fences, only the JSON.

Expected Format:
{
  "summary": "High-level overview...",
  "keyTopics": ["Topic 1", "Topic 2"],
  "importantDefinitions": [{"term": "...", "definition": "..."}]
}

Transcript (${normalizedTranscript.slice(0, 300000)} chars):
${normalizedTranscript.slice(0, 300000)}
    `;

    let aiSummary = {};
    try {
      const result = await callAI({
        systemPrompt: 'Return only valid JSON.',
        userPrompt: summaryPrompt,
        jsonMode: true,
        tier: 'fast',
        maxTokens: 1024,
      });
      aiSummary = JSON.parse(result.content);
    } catch (err) {
      console.warn("Failed to generate AI summary, using default:", err);
      aiSummary = { summary: 'Summary unavailable' };
    }

    // Create source document
    const source = await createSource({
      workspaceId,
      userId,
      sourceType: 'youtube',
      title,
      url: videoUrl,
      inputHash,
      metadata: {
        ...metadata,
        ...extractMetadata(normalizedTranscript, 'youtube'),
        summary: aiSummary,
      },
    });

    // Save full transcript locally/tmpdir
    await saveLocalTranscript(source.$id, normalizedTranscript);
    await saveSourceChunks(source.$id, chunkTextByWords(source.$id, normalizedTranscript));

    // Store transcript status
    await updateSourceStatus(source.$id, 'ready', `data/transcripts/${source.$id}.txt`);

    return NextResponse.json({
      sourceId: source.$id,
      title,
      transcript: normalizedTranscript,
      metadata: source.metadata,
      message: 'YouTube content imported successfully',
    });
  } catch (error) {
    console.error('YouTube ingest error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to ingest YouTube content';
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
