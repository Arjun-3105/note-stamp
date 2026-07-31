import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  findOrCreateChatSession,
  ContextType,
  AssistantMode,
} from '@/lib/db/chat-sessions';
import {
  getModeConfig,
  buildAssistantContext,
  createSystemPrompt,
} from '@/lib/assistant';
import { callAI } from '@/lib/ai';

/**
 * POST /api/ai/assistant/hint
 * Get a quiz hint without the full answer
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, contextType, contextId } = await req.json();

    // Validate inputs
    if (!message || !contextType || !contextId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Force quiz_hint mode
    const mode: AssistantMode = 'quiz_hint';

    // Find or create chat session
    const session = await findOrCreateChatSession(
      userId,
      contextType as ContextType,
      contextId,
      mode
    );

    // Build context (should be quiz attempt)
    const context = await buildAssistantContext(contextType as ContextType, contextId);

    // Get hint mode config
    const modeConfig = getModeConfig(mode);
    const systemPrompt = createSystemPrompt(
      modeConfig.systemPrompt(context.content),
      context
    );

    // Get hint (non-streaming)
    const response = await callAI({
      systemPrompt,
      userPrompt: message,
      tier: 'fast',
      maxTokens: 500,
    });

    // Save to session (async, non-blocking)
    (async () => {
      try {
        await (await import('@/lib/db/chat-sessions')).addMessage(
          session.$id,
          'user',
          message,
          mode,
          'text'
        );
        await (await import('@/lib/db/chat-sessions')).addMessage(
          session.$id,
          'assistant',
          response.content,
          mode,
          'text'
        );
      } catch (err) {
        console.error('Failed to save messages:', err);
      }
    })();

    return NextResponse.json({
      hint: response.content,
      sessionId: session.$id,
    });
  } catch (error) {
    console.error('Hint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

