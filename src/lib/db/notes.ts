import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

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
  const { data: doc, error } = await supabaseServer
    .from(TABLES.NOTES)
    .insert({
      sourceId: data.sourceId,
      userId: data.userId,
      title: data.title,
      content: data.content,
      tags: data.tags || [],
      wordCount: calculateWordCount(data.content),
      updatedAt: now,
      createdAt: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create note: ${error.message}`);
  return mapDoc<Note>(doc);
}

export async function getNote(noteId: string): Promise<Note | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.NOTES)
      .select('*')
      .eq('id', noteId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<Note>(data);
  } catch {
    return null;
  }
}

export async function listNotesBySource(sourceId: string): Promise<Note[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.NOTES)
    .select('*')
    .eq('sourceId', sourceId)
    .order('updatedAt', { ascending: false });

  if (error || !data) return [];
  return mapDoc<Note[]>(data);
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

  const { data: doc, error } = await supabaseServer
    .from(TABLES.NOTES)
    .update(updateData)
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update note: ${error.message}`);
  return mapDoc<Note>(doc);
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLES.NOTES)
    .delete()
    .eq('id', noteId);

  if (error) throw new Error(`Failed to delete note: ${error.message}`);
}
