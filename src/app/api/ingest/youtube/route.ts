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
 * Fetch transcript from YouTube
 */
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  try {
    const transcripts = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });

    return transcripts
      .map((t: any) => `[${Math.floor(t.offset)}s] ${t.text}`)
      .join('\n')
      .trim();
  } catch (error) {
    console.error('Failed to fetch transcript:', error);
    throw new Error('Could not fetch YouTube transcript. Video may not have captions.');
  }
}

/**
 * Fetch YouTube video metadata
 */
async function fetchYouTubeMetadata(videoId: string): Promise<{ title: string; metadata: YouTubeMetadata }> {
  // Use YouTube oEmbed for basic metadata (no API key needed)
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
        // oEmbed doesn't provide duration, so we'll fetch it separately if YouTube API key is available
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

    // Fetch transcript
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

    // Save full transcript locally
    await saveLocalTranscript(source.$id, normalizedTranscript);
    await saveSourceChunks(source.$id, chunkTextByWords(source.$id, normalizedTranscript));

    // Store transcript to Appwrite Storage (in production)
    // For now, we'll store it as document text
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
