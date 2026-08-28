import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

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
  const { data: doc, error } = await supabaseServer
    .from(TABLES.MATH_ATTEMPTS)
    .insert({
      problemId: data.problemId,
      userId: data.userId,
      workspaceId: data.workspaceId,
      steps: JSON.stringify(data.steps),
      finalAnswerCorrect: data.finalAnswerCorrect,
      confidenceScore: data.confidenceScore,
      createdAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create math attempt: ${error.message}`);
  return mapDoc<MathAttempt>(doc);
}

export async function getMathAttempt(id: string): Promise<MathAttempt | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.MATH_ATTEMPTS)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<MathAttempt>(data);
  } catch {
    return null;
  }
}

export async function listMathAttemptsByUser(userId: string, workspaceId?: string): Promise<MathAttempt[]> {
  let query = supabaseServer
    .from(TABLES.MATH_ATTEMPTS)
    .select('*')
    .eq('userId', userId);

  if (workspaceId) {
    query = query.eq('workspaceId', workspaceId);
  }

  const { data, error } = await query
    .order('createdAt', { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return mapDoc<MathAttempt[]>(data);
}

export function parseMathSteps(attempt: MathAttempt): MathStep[] {
  try { return JSON.parse(attempt.steps); } catch { return []; }
}
