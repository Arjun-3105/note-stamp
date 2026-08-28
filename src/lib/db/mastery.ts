import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

export type MasterySource = 'quiz' | 'sandbox_trace' | 'step_verification';

export interface ConceptMastery {
  $id?: string;
  studentId: string;
  conceptId: string;
  workspaceId: string;
  masteryScore: number;     // 0–1
  stability: number;        // FSRS stability parameter (days)
  lastReviewed: string;     // ISO timestamp
  sourceOfMastery: MasterySource;
}

export interface UpsertMasteryInput {
  studentId: string;
  conceptId: string;
  workspaceId: string;
  masteryScore: number;
  stability: number;
  sourceOfMastery: MasterySource;
}

export const MASTERY_GATE_THRESHOLD = 0.7;

export async function upsertMastery(data: UpsertMasteryInput): Promise<ConceptMastery> {
  const now = new Date().toISOString();

  // Try to find existing record
  const existing = await getMastery(data.studentId, data.conceptId);

  if (existing?.$id) {
    const { data: doc, error } = await supabaseServer
      .from(TABLES.CONCEPT_MASTERY)
      .update({
        masteryScore: data.masteryScore,
        stability: data.stability,
        lastReviewed: now,
        sourceOfMastery: data.sourceOfMastery,
      })
      .eq('id', existing.$id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update concept mastery: ${error.message}`);
    return mapDoc<ConceptMastery>(doc);
  }

  const { data: doc, error } = await supabaseServer
    .from(TABLES.CONCEPT_MASTERY)
    .insert({
      studentId: data.studentId,
      conceptId: data.conceptId,
      workspaceId: data.workspaceId,
      masteryScore: data.masteryScore,
      stability: data.stability,
      lastReviewed: now,
      sourceOfMastery: data.sourceOfMastery,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create concept mastery: ${error.message}`);
  return mapDoc<ConceptMastery>(doc);
}

export async function getMastery(studentId: string, conceptId: string): Promise<ConceptMastery | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.CONCEPT_MASTERY)
      .select('*')
      .eq('studentId', studentId)
      .eq('conceptId', conceptId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<ConceptMastery>(data);
  } catch {
    return null;
  }
}

export async function listMasteryForStudent(studentId: string, workspaceId?: string): Promise<ConceptMastery[]> {
  let query = supabaseServer
    .from(TABLES.CONCEPT_MASTERY)
    .select('*')
    .eq('studentId', studentId);

  if (workspaceId) {
    query = query.eq('workspaceId', workspaceId);
  }

  const { data, error } = await query.limit(200);

  if (error || !data) return [];
  return mapDoc<ConceptMastery[]>(data);
}

/**
 * Check if all prerequisite conceptIds have mastery >= MASTERY_GATE_THRESHOLD
 * Returns true if student can proceed (gate open), false otherwise.
 */
export async function checkGate(studentId: string, prerequisiteConceptIds: string[]): Promise<boolean> {
  if (!prerequisiteConceptIds || prerequisiteConceptIds.length === 0) return true;

  const masteryList = await listMasteryForStudent(studentId);
  const masteryMap = new Map(masteryList.map(m => [m.conceptId, m.masteryScore]));

  return prerequisiteConceptIds.every(id => (masteryMap.get(id) ?? 0) >= MASTERY_GATE_THRESHOLD);
}

/**
 * Build a simple mastery summary string to inject into LLM system prompts.
 */
export function buildMasterySummary(masteryList: ConceptMastery[]): string {
  const weak = masteryList.filter(m => m.masteryScore < 0.4).map(m => m.conceptId);
  const moderate = masteryList.filter(m => m.masteryScore >= 0.4 && m.masteryScore < 0.75).map(m => m.conceptId);
  const strong = masteryList.filter(m => m.masteryScore >= 0.75).map(m => m.conceptId);
  const avgStability = masteryList.length
    ? (masteryList.reduce((s, m) => s + m.stability, 0) / masteryList.length).toFixed(1)
    : 'N/A';

  return [
    `## Student Mastery State (${masteryList.length} concepts tracked):`,
    weak.length    ? `Weak (< 40%): ${weak.slice(0, 10).join(', ')}` : null,
    moderate.length ? `Developing (40–75%): ${moderate.slice(0, 10).join(', ')}` : null,
    strong.length  ? `Mastered (> 75%): ${strong.slice(0, 10).join(', ')}` : null,
    `Avg FSRS stability: ${avgStability} days`,
  ].filter(Boolean).join('\n');
}
