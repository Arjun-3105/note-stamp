import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

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
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.CHAT_SESSIONS, ID.unique(), {
    userId: data.userId,
    contextType: data.contextType,
    contextId: data.contextId,
    messages: JSON.stringify([]),
    mode: data.mode,
    inputType: 'text',
    summary: null,
    createdAt: now,
    updatedAt: now,
  }) as unknown as ChatSession;
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  try {
    return await serverDatabases.getDocument(
      DB_ID,
      COLLECTIONS.CHAT_SESSIONS,
      sessionId
    ) as unknown as ChatSession;
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
    const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.CHAT_SESSIONS, [
      Query.equal('userId', userId),
      Query.equal('contextType', contextType),
      Query.equal('contextId', contextId),
      Query.equal('mode', mode),
      Query.limit(1),
    ]);
    if (result.documents.length > 0) {
      return result.documents[0] as unknown as ChatSession;
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

  // Ensure the stringified messages don't exceed Appwrite's 50,000 character limit
  let msgsToSave = messages.slice(-50);
  let stringified = JSON.stringify(msgsToSave);
  while (stringified.length >= 48000 && msgsToSave.length > 2) {
    msgsToSave.shift(); // Remove oldest message
    stringified = JSON.stringify(msgsToSave);
  }

  return serverDatabases.updateDocument(DB_ID, COLLECTIONS.CHAT_SESSIONS, sessionId, {
    messages: stringified,
    inputType,
    updatedAt: now,
    ...(summary && { summary }),
  }) as unknown as ChatSession;
}

export async function updateChatSessionMode(
  sessionId: string,
  mode: AssistantMode
): Promise<ChatSession> {
  return serverDatabases.updateDocument(DB_ID, COLLECTIONS.CHAT_SESSIONS, sessionId, {
    mode,
    updatedAt: new Date().toISOString(),
  }) as unknown as ChatSession;
}

export async function clearChatSessionMessages(sessionId: string): Promise<ChatSession> {
  return serverDatabases.updateDocument(DB_ID, COLLECTIONS.CHAT_SESSIONS, sessionId, {
    messages: JSON.stringify([]),
    summary: null,
    updatedAt: new Date().toISOString(),
  }) as unknown as ChatSession;
}

