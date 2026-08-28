import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

export type ContextType = 'source' | 'quiz' | 'roadmap' | 'problem';
export type AssistantMode = 'teacher' | 'corrector' | 'quiz_hint' | 'roadmap_guide' | 'problem_solver';
export type InputType = 'text' | 'voice';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode: AssistantMode;
  inputType: InputType;
}

export interface ChatSession {
  $id: string;
  userId: string;
  contextType: ContextType;
  contextId: string;
  messages: string; // JSON stringified ChatMessage[]
  mode: AssistantMode;
  inputType: InputType;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatSessionInput {
  userId: string;
  contextType: ContextType;
  contextId: string;
  mode: AssistantMode;
}

export async function createChatSession(data: CreateChatSessionInput): Promise<ChatSession> {
  const now = new Date().toISOString();
  const { data: doc, error } = await supabaseServer
    .from(TABLES.CHAT_SESSIONS)
    .insert({
      userId: data.userId,
      contextType: data.contextType,
      contextId: data.contextId,
      messages: JSON.stringify([]),
      mode: data.mode,
      inputType: 'text',
      summary: null,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create chat session: ${error.message}`);
  return mapDoc<ChatSession>(doc);
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.CHAT_SESSIONS)
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<ChatSession>(data);
  } catch {
    return null;
  }
}

export async function findOrCreateChatSession(
  userId: string,
  contextType: ContextType,
  contextId: string,
  mode: AssistantMode
): Promise<ChatSession> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.CHAT_SESSIONS)
      .select('*')
      .eq('userId', userId)
      .eq('contextType', contextType)
      .eq('contextId', contextId)
      .eq('mode', mode)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return mapDoc<ChatSession>(data);
    }
  } catch {
    // fall through to create
  }
  return createChatSession({ userId, contextType, contextId, mode });
}

export function parseMessages(session: ChatSession): ChatMessage[] {
  try { return JSON.parse(session.messages); }
  catch { return []; }
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  mode: AssistantMode,
  inputType: InputType
): Promise<ChatSession> {
  const session = await getChatSession(sessionId);
  if (!session) throw new Error('Chat session not found');

  const messages = parseMessages(session);
  const now = new Date().toISOString();

  messages.push({ role, content, timestamp: now, mode, inputType });

  // Compress history when it exceeds 30 messages
  let summary = session.summary;
  if (messages.length > 30 && !summary) {
    const oldMessages = messages.splice(0, 20);
    summary = `Previous ${oldMessages.length} messages covering ${mode} mode discussion.`;
  }

  let msgsToSave = messages.slice(-50);
  let stringified = JSON.stringify(msgsToSave);
  while (stringified.length >= 48000 && msgsToSave.length > 2) {
    msgsToSave.shift(); // Remove oldest message
    stringified = JSON.stringify(msgsToSave);
  }

  const { data: doc, error } = await supabaseServer
    .from(TABLES.CHAT_SESSIONS)
    .update({
      messages: stringified,
      inputType,
      updatedAt: now,
      ...(summary && { summary }),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update chat session messages: ${error.message}`);
  return mapDoc<ChatSession>(doc);
}

export async function updateChatSessionMode(
  sessionId: string,
  mode: AssistantMode
): Promise<ChatSession> {
  const { data: doc, error } = await supabaseServer
    .from(TABLES.CHAT_SESSIONS)
    .update({
      mode,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update chat session mode: ${error.message}`);
  return mapDoc<ChatSession>(doc);
}

export async function clearChatSessionMessages(sessionId: string): Promise<ChatSession> {
  const { data: doc, error } = await supabaseServer
    .from(TABLES.CHAT_SESSIONS)
    .update({
      messages: JSON.stringify([]),
      summary: null,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to clear chat session messages: ${error.message}`);
  return mapDoc<ChatSession>(doc);
}
