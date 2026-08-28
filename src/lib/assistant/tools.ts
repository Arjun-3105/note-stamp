import { verifySourceAccess } from '@/lib/auth/workspace';
import { retrieveSourceChunks } from '@/lib/source-chunks';

export interface VerifyStepArgs {
  prevStep: string;
  currentStep: string;
  problemContext?: string;
}

export interface SandboxExecuteArgs {
  code: string;
  sourceId?: string;
}

export interface RetrieveChunksArgs {
  sourceId: string;
  query: string;
  limit?: number;
}

/**
 * Tool: Verify a math step using Algebrite CAS
 */
export async function verifyStepTool(args: VerifyStepArgs, userId: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/math/verify-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Verification failed' }));
    return { success: false, error: error.error || 'Verification failed' };
  }
  
  return { success: true, data: await response.json() };
}

/**
 * Tool: Execute Python code in sandbox (returns submission ID)
 */
export async function sandboxExecuteTool(args: SandboxExecuteArgs, userId: string) {
  // For sandbox, the execution happens client-side via Pyodide
  // This tool would need a server-side executor or we return a message
  // For now, we can't execute server-side, so we inform the user
  return { 
    success: false, 
    error: 'Sandbox execution must be done in the browser. Use the Sandbox tab to run Python code.' 
  };
}

/**
 * Tool: Retrieve relevant source chunks for a query
 */
export async function retrieveChunksTool(args: RetrieveChunksArgs, userId: string) {
  try {
    // Verify access first
    await verifySourceAccess(args.sourceId, userId);
    
    const chunks = await retrieveSourceChunks(args.sourceId, args.query, {
      limit: args.limit ?? 8,
      maxChars: 30000,
    });
    
    return {
      success: true,
      data: {
        chunks: chunks.map(c => ({
          chunkIndex: c.chunkIndex,
          text: c.text,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          sectionTitle: c.sectionTitle,
          headingPath: c.headingPath,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve chunks' };
  }
}

export const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'verify_math_step',
      description: 'Verify if a math step is algebraically correct using a symbolic CAS (Algebrite). Returns whether the step is correct, the simplified form, and an explanation if wrong.',
      parameters: {
        type: 'object',
        properties: {
          prevStep: { type: 'string', description: 'Previous step in LaTeX (or problem statement)' },
          currentStep: { type: 'string', description: 'Current step to verify in LaTeX' },
          problemContext: { type: 'string', description: 'Full problem context for better error explanation' },
        },
        required: ['prevStep', 'currentStep'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'retrieve_source_chunks',
      description: 'Search and retrieve relevant chunks from the current source material for a query.',
      parameters: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', description: 'ID of the source to search' },
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max chunks to return', default: 8 },
        },
        required: ['sourceId', 'query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sandbox_execute',
      description: 'Execute Python code in a sandboxed environment. Note: actual execution happens client-side via Pyodide in the Sandbox tab.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Python code to execute' },
          sourceId: { type: 'string', description: 'Optional source ID to associate with the execution' },
        },
        required: ['code'],
      },
    },
  },
];

export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  switch (toolName) {
    case 'verify_math_step':
      return verifyStepTool(args as { prevStep: string; currentStep: string; problemContext?: string }, userId);
    case 'retrieve_source_chunks':
      return retrieveChunksTool(args as { sourceId: string; query: string; limit?: number }, userId);
    case 'sandbox_execute':
      return sandboxExecuteTool(args as { code: string; sourceId?: string }, userId);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}