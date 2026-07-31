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
  processUploadedFile,
  formatUploadedContent,
} from '@/lib/assistant';
import { callAI } from '@/lib/ai';

/**
 * POST /api/ai/assistant/upload
 * Upload a problem (image/PDF) and get help solving it
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userDescription = formData.get('description') as string;
    const contextId = formData.get('contextId') as string;

    if (!file || !contextId) {
      return NextResponse.json(
        { error: 'Missing file or contextId' },
        { status: 400 }
      );
    }

    // Force problem_solver mode
    const mode: AssistantMode = 'problem_solver';
    const contextType: ContextType = 'problem';

    // Find or create session
    const session = await findOrCreateChatSession(userId, contextType, contextId, mode);

    // Process uploaded file
    let fileContent = '';
    try {
      const result = await processUploadedFile(file, userId);
      fileContent = formatUploadedContent(result.type, result.content);
    } catch (error) {
      return NextResponse.json(
        { error: `File processing failed: ${error}` },
        { status: 400 }
      );
    }

    // Build base context
    const context = await buildAssistantContext(contextType, contextId);

    // Get problem solver mode config
    const modeConfig = getModeConfig(mode);
    const basePrompt = modeConfig.systemPrompt(context.content);

    // Combine with file content and user description
    const systemPrompt = `${basePrompt}\n\n---\n\n${fileContent}`;
    const userPrompt = userDescription || 'Help me solve this problem step by step.';

    // Get help
    const response = await callAI({
      systemPrompt,
      userPrompt,
      tier: 'mid', // Use good model for problem solving
      maxTokens: 2000,
    });

    // Save to session (async, non-blocking)
    (async () => {
      try {
        await (await import('@/lib/db/chat-sessions')).addMessage(
          session.$id,
          'user',
          `Uploaded problem: ${file.name}\n${userDescription || '(No description)'}`,
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
      solution: response.content,
      sessionId: session.$id,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

