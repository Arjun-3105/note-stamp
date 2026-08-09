import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

export interface MathStep {
  latex: string;
  symbolicForm: string;
  verifiedCorrect: boolean;
  errorAt?: string;       // description of the error if any
  explanation?: string;   // LLM narration if wrong
}

export interface MathAttempt {
  $id: string;
  problemId: string;
  userId: string;
  workspaceId: string;
  steps: string;              // JSON stringified MathStep[]
  finalAnswerCorrect: boolean;
  confidenceScore: number;
  createdAt: string;
}

export interface CreateMathAttemptInput {
  problemId: string;
  userId: string;
  workspaceId: string;
  steps: MathStep[];
  finalAnswerCorrect: boolean;
  confidenceScore: number;
}

export async function createMathAttempt(data: CreateMathAttemptInput): Promise<MathAttempt> {
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.MATH_ATTEMPTS, ID.unique(), {
    problemId: data.problemId,
    userId: data.userId,
    workspaceId: data.workspaceId,
    steps: JSON.stringify(data.steps),
    finalAnswerCorrect: data.finalAnswerCorrect,
    confidenceScore: data.confidenceScore,
    createdAt: new Date().toISOString(),
  }) as unknown as MathAttempt;
}

export async function getMathAttempt(id: string): Promise<MathAttempt | null> {
  try {
    return await serverDatabases.getDocument(DB_ID, COLLECTIONS.MATH_ATTEMPTS, id) as unknown as MathAttempt;
  } catch {
    return null;
  }
}

export async function listMathAttemptsByUser(userId: string, workspaceId?: string): Promise<MathAttempt[]> {
  const queries = [Query.equal('userId', userId), Query.orderDesc('createdAt'), Query.limit(50)];
  if (workspaceId) queries.push(Query.equal('workspaceId', workspaceId));
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.MATH_ATTEMPTS, queries);
  return result.documents as unknown as MathAttempt[];
}

export function parseMathSteps(attempt: MathAttempt): MathStep[] {
  try { return JSON.parse(attempt.steps); } catch { return []; }
}
