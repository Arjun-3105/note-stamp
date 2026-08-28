import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

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
  const { data: doc, error } = await supabaseServer
    .from(TABLES.FLASHCARD_SETS)
    .insert({
      sourceId: data.sourceId,
      userId: data.userId,
      cards: JSON.stringify(data.cards),
      promptVersion: data.promptVersion,
      model: data.model,
      generatedAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create flashcard set: ${error.message}`);
  return mapDoc<FlashcardSet>(doc);
}

export async function getFlashcardSet(setId: string): Promise<FlashcardSet | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.FLASHCARD_SETS)
      .select('*')
      .eq('id', setId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<FlashcardSet>(data);
  } catch {
    return null;
  }
}

export async function getFlashcardSetBySource(sourceId: string): Promise<FlashcardSet | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.FLASHCARD_SETS)
      .select('*')
      .eq('sourceId', sourceId)
      .order('generatedAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<FlashcardSet>(data);
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
  const { error } = await supabaseServer
    .from(TABLES.FLASHCARD_SETS)
    .delete()
    .eq('id', setId);

  if (error) throw new Error(`Failed to delete flashcard set: ${error.message}`);
}
