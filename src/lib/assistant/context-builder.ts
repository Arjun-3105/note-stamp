import { parseQuizQuestions, parseQuizAnswers } from '@/lib/db';
import { ContextType } from '@/lib/db/chat-sessions';

export interface AssistantContext {
  type: ContextType;
  title: string;
  content: string;
}

/**
 * Build context for assistant based on what the user is learning about.
 * Pass studentId to inject the student's mastery state into source contexts.
 */
export async function buildAssistantContext(
  contextType: ContextType,
  contextId: string,
  studentId?: string,
  query?: string
): Promise<AssistantContext> {
  switch (contextType) {
    case 'source':
      return buildSourceContext(contextId, studentId, query);
    case 'quiz':
      return buildQuizContext(contextId);
    case 'roadmap':
      return buildRoadmapContext(contextId);
    case 'problem':
      return buildProblemContext(contextId);
    default:
      return {
        type: contextType,
        title: 'Unknown Context',
        content: 'No context available',
      };
  }
}


async function buildSourceContext(sourceId: string, studentId?: string, query?: string): Promise<AssistantContext> {
  // Import here to avoid circular deps
  const { getSource } = await import('@/lib/db/sources');
  const { listNotesBySource } = await import('@/lib/db/notes');
  const { getLocalTranscript } = await import('@/lib/local-db');
  const { retrieveSourceChunks, formatChunksForPrompt } = await import('@/lib/source-chunks');

  const source = await getSource(sourceId);
  if (!source) {
    return {
      type: 'source',
      title: 'Source not found',
      content: 'The source material could not be loaded.',
    };
  }

  const notes = await listNotesBySource(sourceId);
  const notesContent = notes.map(n => n.content).join('\n\n');

  const retrievedChunks = query ? await retrieveSourceChunks(sourceId, query, { limit: 10, maxChars: 60000 }) : [];
  let sourceContent = retrievedChunks.length > 0 ? formatChunksForPrompt(retrievedChunks) : await getLocalTranscript(sourceId);
  if (!sourceContent) {
    let meta: any = {};
    try { meta = JSON.parse(source.metadata as unknown as string || '{}'); } catch {}
    if (meta.summary) {
      sourceContent = JSON.stringify(meta.summary);
    }
  }

  // Inject student mastery state if studentId is available
  let masterySummary = '';
  if (studentId) {
    try {
      const { listMasteryForStudent, buildMasterySummary } = await import('@/lib/db/mastery');
      const masteryList = await listMasteryForStudent(studentId, source.workspaceId);
      if (masteryList.length > 0) {
        masterySummary = '\n\n' + buildMasterySummary(masteryList);
      }
    } catch {
      // Mastery fetch failure is non-fatal — silently skip
    }
  }

  return {
    type: 'source',
    title: source.title,
    content: `
## Source: ${source.title}
Type: ${source.sourceType}
${source.url ? `URL: ${source.url}` : ''}

## Source Content:
${sourceContent ? sourceContent.slice(0, retrievedChunks.length > 0 ? 70000 : 120000) : '(No content available)'}

${retrievedChunks.length > 0 ? 'When answering, ground claims in the retrieved chunks above and cite page/chunk labels when useful.' : ''}

## Student Notes:
${notesContent || '(No notes yet)'}${masterySummary}
    `.trim(),
  };
}


async function buildQuizContext(quizAttemptId: string): Promise<AssistantContext> {
  const { getQuizAttempt } = await import('@/lib/db/quizzes');
  const attempt = await getQuizAttempt(quizAttemptId);

  if (!attempt) {
    return {
      type: 'quiz',
      title: 'Quiz not found',
      content: 'The quiz attempt could not be loaded.',
    };
  }

  const questions = parseQuizQuestions(attempt);
  const answers = parseQuizAnswers(attempt);

  const questionsText = questions
    .map(
      (q, i) =>
        `Question ${i + 1}: ${q.question}
Options: ${q.options.map((o, j) => `${j}: ${o}`).join(', ')}
Student's answer: ${answers[i] !== undefined ? `Option ${answers[i]}: ${q.options[answers[i]]}` : 'Not answered'}
Correct answer: Option ${q.correctIndex}: ${q.options[q.correctIndex]}
Explanation: ${q.explanation}`
    )
    .join('\n\n');

  return {
    type: 'quiz',
    title: `Quiz Attempt (Score: ${attempt.score}/100)`,
    content: `
## Quiz Details
Score: ${attempt.score}/100
Status: ${attempt.passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}

## Questions and Answers
${questionsText}
    `.trim(),
  };
}

async function buildRoadmapContext(workspaceId: string): Promise<AssistantContext> {
  const { getWorkspace } = await import('@/lib/db/workspaces');
  const { listBadgesByUser } = await import('@/lib/db/badges');

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    return {
      type: 'roadmap',
      title: 'Workspace not found',
      content: 'The workspace could not be loaded.',
    };
  }

  const badges = await listBadgesByUser(workspace.userId);
  const badgesText = badges
    .map(
      b =>
        `- ${b.type === 'micro' ? '⭐' : b.type === 'skill' ? '🏆' : '👑'} ${b.title} (${b.score}/100)`
    )
    .join('\n');

  return {
    type: 'roadmap',
    title: workspace.title,
    content: `
## Workspace: ${workspace.title}
Progress: ${workspace.completedUnits}/${workspace.totalUnits} units completed
Sources: ${workspace.sourceCount}

## Badges Earned
${badgesText || '(No badges yet)'}

## Learning Goals
Help the student understand their progress and plan their next learning steps.
    `.trim(),
  };
}

async function buildProblemContext(problemId: string): Promise<AssistantContext> {
  // This would load the uploaded problem (image/PDF) from Appwrite Storage
  // For now, return a placeholder
  return {
    type: 'problem',
    title: 'Problem',
    content: `
## Problem Context
Help the student solve this problem step by step.
Focus on teaching the underlying concepts, not just giving the answer.
    `.trim(),
  };
}

/**
 * Create full system prompt combining mode and context
 */
export function createSystemPrompt(modeSystemPrompt: string, context: AssistantContext): string {
  return modeSystemPrompt + `\n\n---\n\n${context.content}`;
}

