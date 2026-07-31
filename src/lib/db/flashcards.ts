import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

export interface Flashcard {
  id?: string;
  front?: string;
  back?: string;
  title?: string;
  explanation?: string;
  example?: string;
  checkpoint?: string;
  timestamp?: number;
  confidenceScore?: number;
}

export interface FlashcardSet {
  $id: string;
  sourceId: string;
  userId: string;
  cards: string; // JSON stringified Flashcard[]
  promptVersion: string;
  model: string;
  generatedAt: string;
}

export interface CreateFlashcardSetInput {
  sourceId: string;
  userId: string;
  cards: Flashcard[];
  promptVersion: string;
  model: string;
}

export async function createFlashcardSet(data: CreateFlashcardSetInput): Promise<FlashcardSet> {
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.FLASHCARD_SETS, ID.unique(), {
    sourceId: data.sourceId,
    userId: data.userId,
    cards: JSON.stringify(data.cards),
    promptVersion: data.promptVersion,
    model: data.model,
    generatedAt: new Date().toISOString(),
  }) as unknown as FlashcardSet;
}

export async function getFlashcardSet(setId: string): Promise<FlashcardSet | null> {
  try {
    return await serverDatabases.getDocument(
      DB_ID,
      COLLECTIONS.FLASHCARD_SETS,
      setId
    ) as unknown as FlashcardSet;
  } catch {
    return null;
  }
}

export async function getFlashcardSetBySource(sourceId: string): Promise<FlashcardSet | null> {
  try {
    const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.FLASHCARD_SETS, [
      Query.equal('sourceId', sourceId),
      Query.orderDesc('generatedAt'),
      Query.limit(1),
    ]);
    return (result.documents[0] as unknown as FlashcardSet) || null;
  } catch {
    return null;
  }
}

export function parseFlashcards(set: FlashcardSet): Flashcard[] {
  try {
    return JSON.parse(set.cards);
  } catch {
    return [];
  }
}

export async function deleteFlashcardSet(setId: string): Promise<void> {
  await serverDatabases.deleteDocument(DB_ID, COLLECTIONS.FLASHCARD_SETS, setId);
}

