import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchRepoFiles } from "@/lib/github";
import { callAI } from "@/lib/ai";
import { parseAiJson } from "@/lib/json";

function parseRepoUrl(repoUrl: string) {
  const cleaned = repoUrl.replace("https://github.com/", "").replace(".git", "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid GitHub repository URL");
  }
  return { owner, repo };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      repoUrl,
      assignment,
      accessToken,
    } = body as {
      repoUrl?: string;
      assignment?: { title?: string; requirements?: string[] };
      accessToken?: string;
    };

    if (!repoUrl || !assignment?.title || !assignment?.requirements?.length) {
      return NextResponse.json({ error: "repoUrl and assignment are required" }, { status: 400 });
    }

    // Prefer the httpOnly cookie token over anything passed in the body
    const jar          = await cookies();
    const cookieToken  = jar.get("gh_token")?.value;
    const tokenToUse   = cookieToken ?? accessToken;

    const { owner, repo } = parseRepoUrl(repoUrl);
    const files = await fetchRepoFiles(owner, repo, tokenToUse);
    const codeBlock = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n").slice(0, 7000);

    const prompt = `
You are a strict but fair coding evaluator.
Evaluate requirement-by-requirement against actual code evidence.
If a requirement is backend/API related, explicitly check routes, HTTP methods, body validation, and response structure.

Assignment Title: ${assignment.title}
Requirements:
${assignment.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Student code:
${codeBlock}

IMPORTANT: Return ONLY valid JSON. Ensure all keys are quoted with double quotes. Escape any internal quotes in values.
Expected Format:
{
  "score": number,
  "passed": boolean,
  "checklist": [{ "requirement": "exact requirement text", "met": true, "comment": "brief comment" }],
  "strengths": ["string"],
  "gaps": ["string"],
  "nextTopic": "string",
  "overallFeedback": "2-3 sentence summary"
}
Score >= 70 means passed true.
`;

    const result = await callAI({ systemPrompt: 'You are a strict but fair coding evaluator. Return ONLY valid JSON.', userPrompt: prompt, jsonMode: true, tier: 'mid' });
    const data = parseAiJson(result.content);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to assess repository" },
      { status: 500 }
    );
  }
}

