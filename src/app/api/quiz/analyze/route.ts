import { callAI } from "@/lib/ai";
import { parseAiJson } from "@/lib/json";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { topic, questions } = await req.json();

    if (!topic || !questions?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const wrongQuestions = questions.filter((q: { isCorrect: boolean }) => !q.isCorrect);
    const rightQuestions = questions.filter((q: { isCorrect: boolean }) => q.isCorrect);
    const score = Math.round((rightQuestions.length / questions.length) * 100);

    const wrongSummary = wrongQuestions
      .map((q: { question: string; options: string[]; correctAnswerIndex: number; yourAnswerIndex?: number }) =>
        `Q: ${q.question}\n  Correct: ${q.options[q.correctAnswerIndex]}\n  Student answered: ${q.yourAnswerIndex !== undefined ? q.options[q.yourAnswerIndex] : "skipped"}`
      )
      .join("\n\n");

    const rightSummary = rightQuestions
      .map((q: { question: string }) => q.question)
      .join("; ");

    const prompt = `
You are an expert learning coach analyzing a student's MCQ quiz performance on the topic: "${topic}".

Score: ${score}/100
Correct: ${rightQuestions.length}/${questions.length}

Questions answered WRONG:
${wrongSummary || "None — perfect score!"}

Questions answered CORRECTLY: ${rightSummary || "None"}

Your task: Generate a personalized learning analysis to help the student improve.

Return ONLY valid JSON in this exact format:
{
  "overallFeedback": "2-3 sentences of honest, encouraging personalized feedback based on their specific performance",
  "weaknesses": [
    {
      "concept": "short concept name extracted from the question",
      "why": "concise explanation of why the correct answer is right and why students often get this wrong",
      "studyTip": "specific actionable tip: what to read/practice to master this concept"
    }
  ],
  "strengths": ["specific thing they clearly understand, derived from questions they got right"],
  "nextTopic": "the single most important topic they should study next based on their gaps"
}

Rules:
- "weaknesses" array should have one entry per wrong question (keep it to max 6 even if more wrong)
- If all answers are correct, weaknesses = [] and give a perfect-score message in overallFeedback
- Be specific about concepts, not generic
- strengths should be derived from right questions, max 3 items
`;

    const result = await callAI({ systemPrompt: 'You are an expert learning coach. Return ONLY valid JSON.', userPrompt: prompt, jsonMode: true, tier: 'fast' });
    const data = parseAiJson(result.content);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze quiz" },
      { status: 500 }
    );
  }
}

