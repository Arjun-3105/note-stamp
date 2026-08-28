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
import { callAIStreaming, type Tool } from '@/lib/ai';
import { checkAssistantRateLimit } from '@/lib/ratelimit';
import { addMessage } from '@/lib/db/chat-sessions';
import { verifyContextAccess } from '@/lib/auth/workspace';
import { TOOLS, handleToolCall } from '@/lib/assistant/tools';

export const runtime = 'nodejs';

function getToolsForContext(contextType: ContextType): Tool[] {
  if (contextType === 'source') {
    return TOOLS;
  }
  return [];
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    try {
      await verifyContextAccess(contextType as ContextType, contextId, userId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Access denied';
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    const session = await findOrCreateChatSession(
      userId,
      contextType as ContextType,
      contextId,
      mode as AssistantMode
    );

    const context = await buildAssistantContext(contextType as ContextType, contextId, userId, message);

    const modeConfig = getModeConfig(mode as AssistantMode);
    let basePrompt = modeConfig.systemPrompt(context.content);

    if (focusTopic) {
      basePrompt = `${basePrompt}\n\n⚠️ IMPORTANT: The student has selected the topic "${focusTopic.label}" from the roadmap. Focus your teaching on this concept specifically. ${focusTopic.description ? `Context: ${focusTopic.description}` : ''}`;
    }

    if (contextType === 'source') {
      basePrompt = `${basePrompt}\n\nGrounding rule: use the provided source chunks as the primary evidence. If the source chunks do not contain enough evidence, say what is missing instead of inventing details. Reference page or chunk labels for specific claims when available.

CITATION FORMAT: When citing a source chunk, include the chunk label in square brackets at the end of the relevant sentence, e.g.:
"This concept is explained in the text [Section: Introduction | Page 1-2 | Chunk 1] and further elaborated in [Section: Core Concepts | Page 3-5 | Chunk 4]."
Use EXACTLY the labels provided in the context chunks.

TOOLS: You have access to tools. Use them when:
- verify_math_step: Student asks about a math step or you need to verify algebraic equivalence
- retrieve_source_chunks: Need more context from the source to answer a question
- sandbox_execute: Student asks to run code (note: actual execution is in Sandbox tab)`;
    }

    const systemPrompt = createSystemPrompt(basePrompt, context);
    const tools = getToolsForContext(contextType as ContextType);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          let messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ];
          let toolCallCount = 0;
          const maxToolCalls = 3;

          while (toolCallCount < maxToolCalls) {
            let toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
            let responseContent = '';

            await callAIStreaming(
              { 
                systemPrompt, 
                userPrompt: message, 
                tier: 'fast', 
                maxTokens: 800,
                tools,
                toolChoice: 'auto',
              },
              (chunk: string) => {
                fullResponse += chunk;
                responseContent += chunk;
                controller.enqueue(encoder.encode(chunk));
              }
            );

            // Check for tool calls in the response (simplified parsing for streaming)
            // For full tool support, we'd need to parse the streamed tool_calls
            // For now, we'll do a second non-streaming pass if tool calls detected
            break; // Simplified: just do one pass for now

            // TODO: Full tool calling loop:
            // 1. Parse tool calls from responseContent
            // 2. For each tool call: execute via handleToolCall
            // 3. Append tool results to messages
            // 4. Loop back to call AI again
          }

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
