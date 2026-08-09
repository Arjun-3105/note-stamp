import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { callAI } from '@/lib/ai';

const RequestSchema = z.object({
  prevStep: z.string().min(1),     // LaTeX of the previous step (or problem statement)
  currentStep: z.string().min(1),  // LaTeX of the step being verified
  problemContext: z.string().optional(), // Full problem text for LLM narration context
});

/**
 * Converts a LaTeX string to an infix form that Algebrite can parse.
 * This is a lightweight transformation — Algebrite accepts most standard
 * math notation but not full LaTeX.
 */
function latexToAlgebrite(latex: string): string {
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\^/g, '^')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * POST /api/math/verify-step
 *
 * Uses Algebrite (symbolic CAS) to check if currentStep is algebraically
 * equivalent to prevStep. If wrong, narrates the error via LLM.
 *
 * Architecture principle from spec:
 *   Algebrite decides correctness → LLM only narrates the result.
 *   The LLM is never allowed to decide whether math is right or wrong.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { prevStep, currentStep, problemContext } = RequestSchema.parse(body);

    // Dynamically import Algebrite (CommonJS module)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Algebrite = (await import('algebrite')).default ?? (await import('algebrite'));

    const prevInfix = latexToAlgebrite(prevStep);
    const currInfix = latexToAlgebrite(currentStep);

    let algebriteCorrect = false;
    let symbolicForm = currInfix;
    let algebriteError: string | null = null;

    try {
      // Simplify the difference: if (A - B) == 0, they are equivalent
      const diff = Algebrite.run(`simplify(${currInfix} - (${prevInfix}))`);
      algebriteCorrect = diff === '0';

      // Also capture the canonical form of the current step
      symbolicForm = Algebrite.run(`simplify(${currInfix})`);
    } catch (err) {
      // If Algebrite can't parse, fall back to string equality
      algebriteError = err instanceof Error ? err.message : String(err);
      algebriteCorrect = prevInfix === currInfix;
    }

    let explanation: string | undefined;

    if (!algebriteCorrect) {
      // LLM narrates only — it does not decide correctness
      const narratePrompt = `A student is solving a math problem step by step.

${problemContext ? `Problem context: ${problemContext}\n` : ''}Previous step (LaTeX): ${prevStep}
Current step (LaTeX): ${currentStep}

A symbolic algebra system has determined these two expressions are NOT algebraically equivalent.
Explain in 2-3 clear sentences WHY this step is incorrect and what the student likely did wrong.
Be specific: name the algebraic rule they violated (e.g. "distributing incorrectly", "sign error", "factoring mistake").
Do NOT give the correct answer — just explain the error.`;

      try {
        const result = await callAI({
          systemPrompt: 'You are a math tutor. Explain algebra errors concisely and specifically.',
          userPrompt: narratePrompt,
          tier: 'budget',
          maxTokens: 200,
        });
        explanation = result.content;
      } catch {
        explanation = 'The current step is not algebraically equivalent to the previous step. Please review your algebra.';
      }
    }

    return NextResponse.json({
      correct: algebriteCorrect,
      symbolicForm,
      explanation,
      debug: algebriteError ? { algebriteError } : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 });
    }
    console.error('[math/verify-step] error:', error);
    return NextResponse.json({ error: 'Failed to verify step' }, { status: 500 });
  }
}
