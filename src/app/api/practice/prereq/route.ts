import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { callAI } from '@/lib/ai';
import { parseAiJson } from '@/lib/json';
import { getSource } from '@/lib/db/sources';
import { getLocalRoadmap } from '@/lib/local-db';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as {
      sourceId: string;
      sourceTitle?: string;
      mode?: 'generate' | 'submit'; // generate quiz, or submit answers for analysis
      answers?: number[]; // when submit
      questions?: Array<{ question: string; options: string[]; correctIndex: number; explanation: string; concept?: string }>;
    };

    if (!body.sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });

    const source = await getSource(body.sourceId);
    if (!source || source.userId !== userId) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    // SUBMIT path: analyze answers & suggest focus topics
    if (body.mode === 'submit' && Array.isArray(body.questions) && Array.isArray(body.answers)) {
      const qs = body.questions;
      const ans = body.answers;
      let correct = 0;
      const wrongConcepts: string[] = [];
      const correctConcepts: string[] = [];
      qs.forEach((q, i) => {
        if (ans[i] === q.correctIndex) { correct += 1; if (q.concept) correctConcepts.push(q.concept); }
        else if (q.concept) wrongConcepts.push(q.concept);
      });
      const pct = Math.round((correct / qs.length) * 100);

      const prompt = `
You are a diagnostic tutor. Student took a PREREQUISITE quiz for "${source.title}".
Score: ${pct}% (${correct}/${qs.length})

Wrong concepts: ${wrongConcepts.join(', ') || 'none'}
Correct concepts: ${correctConcepts.join(', ') || 'none'}

Questions detail:
${qs.map((q, i) => `Q${i+1} [${q.concept||'?'}]: ${q.question} — Correct: ${q.options[q.correctIndex]} — Student: ${q.options[ans[i]] ?? 'skipped'} — ${ans[i]===q.correctIndex?'CORRECT':'WRONG'}`).join('\n')}

Return ONLY valid JSON:
{
  "score": number,
  "level": "beginner|intermediate|ready",
  "overall": "2 sentence diagnostic",
  "weakTopics": [{"concept":"...","why":"...","action":"specific resource or drill"}],
  "strongTopics": ["..."],
  "nextFocus": "single most important topic to study before starting main source",
  "studyPlan": ["step1","step2","step3"]
}
`.trim();

      const result = await callAI({
        systemPrompt: 'You are a diagnostic learning coach. Return ONLY valid JSON.',
        userPrompt: prompt,
        jsonMode: true,
        maxTokens: 1000,
        tier: 'fast',
      });
      const analysis = parseAiJson<any>(result.content);
      return NextResponse.json({ mode: 'analysis', score: pct, correct, total: qs.length, analysis });
    }

    // GENERATE path: produce prereq quiz only (quiz-only currently)
    let prereqContext = '';
    try {
      const cached = await getLocalRoadmap(body.sourceId + '_prereqs', false);
      if (cached?.nodes) {
        prereqContext = (cached.nodes as any[]).map(n => `${n.label}: ${n.description}`).join('; ').slice(0, 4000);
      }
    } catch {}

    if (!prereqContext) {
      try {
        const meta = JSON.parse(source.metadata as unknown as string || '{}');
        prereqContext = meta.summary ? JSON.stringify(meta.summary).slice(0, 3000) : source.title;
      } catch { prereqContext = source.title; }
    }

    const sourceTitle = body.sourceTitle || source.title;

    const prompt = `
You are a prerequisite diagnostician. For a source titled "${sourceTitle}" (${source.sourceType}), generate a QUIZ-ONLY prerequisite check.

Context about what this source covers (derived from roadmap summary): ${prereqContext}

Goal: Assess the learner's current understanding of prerequisites BEFORE they start the source (so we can recommend what to focus on).

Requirements:
- Generate 6 quiz questions (MCQ, 4 options, 1 correct) that test FOUNDATIONAL and NEAR-PREREQUISITE knowledge needed for this source.
- Do NOT test the source's advanced content — test the building blocks (e.g., if source is "React Hooks", test JS closures, functional components, useState basics).
- Each question must have: question, options[4], correctIndex, explanation, concept (skill tag).
- Spread across easy (2), medium (2), hard (2).
- Base on this suggestive diagnostic: after quiz, we will tell learner what to focus.

Return ONLY valid JSON:
{
  "prereqTopic": "string — broader domain",
  "questions": [
    {"id":"p1","question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"...","concept":"...","difficulty":"easy|medium|hard"}
  ],
  "instructions": "string — what learner should do (2 sentences)"
}
`.trim();

    const result = await callAI({
      systemPrompt: 'You are a prerequisite assessment designer. Return ONLY valid JSON.',
      userPrompt: prompt,
      jsonMode: true,
      maxTokens: 2048,
      tier: 'fast',
    });
    const data = parseAiJson<any>(result.content);
    const questions = (data.questions || []).map((q: any, i: number) => ({
      id: q.id || `p${i + 1}`,
      question: q.question,
      options: (q.options || []).slice(0, 4),
      correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
      explanation: q.explanation || '',
      concept: q.concept || 'Prerequisite',
      difficulty: q.difficulty || (i < 2 ? 'easy' : i < 4 ? 'medium' : 'hard'),
    })).filter((q: any) => q.options.length === 4);

    return NextResponse.json({
      mode: 'quiz',
      prereqTopic: data.prereqTopic || source.title,
      questions,
      instructions: data.instructions || 'Answer without external help to get a true diagnostic.',
    });
  } catch (e) {
    console.error('[practice/prereq] error', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed prereq practice' }, { status: 500 });
  }
}
