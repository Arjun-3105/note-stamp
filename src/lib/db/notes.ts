import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

export interface Note {
  $id: string;
  sourceId: string;
  userId: string;
  title: string;
  content: string;
  tags?: string[];
  wordCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface CreateNoteInput {
  sourceId: string;
  userId: string;
  title: string;
  content: string;
  tags?: string[];
}

function calculateWordCount(content: string): number {
  // Strip Tiptap JSON wrapper tags and count words
  const text = content.replace(/<[^>]*>/g, '').replace(/[{}[\]"]/g, ' ');
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

export async function createNote(data: CreateNoteInput): Promise<Note> {
  const now = new Date().toISOString();
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.NOTES, ID.unique(), {
    sourceId: data.sourceId,
    userId: data.userId,
    title: data.title,
    content: data.content,
    tags: data.tags || [],
    wordCount: calculateWordCount(data.content),
    updatedAt: now,
    createdAt: now,
  }) as unknown as Note;
}

export async function getNote(noteId: string): Promise<Note | null> {
  try {
    return await serverDatabases.getDocument(
      DB_ID,
      COLLECTIONS.NOTES,
      noteId
    ) as unknown as Note;
  } catch {
    return null;
  }
}

export async function listNotesBySource(sourceId: string): Promise<Note[]> {
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.NOTES, [
    Query.equal('sourceId', sourceId),
    Query.orderDesc('updatedAt'),
  ]);
  return result.documents as unknown as Note[];
}

export async function getNoteBySource(sourceId: string): Promise<Note | null> {
  const notes = await listNotesBySource(sourceId);
  return notes.length > 0 ? notes[0] : null;
}

export async function updateNote(
  noteId: string,
  data: Partial<Omit<Note, '$id' | 'sourceId' | 'userId' | 'createdAt'>>
): Promise<Note> {
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  if (data.content) {
    updateData.wordCount = calculateWordCount(data.content);
  }

  return serverDatabases.updateDocument(
    DB_ID,
    COLLECTIONS.NOTES,
    noteId,
    updateData
  ) as unknown as Note;
}

export async function deleteNote(noteId: string): Promise<void> {
  await serverDatabases.deleteDocument(DB_ID, COLLECTIONS.NOTES, noteId);
}

