import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  findOrCreateChatSession,
  type ContextType,
  type AssistantMode,
} from '@/lib/db/chat-sessions';
import {
  getModeConfig,
  buildAssistantContext,
  createSystemPrompt,
} from '@/lib/assistant';
import { callAIStreaming } from '@/lib/ai';
import { checkAssistantRateLimit } from '@/lib/ratelimit';
import { addMessage } from '@/lib/db/chat-sessions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Per-user rate limiting: 20 requests/minute
    const rateLimit = await checkAssistantRateLimit(userId);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'rate_limited', retryAfter: rateLimit.reset },
        { status: 429 }
      );
    }

    const { message, contextType, contextId, mode, focusTopic } = await req.json();

    if (!message || !contextType || !contextId || !mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find or create persistent chat session
    const session = await findOrCreateChatSession(
      userId,
      contextType as ContextType,
      contextId,
      mode as AssistantMode
    );

    // Build context from source/quiz/roadmap data
    const context = await buildAssistantContext(contextType as ContextType, contextId);

    // Build mode-specific system prompt
    const modeConfig = getModeConfig(mode as AssistantMode);
    let basePrompt = modeConfig.systemPrompt(context.content);

    // If the user has selected a specific topic from the roadmap, narrow the focus
    if (focusTopic) {
      basePrompt = `${basePrompt}\n\n⚠️ IMPORTANT: The student has selected the topic "${focusTopic.label}" from the roadmap. Focus your teaching on this concept specifically. ${focusTopic.description ? `Context: ${focusTopic.description}` : ''}`;
    }

    const systemPrompt = createSystemPrompt(basePrompt, context);

    // Stream AI response back to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';

          await callAIStreaming(
            { systemPrompt, userPrompt: message, tier: 'fast', maxTokens: 800 },
            (chunk: string) => {
              fullResponse += chunk;
              controller.enqueue(encoder.encode(chunk));
            }
          );

          // Persist both messages async after stream completes
          void Promise.all([
            addMessage(session.$id, 'user', message, mode as AssistantMode, 'text'),
            addMessage(session.$id, 'assistant', fullResponse, mode as AssistantMode, 'text'),
          ]).catch(err => console.error('[chat] Failed to save messages:', err));

          controller.close();
        } catch (error) {
          console.error('[chat] Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[chat] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
