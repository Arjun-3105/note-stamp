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

    const explanation = await callAI({
      systemPrompt: 'You are an expert educator. Explain the provided text in simple, clear terms. Break down complex concepts.',
      userPrompt: `Explain this text in simple terms:\n\n${text}`,
      tier: 'fast',
      maxTokens: 250,
    });

    return NextResponse.json({
      explanation: explanation.content,
    });
  } catch (error) {
    console.error('Explain error:', error);
    return NextResponse.json(
      { error: 'Failed to explain text' },
      { status: 500 }
    );
  }
}

