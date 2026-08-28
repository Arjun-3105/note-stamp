import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { callAI } from '@/lib/ai';
import { parseAiJson } from '@/lib/json';
import { getSource } from '@/lib/db/sources';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as {
      sourceId: string;
      question: string;
      expectedAnswer: string;
      userAnswer: string;
      markingRubric: Array<{ criterion: string; marks: number; whatToCheck: string }>;
      steps?: Array<{ title: string; instruction: string; hint: string }>;
      type?: string;
    };

    if (!body.sourceId || !body.question || !body.userAnswer) {
      return NextResponse.json({ error: 'sourceId, question, userAnswer required' }, { status: 400 });
    }

    const source = await getSource(body.sourceId);
    if (!source || source.userId !== userId) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const totalMarks = (body.markingRubric || []).reduce((s, r) => s + (r.marks || 0), 0) || 10;

    const prompt = `
You are a maths-simulator style evaluator with suggestive teaching.

Question: ${body.question}
Expected answer: ${body.expectedAnswer}
User answer: ${body.userAnswer}
Type: ${body.type || 'mcq'}
Marking rubric (total ${totalMarks} marks):
${(body.markingRubric || []).map(r => `- ${r.criterion} (${r.marks} marks): ${r.whatToCheck}`).join('\n')}
Steps scaffold: ${(body.steps || []).map(s => s.title + ': ' + s.instruction).join(' | ')}

Tasks:
1) Grade each criterion (0 to marks awarded) with brief justification.
2) Assign total score and percentage.
3) If not full marks, provide suggestive teaching: what principle was missed, a targeted hint to fix, and the correct step they should revise — DO NOT just give the answer away if score >40%; scaffold instead.
4) Identify the weakest concept to revisit.

Return ONLY valid JSON:
{
  "criterionResults": [{"criterion":"...","awarded":2,"max":3,"feedback":"..."}],
  "totalAwarded": 7,
  "totalMax": 10,
  "percentage": 70,
  "isCorrect": false,
  "overallFeedback": "2-3 sentence encouraging feedback",
  "suggestiveTeaching": "what to review and how — specific, actionable (use Socratic hint if partial)",
  "nextStep": "concrete next micro-action (e.g. redo step 2 with hint X)",
  "weakConcept": "string"
}
`.trim();

    const result = await callAI({
      systemPrompt: 'You are a strict but encouraging evaluator with step-marks. Return ONLY valid JSON.',
      userPrompt: prompt,
      jsonMode: true,
      maxTokens: 1200,
      tier: 'fast',
    });

    const data = parseAiJson<any>(result.content);
    return NextResponse.json(data);
  } catch (e) {
    console.error('[practice/verify] error', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to verify' }, { status: 500 });
  }
}
