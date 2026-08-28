import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { callAI } from '@/lib/ai';
import { verifySourceAccess } from '@/lib/auth/workspace';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, sourceId } = await req.json();
    if (!text || !sourceId) {
      return NextResponse.json(
        { error: 'Text and sourceId required' },
        { status: 400 }
      );
    }

    // Verify user has access to this source
    try {
      await verifySourceAccess(sourceId, userId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Access denied';
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    const summary = await callAI({
      systemPrompt: 'You are an expert educator. Summarize the provided text in 1-2 sentences, capturing the key concepts.',
      userPrompt: `Summarize this text:\n\n${text}`,
      tier: 'fast',
      maxTokens: 150,
    });

    return NextResponse.json({
      summary: summary.content,
    });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json(
      { error: 'Failed to summarize text' },
      { status: 500 }
    );
  }
}

