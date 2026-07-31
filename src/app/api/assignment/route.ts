import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { parseAiJson } from "@/lib/json";

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json() as { transcript?: string };

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    const excerpt = transcript.slice(0, 12_000);

    const prompt = `
You are a strict technical instructor. Analyze this video transcript and determine whether it primarily teaches a practical coding tutorial (hands-on) or general/theoretical concepts (e.g., career advice, tech news, soft skills).

If it is a hands-on coding tutorial, set "isCodingVideo": true and design ONE practical coding assignment that forces the learner to use the SPECIFIC techniques taught in the video.
If it is NOT a hands-on coding tutorial (e.g. it's Physics, Math, Chemistry, or general knowledge), set "isCodingVideo": false and design ONE Knowledge Quiz based on the key concepts in the video.

IMPORTANT: Return ONLY valid JSON. Ensure all keys are quoted with double quotes. Escape any internal quotes in values.
Expected Format:
{
  "isCodingVideo": boolean,
  "title": "Assignment title",
  "description": "3-4 sentences description (If STEM, mention that the quiz includes numerical applications)",
  "track": "frontend | backend | fullstack",
  "requirements": [ "string" ], // ONLY if isCodingVideo is true — high-level functional requirements
  "checkpoints": [ "string" ], // ONLY if isCodingVideo is true — AUTOMATED SCAN CHECKPOINTS (see rules below)
  "hint": "string",
  "topic": "string", // the main SUBJECT of the video — e.g. "React Hooks", "Calculus Integration", "Quantum Mechanics". NEVER write "Quiz", "Assignment", or "Coding Challenge" here.
  "starterIdea": "string", // ONLY if isCodingVideo is true
  "quiz": [ // ONLY if isCodingVideo is false
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answerIndex": number
    }
  ]
}

Rules for coding assignments (isCodingVideo = true):
- Requirements (4-5 items): high-level features the project must have. Name EXACT hooks, methods, patterns from the video.
- Checkpoints (5-7 items): MACHINE-VERIFIABLE checks an AI can run against the raw source code.
  Each checkpoint must be a CONCRETE grep-style question such as:
  · "File index.html exists with a <form> element containing at least 2 <input> fields"
  · "A CSS rule using flexbox or grid is applied to the form layout"
  · "JavaScript file contains an addEventListener call for the 'submit' event"
  · "Form prevents default submission with event.preventDefault()"
  · "At least one input field has the 'required' attribute set"
  · "A fetch() or XMLHttpRequest call is present for sending form data"
  · "Error message element is shown or hidden based on validation result"
  Checkpoints must be specific enough that a code reviewer can say YES or NO by reading the files.
- Frontend assignments: must produce a visible interactive UI
- Backend assignments: must specify exact endpoints and HTTP methods
- Result must be valid JSON only

Transcript (${transcript.length} chars total):
${excerpt}
`;

    const result = await callAI({ systemPrompt: 'You are a strict technical instructor. Return ONLY valid JSON.', userPrompt: prompt, jsonMode: true, maxTokens: 2048, tier: 'fast' });
    const data = parseAiJson<{
      isCodingVideo: boolean;
      title: string;
      description: string;
      track: "frontend" | "backend" | "fullstack";
      requirements?: string[];
      checkpoints?: string[];
      hint: string;
      topic: string;
      starterIdea?: string;
      quiz?: { question: string; options: string[]; answerIndex: number }[];
    }>(result.content);

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate assignment" },
      { status: 500 }
    );
  }
}

