import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

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
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.QUIZ_ATTEMPTS, ID.unique(), {
    sourceId: data.sourceId,
    userId: data.userId,
    questions: JSON.stringify(data.questions),
    answers: JSON.stringify(data.answers),
    score: data.score,
    passed: data.score >= 70,
    takenAt: new Date().toISOString(),
  }) as unknown as QuizAttempt;
}

export async function getQuizAttempt(attemptId: string): Promise<QuizAttempt | null> {
  try {
    return await serverDatabases.getDocument(
      DB_ID,
      COLLECTIONS.QUIZ_ATTEMPTS,
      attemptId
    ) as unknown as QuizAttempt;
  } catch {
    return null;
  }
}

export async function listQuizAttemptsBySource(sourceId: string): Promise<QuizAttempt[]> {
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.QUIZ_ATTEMPTS, [
    Query.equal('sourceId', sourceId),
    Query.orderDesc('takenAt'),
  ]);
  return result.documents as unknown as QuizAttempt[];
}

export async function listQuizAttemptsByUser(
  userId: string,
  sourceId?: string
): Promise<QuizAttempt[]> {
  const queries = [Query.equal('userId', userId), Query.orderDesc('takenAt')];
  if (sourceId) queries.push(Query.equal('sourceId', sourceId));
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.QUIZ_ATTEMPTS, queries);
  return result.documents as unknown as QuizAttempt[];
}

export async function getHighestQuizScore(sourceId: string, userId: string): Promise<number> {
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.QUIZ_ATTEMPTS, [
    Query.equal('sourceId', sourceId),
    Query.equal('userId', userId),
    Query.orderDesc('score'),
    Query.limit(1),
  ]);
  if (result.documents.length === 0) return 0;
  return (result.documents[0] as unknown as QuizAttempt).score;
}

export function parseQuizQuestions(attempt: QuizAttempt): QuizQuestion[] {
  try { return JSON.parse(attempt.questions); } catch { return []; }
}

export function parseQuizAnswers(attempt: QuizAttempt): number[] {
  try { return JSON.parse(attempt.answers); } catch { return []; }
}

