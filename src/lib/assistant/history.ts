import { ChatSession, ChatMessage, parseMessages, addMessage } from '@/lib/db/chat-sessions';
import { callAI } from '@/lib/ai';
import { AssistantMode } from '@/lib/db/chat-sessions';

/**
 * Load message history from a chat session
 */
export async function loadMessageHistory(session: ChatSession): Promise<ChatMessage[]> {
  const messages = await parseMessages(session);
  
  // Inject previous summary if it exists
  if (session.summary) {
    // Add summary as a system context (not counted in turn-by-turn history)
    console.log('Using previous conversation summary');
  }

  return messages;
}

/**
 * Format message history for context window
 */
export function formatMessageHistory(messages: ChatMessage[]): string {
  return messages
    .map((msg, idx) => {
      const role = msg.role === 'user' ? 'Student' : 'Assistant';
      return `[${idx + 1}] ${role}: ${msg.content}`;
    })
    .join('\n\n');
}

/**
 * Get recent conversation context (last N messages)
 */
export function getRecentContext(messages: ChatMessage[], windowSize: number = 5): string {
  const recent = messages.slice(-windowSize);
  return formatMessageHistory(recent);
}

/**
 * Summarize old messages when conversation gets too long
 */
export async function summarizeConversation(messages: ChatMessage[], keepLast: number = 10): Promise<string> {
  if (messages.length <= keepLast) {
    return '';
  }

  const toSummarize = messages.slice(0, -keepLast);
  const conversationText = formatMessageHistory(toSummarize);

  try {
    const summary = await callAI({
      systemPrompt: `You are an expert at summarizing conversations. Create a concise summary of this 
student-assistant conversation that captures:
1. Main topics discussed
2. Key concepts learned
3. Student's questions and understanding gaps
4. Important conclusions

Keep it brief (2-3 sentences max) but informative.`,
      userPrompt: `Summarize this conversation:\n\n${conversationText}`,
      tier: 'budget', // Use cheap model for summarization
      maxTokens: 200,
    });

    return summary.content;
  } catch (error) {
    console.error('Failed to summarize conversation:', error);
    return '';
  }
}

/**
 * Add user message and get assistant response
 */
export async function chat(
  session: ChatSession,
  userMessage: string,
  mode: AssistantMode,
  systemPrompt: string,
  tier: 'budget' | 'fast' | 'mid' | 'smart' = 'fast'
): Promise<{ response: string; updatedSession: ChatSession }> {
  // Build context with previous messages
  const messages = await loadMessageHistory(session);
  const recentContext = getRecentContext(messages, 5);

  // Build full user prompt with context
  const contextBlock = recentContext ? `\n\nPrevious context:\n${recentContext}` : '';
  const fullUserPrompt = `${userMessage}${contextBlock}`;

  // Call AI
  const response = await callAI({
    systemPrompt,
    userPrompt: fullUserPrompt,
    tier,
  });

  // Save messages to session
  const updatedSession = await addMessage(session.$id, 'user', userMessage, mode, 'text');
  const finalSession = await addMessage(updatedSession.$id, 'assistant', response.content, mode, 'text');

  return {
    response: response.content,
    updatedSession: finalSession,
  };
}

/**
 * Stream assistant response
 */
export async function chatStream(
  session: ChatSession,
  userMessage: string,
  mode: AssistantMode,
  systemPrompt: string,
  onChunk: (chunk: string) => void,
  tier: 'budget' | 'fast' | 'mid' | 'smart' = 'fast'
): Promise<{ fullResponse: string; updatedSession: ChatSession }> {
  // Build context
  const messages = await loadMessageHistory(session);
  const recentContext = getRecentContext(messages, 5);
  const contextBlock = recentContext ? `\n\nPrevious context:\n${recentContext}` : '';
  const fullUserPrompt = `${userMessage}${contextBlock}`;

  // Call streaming AI
  const { callAIStreaming } = await import('@/lib/ai');
  const response = await callAIStreaming(
    {
      systemPrompt,
      userPrompt: fullUserPrompt,
      tier,
    },
    onChunk
  );

  // Save messages
  const updatedSession = await addMessage(session.$id, 'user', userMessage, mode, 'text');
  const finalSession = await addMessage(
    updatedSession.$id,
    'assistant',
    response.content,
    mode,
    'text'
  );

  return {
    fullResponse: response.content,
    updatedSession: finalSession,
  };
}

/**
 * Check if message history is too long and needs summarization
 */
export function shouldSummarize(messages: ChatMessage[]): boolean {
  return messages.length > 30;
}

/**
 * Get conversation summary with fallback to recent messages
 */
export function getConversationSummary(session: ChatSession, messageCount: number = 5): string {
  if (session.summary) {
    return `Previous conversation: ${session.summary}`;
  }

  // Fallback: return recent messages
  const messages = JSON.parse(session.messages) as ChatMessage[];
  if (messages.length > 0) {
    return `Recent messages: ${getRecentContext(messages, messageCount)}`;
  }

  return 'No previous conversation history.';
}

