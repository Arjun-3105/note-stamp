import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  findOrCreateChatSession,
  addMessage,
  type ContextType,
  type AssistantMode,
} from '@/lib/db/chat-sessions';
import {
  getModeConfig,
  buildAssistantContext,
  createSystemPrompt,
} from '@/lib/assistant';
import { callAI } from '@/lib/ai';
import { checkAssistantRateLimit } from '@/lib/ratelimit';
import { z } from 'zod';
import { verifyContextAccess } from '@/lib/auth/workspace';

/**
 * POST /api/ai/assistant/correct
 * Get corrections on notes, answers, or written work
 */

const CorrectRequestSchema = z.object({
  originalText: z.string().min(1),
  contextType: z.enum(['source', 'quiz', 'roadmap', 'problem']),
  contextId: z.string(),
  focusAreas: z.array(z.string()).optional(),
});

type CorrectRequest = z.infer<typeof CorrectRequestSchema>;

interface CorrectionResponse {
  original: string;
  corrected: string;
  feedback: string;
  improvements: string[];
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

    const body = await req.json();
    const { originalText, contextType, contextId, focusAreas } = CorrectRequestSchema.parse(body);

    // Verify user has access to this context
    try {
      await verifyContextAccess(contextType, contextId, userId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Access denied';
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    // Force corrector mode
    const mode: AssistantMode = 'corrector';

    // Find or create chat session
    const session = await findOrCreateChatSession(
      userId,
      contextType as ContextType,
      contextId,
      mode
    );

    // Build context
    const context = await buildAssistantContext(contextType as ContextType, contextId);

    // Get corrector mode config
    const modeConfig = getModeConfig(mode);
    const systemPrompt = createSystemPrompt(
      modeConfig.systemPrompt(context.content),
      context
    );

    // Build prompt for correction
    const focusText = focusAreas && focusAreas.length > 0
      ? `\n\nPlease focus on these areas: ${focusAreas.join(', ')}`
      : '';

    const userPrompt = `Please review and correct this work:\n\n"${originalText}"${focusText}\n\nProvide:
1. The corrected version
2. Feedback on what was improved
3. A list of specific improvements made`;

    // Get correction
    const response = await callAI({
      systemPrompt,
      userPrompt,
      tier: 'mid', // Use better model for quality corrections
      maxTokens: 1000,
      jsonMode: false, // Keep as text for readability
    });

    // Parse response into structured format
    let correction: CorrectionResponse = {
      original: originalText,
      corrected: '',
      feedback: '',
      improvements: [],
    };

    try {
      // Simple parsing - try to extract sections
      const lines = response.content.split('\n');
      let currentSection = '';

      for (const line of lines) {
        if (line.includes('corrected') || line.includes('Corrected')) currentSection = 'corrected';
        else if (line.includes('Feedback') || line.includes('feedback')) currentSection = 'feedback';
        else if (line.includes('Improvement') || line.includes('improvement')) currentSection = 'improvements';
        else if (currentSection === 'corrected' && line.trim()) correction.corrected += line + '\n';
        else if (currentSection === 'feedback' && line.trim()) correction.feedback += line + '\n';
        else if (currentSection === 'improvements' && line.trim())
          correction.improvements.push(line.trim().replace(/^[-*]\s*/, ''));
      }
    } catch (err) {
      // Fallback: return full response
      correction.corrected = response.content;
    }

    // Save to session async — non-blocking
    void Promise.all([
      addMessage(session.$id, 'user', `Correction request: ${originalText.substring(0, 100)}...`, mode, 'text'),
      addMessage(session.$id, 'assistant', response.content, mode, 'text'),
    ]).catch(err => console.error('[correct] Failed to save messages:', err));

    return NextResponse.json({
      ...correction,
      sessionId: session.$id,
    });
  } catch (error) {
    console.error('Correction error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

