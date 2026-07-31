import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { fetchRepoFiles } from "@/lib/github";
import { callAI } from "@/lib/ai";
import { parseAiJson } from "@/lib/json";

/* ── event shape ───────────────────────────────────────────────────────── */
export type ScanEvent =
  | { type: "init";              repoOwner: string; repoName: string }
  | { type: "tree_start" }
  | { type: "file_found";        path: string; size: number }
  | { type: "tree_done";         count: number }
  | { type: "security_start" }
  | { type: "security_check";   check: string; status: "pass" | "warn" | "fail"; message: string }
  | { type: "checkpoint_start"; index: number; requirement: string }
  | { type: "ai_start" }
  | { type: "ai_done" }
  | { type: "result";            data: AssessResult }
  | { type: "error";             message: string };

type AssessResult = {
  score: number; passed: boolean;
  checklist: { requirement: string; met: boolean; comment: string }[];
  strengths: string[]; gaps: string[]; nextTopic: string; overallFeedback: string;
};

function parseRepoUrl(url: string) {
  const cleaned = url.replace("https://github.com/", "").replace(".git", "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo) throw new Error("Invalid GitHub URL");
  return { owner, repo };
}

function enc(event: ScanEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    repoUrl?: string;
    assignment?: { title?: string; requirements?: string[]; checkpoints?: string[] };
    accessToken?: string;
  };

  const { repoUrl, assignment, accessToken } = body;

  const jar         = await cookies();
  const cookieToken = jar.get("gh_token")?.value;
  const token       = cookieToken ?? accessToken;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ScanEvent) => controller.enqueue(new TextEncoder().encode(enc(e)));

      try {
        if (!repoUrl || !assignment?.title) {
          send({ type: "error", message: "repoUrl and assignment are required" });
          controller.close(); return;
        }

        const { owner, repo } = parseRepoUrl(repoUrl);
        send({ type: "init", repoOwner: owner, repoName: repo });

        /* ── 1. Fetch tree ───────────────────────────────────────────── */
        send({ type: "tree_start" });

        const headers: HeadersInit = {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // Fetch raw tree first so we can stream file-found events
        const treeRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
          { headers }
        );
        if (!treeRes.ok) {
          // Try master branch fallback
          const treeResFallback = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
            { headers }
          );
          if (!treeResFallback.ok) {
            send({ type: "error", message: `Cannot access repo tree (${treeRes.status})` });
            controller.close(); return;
          }
        }

        const treeJson = await (await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
          { headers }
        ).catch(() =>
          fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`, { headers })
        )).json();

        const CODE_EXTS = [
          ".html", ".css", ".js", ".ts", ".jsx", ".tsx",
          ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx",
          ".rs", ".go", ".java", ".kt", ".swift", ".cs",
          ".py", ".rb", ".php", ".lua", ".sh", ".bash",
          ".json", ".yaml", ".yml", ".toml", ".sql", ".md",
        ];

        // ── Detect assignment language from title + requirements ──────────
        const assignmentText = [
          assignment.title ?? "",
          ...(assignment.requirements ?? []),
          ...(assignment.checkpoints ?? []),
        ].join(" ").toLowerCase();

        const LANG_SIGNATURES: { exts: string[]; keywords: string[] }[] = [
          { exts: [".cpp", ".cc", ".cxx", ".c", ".h", ".hpp", ".hxx"], keywords: ["c++", "cpp", "c language", "#include", "iostream", "bubble sort", "pointer", "vector<", "std::"] },
          { exts: [".py"],                                               keywords: ["python", "def ", "import ", "pip", "django", "flask"] },
          { exts: [".java"],                                             keywords: ["java", "public class", "public static void main", "spring"] },
          { exts: [".rs"],                                               keywords: ["rust", "fn main", "cargo", "println!"] },
          { exts: [".go"],                                               keywords: ["golang", "go lang", "func main", "package main"] },
          { exts: [".js", ".ts", ".jsx", ".tsx"],                        keywords: ["javascript", "typescript", "react", "node", "express", "npm"] },
          { exts: [".html", ".css"],                                     keywords: ["html", "css", "webpage", "dom", "stylesheet"] },
        ];

        // Score each language group by how many keywords appear in the assignment text
        const langScores = LANG_SIGNATURES.map(sig => ({
          exts: sig.exts,
          score: sig.keywords.filter(kw => assignmentText.includes(kw)).length,
        }));
        const bestLang = langScores.reduce((a, b) => b.score > a.score ? b : a, langScores[0]);
        const priorityExts = bestLang.score > 0 ? bestLang.exts : [];

        // Filter all matching blobs
        const allCodeBlobs: { path: string }[] = (treeJson.tree ?? []).filter(
          (f: { type: string; path: string }) =>
            f.type === "blob" &&
            !f.path.includes("node_modules") &&
            !f.path.includes(".next") &&
            !f.path.includes("dist/") &&
            !f.path.includes("vendor/") &&
            !f.path.includes(".min.") &&
            CODE_EXTS.some((ext) => f.path.endsWith(ext))
        );

        // Sort: priority language files first, then everything else
        const codeBlobs: { path: string }[] = [
          ...allCodeBlobs.filter(f => priorityExts.some(e => f.path.endsWith(e))),
          ...allCodeBlobs.filter(f => !priorityExts.some(e => f.path.endsWith(e))),
        ].slice(0, 20);

        /* ── 2. Security scan on tree paths ─────────────────────────── */
        send({ type: "security_start" });

        const allPaths: string[] = (treeJson.tree ?? []).map((f: { path: string }) => f.path);

        const envCommitted = allPaths.some((p) => p === ".env" || p === ".env.local" || p === ".env.production");
        send({
          type: "security_check",
          check: ".env files committed",
          status: envCommitted ? "fail" : "pass",
          message: envCommitted
            ? ".env found in repo — secrets may be exposed!"
            : "No .env committed to repo",
        });

        const hasGitignore = allPaths.some((p) => p === ".gitignore");
        send({
          type: "security_check",
          check: ".gitignore present",
          status: hasGitignore ? "pass" : "warn",
          message: hasGitignore ? ".gitignore found" : "No .gitignore — consider adding one",
        });

        // package.json is only relevant for JS/TS projects
        const isCppProject = codeBlobs.some(f => [".cpp",".cc",".cxx",".c",".h",".hpp"].some(e => f.path.endsWith(e)));
        const isWebProject = codeBlobs.some(f => [".js",".ts",".jsx",".tsx",".html"].some(e => f.path.endsWith(e)));

        if (isWebProject && !isCppProject) {
          const pkgJson = allPaths.some((p) => p === "package.json");
          send({
            type: "security_check",
            check: "package.json",
            status: pkgJson ? "pass" : "warn",
            message: pkgJson ? "package.json found" : "No package.json detected",
          });
        }

        if (isCppProject) {
          const hasMakefile = allPaths.some((p) => p === "Makefile" || p === "CMakeLists.txt");
          send({
            type: "security_check",
            check: "Build file",
            status: hasMakefile ? "pass" : "warn",
            message: hasMakefile ? "Makefile / CMakeLists.txt found" : "No Makefile or CMakeLists.txt — consider adding one",
          });
        }

        const hasReadme = allPaths.some((p) => p.toLowerCase() === "readme.md");
        send({
          type: "security_check",
          check: "README.md",
          status: hasReadme ? "pass" : "warn",
          message: hasReadme ? "README.md found" : "No README.md — consider adding one",
        });

        /* ── 3. Fetch file contents + stream file_found ──────────────── */
        const fileContents = await Promise.all(
          codeBlobs.map(async (f) => {
            const res = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/${f.path}`,
              { headers }
            );
            if (!res.ok) return null;
            const data = await res.json();
            if (!data?.content) return null;
            const content = Buffer.from(data.content, "base64").toString("utf-8");
            send({ type: "file_found", path: f.path, size: content.length });
            return { path: f.path, content };
          })
        );

        const files = fileContents.filter((f): f is { path: string; content: string } => f !== null);
        send({ type: "tree_done", count: files.length });

        /* ── 4. Stream checkpoint "checking" events ──────────────────── */
        const checkpointsToEval = [
          ...(assignment.requirements ?? []),
          ...(assignment.checkpoints ?? []),
        ];

        for (let i = 0; i < checkpointsToEval.length; i++) {
          send({ type: "checkpoint_start", index: i, requirement: checkpointsToEval[i] });
          // Small delay so the UI can render each one before AI comes back
          await new Promise((r) => setTimeout(r, 120));
        }

        /* ── 5. AI assessment ────────────────────────────────────────── */
        send({ type: "ai_start" });

        const codeBlock = files
          .map((f) => `--- ${f.path} ---\n${f.content}`)
          .join("\n\n")
          .slice(0, 7000);

        const prompt = `
You are a strict but fair coding evaluator. Evaluate EVERY requirement and checkpoint against the actual code evidence provided.

Assignment Title: ${assignment.title}
Requirements:
${(assignment.requirements ?? []).map((r, i) => `${i + 1}. ${r}`).join("\n")}
${(assignment.checkpoints ?? []).length > 0 ? `\nCheckpoints:\n${(assignment.checkpoints ?? []).map((c, i) => `${i + 1}. ${c}`).join("\n")}` : ""}

Student code (${files.length} files, ${owner}/${repo}):
${codeBlock}

IMPORTANT: Return ONLY valid JSON. Every requirement AND checkpoint must appear in the checklist.
{
  "score": number,
  "passed": boolean,
  "checklist": [{ "requirement": "exact text", "met": true|false, "comment": "specific evidence from code or why it failed" }],
  "strengths": ["specific thing they did well with file reference"],
  "gaps": ["specific thing missing with suggestion"],
  "nextTopic": "string",
  "overallFeedback": "2-3 sentence honest summary"
}
Score >= 70 means passed: true.
`;

        const aiResult = await callAI({ systemPrompt: 'You are a strict but fair coding evaluator. Return ONLY valid JSON.', userPrompt: prompt, jsonMode: true, tier: 'mid' });
        const data = parseAiJson<AssessResult>(aiResult.content);
        send({ type: "ai_done" });
        send({ type: "result", data });

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Scan failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

