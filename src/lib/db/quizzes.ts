import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizAttempt {
  $id: string;
  sourceId: string;
  userId: string;
  questions: string; // JSON stringified QuizQuestion[]
  answers: string;   // JSON stringified number[]
  score: number;
  passed: boolean;
  takenAt: string;
}

export interface CreateQuizAttemptInput {
  sourceId: string;
  userId: string;
  questions: QuizQuestion[];
  answers: number[];
  score: number;
}

export async function createQuizAttempt(data: CreateQuizAttemptInput): Promise<QuizAttempt> {
  const { data: doc, error } = await supabaseServer
    .from(TABLES.QUIZ_ATTEMPTS)
    .insert({
      sourceId: data.sourceId,
      userId: data.userId,
      questions: JSON.stringify(data.questions),
      answers: JSON.stringify(data.answers),
      score: data.score,
      passed: data.score >= 80,
      takenAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create quiz attempt: ${error.message}`);
  return mapDoc<QuizAttempt>(doc);
}

export async function getQuizAttempt(attemptId: string): Promise<QuizAttempt | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.QUIZ_ATTEMPTS)
      .select('*')
      .eq('id', attemptId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<QuizAttempt>(data);
  } catch {
    return null;
  }
}

export async function listQuizAttemptsBySource(sourceId: string): Promise<QuizAttempt[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.QUIZ_ATTEMPTS)
    .select('*')
    .eq('sourceId', sourceId)
    .order('takenAt', { ascending: false });

  if (error || !data) return [];
  return mapDoc<QuizAttempt[]>(data);
}

export async function listQuizAttemptsByUser(
  userId: string,
  sourceId?: string
): Promise<QuizAttempt[]> {
  let query = supabaseServer
    .from(TABLES.QUIZ_ATTEMPTS)
    .select('*')
    .eq('userId', userId);

  if (sourceId) {
    query = query.eq('sourceId', sourceId);
  }

  const { data, error } = await query.order('takenAt', { ascending: false });

  if (error || !data) return [];
  return mapDoc<QuizAttempt[]>(data);
}

export async function getHighestQuizScore(sourceId: string, userId: string): Promise<number> {
  const { data, error } = await supabaseServer
    .from(TABLES.QUIZ_ATTEMPTS)
    .select('score')
    .eq('sourceId', sourceId)
    .eq('userId', userId)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return 0;
  return data.score;
}

export function parseQuizQuestions(attempt: QuizAttempt): QuizQuestion[] {
  try { return JSON.parse(attempt.questions); } catch { return []; }
}

export function parseQuizAnswers(attempt: QuizAttempt): number[] {
  try { return JSON.parse(attempt.answers); } catch { return []; }
}
