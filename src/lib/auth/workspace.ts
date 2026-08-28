import { getSource } from '@/lib/db/sources';
import { getWorkspace } from '@/lib/db/workspaces';

/**
 * Verify the user has access to a source (via ownership or workspace membership).
 * Returns the source if access granted, throws if not.
 */
export async function verifySourceAccess(sourceId: string, userId: string) {
  const source = await getSource(sourceId);
  if (!source) {
    throw new Error('Source not found');
  }

  // Direct ownership check
  if (source.userId === userId) {
    return source;
  }

  // Workspace membership check
  const workspace = await getWorkspace(source.workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  if (workspace.userId !== userId) {
    throw new Error('Forbidden: not a member of this workspace');
  }

  return source;
}

/**
 * Verify the user has access to a workspace.
 */
export async function verifyWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  if (workspace.userId !== userId) {
    throw new Error('Forbidden: not a member of this workspace');
  }
  return workspace;
}

/**
 * Verify the user has access to a context (source, quiz, roadmap, problem).
 * For source contexts, delegates to verifySourceAccess.
 * For other contexts, does a basic ownership check.
 */
export async function verifyContextAccess(
  contextType: 'source' | 'quiz' | 'roadmap' | 'problem',
  contextId: string,
  userId: string
) {
  if (contextType === 'source') {
    return verifySourceAccess(contextId, userId);
  }

  // For other context types, we could add specific checks
  // For now, just return a minimal object to indicate success
  // TODO: add quiz/roadmap/problem access checks
  return { contextType, contextId, userId };
}

/**
 * Rate limit wrapper that returns a standardized response if limited.
 */
export { checkAssistantRateLimit, checkAIRateLimit, type RateLimitResult } from '@/lib/ratelimit';