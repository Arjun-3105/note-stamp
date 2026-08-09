import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

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
    const doc = await serverDatabases.updateDocument(
      DB_ID, COLLECTIONS.CONCEPT_MASTERY, existing.$id,
      {
        masteryScore: data.masteryScore,
        stability: data.stability,
        lastReviewed: now,
        sourceOfMastery: data.sourceOfMastery,
      }
    );
    return doc as unknown as ConceptMastery;
  }

  return serverDatabases.createDocument(DB_ID, COLLECTIONS.CONCEPT_MASTERY, ID.unique(), {
    studentId: data.studentId,
    conceptId: data.conceptId,
    workspaceId: data.workspaceId,
    masteryScore: data.masteryScore,
    stability: data.stability,
    lastReviewed: now,
    sourceOfMastery: data.sourceOfMastery,
  }) as unknown as ConceptMastery;
}

export async function getMastery(studentId: string, conceptId: string): Promise<ConceptMastery | null> {
  try {
    const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.CONCEPT_MASTERY, [
      Query.equal('studentId', studentId),
      Query.equal('conceptId', conceptId),
      Query.limit(1),
    ]);
    return (result.documents[0] as unknown as ConceptMastery) ?? null;
  } catch {
    return null;
  }
}

export async function listMasteryForStudent(studentId: string, workspaceId?: string): Promise<ConceptMastery[]> {
  const queries = [Query.equal('studentId', studentId), Query.limit(200)];
  if (workspaceId) queries.push(Query.equal('workspaceId', workspaceId));
  const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.CONCEPT_MASTERY, queries);
  return result.documents as unknown as ConceptMastery[];
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
