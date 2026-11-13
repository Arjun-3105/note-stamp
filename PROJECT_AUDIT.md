# Notestamp / LearnLoop — Project Audit

Audit date: 2026-09-27. Scope: the whole repository at commit `7b9b0ad` (plus the uncommitted README rewrite from earlier in this session), with web research on the market.

**How this was checked**

- The audit was read-only. No source code was changed.
- Tools run:
  - `tsc --noEmit`: 11 errors
  - `eslint src`: 0 errors, 219 warnings
  - `next build`: succeeds, but only because `next.config.js` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`
- The repository has no test suite, so no tests were run.
- Nothing was run on Vercel or in a browser. Claims about Vercel behaviour come from reading the code against how the Vercel platform is documented to work.
- How findings are labelled:
  - **[D]**: demonstrable. You can see it in the code, or it was reproduced locally. For example, an Algebrite call was run in Node.
  - **[T]**: theoretical or a risk that depends on configuration.
  - **[U]**: a market claim that could not be verified.

---

# Executive Summary

**Verdict: KEEP AS A PORTFOLIO PROJECT, AND VALIDATE A NARROW WEDGE BEFORE BUILDING MORE.** Do not continue building the current broad product.

- **Product.**
  - The core loop is: import a video or PDF, then generate notes, flashcards, quizzes and a mind map, then chat with a tutor.
  - Google gives that loop away for free (NotebookLM, now "Gemini Notebook"). ChatGPT, Gemini and Claude have study or learning modes.
  - Funded startups already sell it: Quizlet, Gizmo ($22M Series A, Apr 2026), StudyFetch, Turbo AI, Knowt.
  - There are also dozens of open-source clones.
  - Nothing in the current feature set is differentiated enough to switch for.
- **The "learning passport".**
  - This is the NFT credential feature, and it is the claimed differentiator.
  - There is no employer evidence that NFT credentials are valued. The industry is standardising on Open Badges 3.0 and W3C Verifiable Credentials instead.
  - In this codebase the credential is not backed by any evidence. Quiz grading trusts answers sent by the browser. Any signed-in user can mint an NFT with any score using the server's wallet. The Passport "mint" makes up its transaction hashes.
- **Engineering.**
  - The codebase has about 26.8k lines of TypeScript and is broad and ambitious. Real work has gone into it: PDF layout cleaning, section-aware chunking, lexical retrieval, JSON repair, model-tier routing, browser-side Python tracing with Pyodide, and CAS-checked math steps.
  - It is not production-ready:
    - Every source's content is stored on the local filesystem, which does not persist on Vercel. On Vercel, importing content most likely fails outright.
    - Several routes allow path traversal and reading or writing data that belongs to other users.
    - Plan limits, usage metering and nearly all rate limiting are defined but never called.
    - There are no tests and no CI, and type errors are suppressed at build time.
- **Portfolio value.** Moderate to good, *if* it is presented honestly. It shows range: full stack, LLM integration, ingestion, a smart contract and Stripe. As it stands it also shows several red flags that a senior reviewer will spot within minutes:
  - forgeable credentials
  - a fake mint
  - a username hardcoded in the top bar
  - four sidebar links that 404
  - a random "Score" on the roadmap page
  - a large amount of dead code
- **Most promising direction (still needs validation).** Evidence-backed skill checks for self-taught or bootcamp developers, or grading at scale for course operators. Both would use standard verifiable credentials, not NFTs, and be built on server-side, deterministic grading. That is roughly the opposite of the current architecture's trust model.

---

# What The Project Actually Is

## Actual system as built

A Next.js 15 (App Router, React 18) monolith deployed to Vercel.

- **Auth:** Clerk.
- **Relational data:** Supabase Postgres, using the service-role key only, with no row-level security (RLS).
- **Source content, progress and roadmaps:** stored as JSON, JSONL or TXT files under `./data/`. That folder is gitignored.
- **AI:** OpenRouter chat completions. Models are picked by tier: budget / fast / mid / smart. The fallback order is `openai/gpt-4o-mini`, then the Gemini API directly.
- **Credentials:** an ERC-721 contract (`SkillNFT.sol`, only the owner can mint, tokens are transferable) on Sepolia. Metadata is stored through Pinata.
- **Billing:** Stripe.

## Core user flow (as coded)

1. Sign up with Clerk. A Clerk webhook creates the Supabase `users` row.
2. Create a workspace.
3. Import a source from `/import`:
   - **YouTube:** transcript via `youtube-transcript`, in English only.
   - **PDF:** `pdf-parse`, a custom page renderer, and removal of repeated headers and footers.
   - **URL:** fetch, then Readability on JSDOM, falling back to ScrapeGraph.
   - **Text:** plain pasted text.
   - The text is chunked into about 750-word chunks with overlap. Chunks, pages and the transcript are written to `data/`, and a `sources` row goes into Supabase.
4. Study in `/learn/[workspaceId]/[sourceId]`. It offers:
   - a source viewer
   - a Tiptap notes editor
   - an assistant chat (streamed; uses lexical chunk retrieval)
   - flashcards (an LLM call, then one LLM "verification" call per card)
   - a concept map or prerequisite map (LLM, cached to disk)
   - practice questions
   - a math whiteboard (MathLive, then Algebrite equivalence checking, with an LLM explanation when a step is wrong)
   - a Python sandbox (Pyodide in the browser, with a trace from `sys.settrace`)
5. Take the certification quiz (on the smart tier). For coding topics, a GitHub repo is streamed to `/api/assess-repo/stream`, and the LLM grades the first 7,000 characters of up to 20 files.
6. `quiz/submit` computes a score from the questions *and answer key sent by the client*. If the score is 80 or more, it creates a badge.
7. There are two mint paths:
   - **Mint from the quiz:** calls `/api/mint-nft`, which mints a real ERC-721 token from the server key.
   - **Mint from the Passport:** calls `/api/badges/[id]/mint`, which *simulates* a mint and stores a made-up `txHash`.

## Status by feature

| Feature | Status | Evidence |
|---|---|---|
| YouTube / PDF / URL / text import | **IMPLEMENTED locally; broken on Vercel** [D] | writes to `process.cwd()/data` in `local-db.ts`, `source-chunks.ts`, `source-pages.ts` |
| Chunking (word / page / section) | IMPLEMENTED | `src/lib/source-chunks.ts`, `src/lib/ingestion/pdf-pages.ts` |
| Lexical retrieval (no embeddings) | PARTIALLY IMPLEMENTED (chat only) | `retrieveSourceChunks` `source-chunks.ts:267`. The `source_chunks` table with a vector column is never used. |
| Model tiering and fallback | IMPLEMENTED (no timeouts or backoff) | `src/lib/ai.ts:57-111` |
| Streaming chat | PARTIALLY IMPLEMENTED | The SSE parser drops events that span two network reads (`ai.ts:152`). Only the current message is sent, so there is no conversation memory (`chat/route.ts:64-67`). |
| Assistant tool calling | MOCKED / TODO | Tools are sent, then the loop hits `break` with a TODO (`chat/route.ts:122-129`). |
| Flashcard generation | IMPLEMENTED | `api/flashcards/route.ts` |
| FSRS spaced repetition | **Not wired** (the dependency exists, but no UI uses it) | `ts-fsrs` is used only in `api/mastery/update`, which nothing calls. Review state lives only in React state (`FlashcardsView.tsx:81-83`). |
| Certification quiz | IMPLEMENTED, **grading can be forged** [D] | `quiz/submit/route.ts:33-56`, `quiz/generate/route.ts:173,196`, `QuizView.tsx:469` (a "manual override" button) |
| GitHub repo assessment | PARTIALLY IMPLEMENTED | `assess-repo/stream`: the `main` branch is effectively hardcoded, first 20 files, 7,000 characters of code, and the LLM's "passed" is trusted |
| Math step checking | PARTIALLY IMPLEMENTED | Algebrite checks whether expressions are equal. Equations using `=` break, because `=` means assignment in Algebrite. Verified by running Algebrite locally. |
| Python sandbox | IMPLEMENTED (browser only, Python only) | `CodeSandbox.tsx` runs on the main thread with no timeout. Hidden-test grading: TODO (`testResults: []`). |
| Concept and prerequisite maps | IMPLEMENTED (disk cache) | `api/concept-map`, `api/prerequisite-map` |
| Notes | IMPLEMENTED (Tiptap) | The component is named `BlockNoteEditor.tsx` but uses Tiptap. The `@blocknote/*` and `@mantine/*` packages are unused. |
| Real NFT mint | IMPLEMENTED, **anyone can call it** [D] | `api/mint-nft/route.ts`: no `auth()`, and address, topic and score come from the request body |
| Passport mint | **MOCKED** [D] | `api/badges/[badgeId]/mint/route.ts:67-69`: `tokenId = Date.now()-random`, `txHash = hex(tokenId)` |
| Public verify page `/verify/[tokenId]` | **BROKEN** [D] | fetches `/api/nft/verify/...`, and that route does not exist |
| `/profile/nft/[txHash]` | BROKEN | reads a localStorage key that nothing ever writes |
| Achievements passport UI | PARTIALLY IMPLEMENTED | hardcoded fallbacks (`score 67`, `0x8a3f...91c2`), and the Share and Download buttons have no handlers |
| Roadmap page | MOCKED | Score is `Math.floor(Math.random()*100)` (`(app)/roadmap/page.tsx:144-147`) |
| Top bar | MOCKED | Username hardcoded as `"Arjun"` (`TopBar.tsx:50`), and search and notifications do nothing |
| Sidebar | PARTIALLY IMPLEMENTED | `/notes`, `/flashcards`, `/ai-modes` and `/progress` all 404 (`Sidebar.tsx:10-14`) |
| Stripe Pro upgrade | **BROKEN** [D] | The billing page POSTs to `/api/stripe/checkout` with no body, and the route requires `priceId` |
| Plan limits and usage metering | TODO (dead code) | `limits.ts`, `checkPlanLimits`, `logUsage` and `checkAIRateLimit` have no callers |
| Paid certificate | TODO | The Stripe webhook's `charge.succeeded` handler is a `// TODO` |
| Voice input, problem image upload, quiz hint | MOCKED / dead | not imported anywhere; image analysis returns a placeholder |
| "Collaborative" math workspace (commit d56e4a2) | DOCUMENTATION-ONLY | nothing collaborative exists |
| Audio ingestion, GitHub ingestion, "Polygon" (landing page) | DOCUMENTATION-ONLY | only pdf/text/url/youtube ingest routes exist, and the chain is Sepolia |
| tldraw canvas, `/api/math/graph`, hidden tests (`newspecs.md`) | DOCUMENTATION-ONLY | absent |

> **Note on the README rewritten earlier in this session (uncommitted):** it claims a "Block-based notes editor (BlockNote)", "spaced repetition (FSRS)", "Stripe subscriptions … with a billing portal" and "Public credential verification page". Given the table above, those claims are false or overstated. The README was not changed in this audit, as instructed. Correct it before committing.

---

# Architecture Review

**Shape:** one Next.js app with about 50 route handlers. Most of them contain their own auth check, Zod validation (in some), prompt building, `callAI`, JSON parsing and DB writes. There is no service layer beyond `src/lib/db/*` and a few helpers.

| Area | Assessment |
|---|---|
| Separation of concerns | Weak. Prompts are 80–150-line template literals inside route handlers. The chain for finding a source's content (chunks → transcript → `metadata.summary`) is duplicated in 5 or more routes. The four ingest routes repeat the same 8-step skeleton. |
| Coupling | Routes are tightly coupled to the local filesystem layout (`data/…/${sourceId}.json`). |
| Storage design | **The main architectural flaw.** Postgres holds metadata, while the actual content lives on local disk (`sources.rawTextPath` points to `data/transcripts/<id>.txt`). A `source_chunks` table with a vector column already exists in `setup-db.sql` and is never used. |
| Database schema | No foreign keys: every reference is `TEXT`, while the primary keys are `UUID`. JSON is stored as `TEXT`, not `jsonb`. No CHECK constraints on enum-like columns. Indexes are missing for the queries actually run (for example `quiz_attempts(userId, takenAt)`), and some are redundant. No RLS. No migration tool: it is one SQL file you paste in by hand. |
| API design | Ad hoc. Two GitHub OAuth callback routes do the same thing. A non-streaming and a streaming repo assessment exist side by side, and the non-streaming one has no callers. About 13 routes have no reachable caller at all. |
| Queues / background work | None. LLM calls, PDF parsing and `tx.wait()` for on-chain mints all run inside the request. `vercel.json` sets 60-second limits on six paths, and one of them (`src/app/api/ingest/route.ts`) does not exist. |
| Caching | The disk cache is the only cache, and it does not persist on serverless. |
| Observability | 80 `console.*` calls. No error tracking, metrics, request IDs or structured logs. `usage_log` is never written. |
| Failure handling | Any error after `createSource` leaves the source row stuck in `processing` forever. Many `catch {}` blocks swallow errors silently. Raw upstream error text is returned to clients. |
| Frontend state | Wallet state is duplicated in each hook instance, with no shared context. Two `useProgress` instances overwrite each other's data. A `.css` file sets a dark theme, but the app layout is light, so some page titles are invisible. |

---

# Bugs & Technical Issues

Severity key: CRITICAL / HIGH / MEDIUM / LOW. Only the important findings are listed. Security findings appear here and are summarised again in the next section.

### CRITICAL

**C1. Content persistence uses the local filesystem [D]**
- Location: `src/lib/local-db.ts`, `source-chunks.ts:22,205`, `source-pages.ts:5`, `progress.ts:17`.
- Problem: transcripts, chunks, pages, roadmaps and progress are written to `process.cwd()/data`. Vercel's function filesystem is read-only apart from `/tmp`, which is per-instance and temporary.
- Impact:
  - Importing content most likely throws EROFS after the Supabase row has been inserted. The source is left in `processing`, and the YouTube route has already paid for an LLM summary by then.
  - Saving progress fails.
  - Concept maps are generated and paid for, and then fail to save.
  - Even with writes to `/tmp`, reads on another instance would find nothing.
- Fix:
  - Put raw text in Supabase Storage, chunks in the existing `source_chunks` table, and progress and roadmaps in their own tables.
  - Delete the filesystem modules.
  - Wrap ingest so a failure sets the source status to `failed`.

**C2. Anyone signed in can mint unlimited NFTs with any content, and the server wallet pays the gas [D]**
- Location: `src/app/api/mint-nft/route.ts` POST (lines 51-100).
- Problem:
  - The handler never calls `auth()`.
  - `walletAddress`, `topic` and `score` come from the request body.
  - It is not linked to any badge or attempt, has no rate limit and no idempotency.
  - It signs with `PRIVATE_KEY`, because the contract only lets the owner mint.
- Impact:
  - Anyone can drain the gas wallet.
  - Anyone can mint "passed X with score 100/100" to any address under your contract.
  - Raw ethers errors are returned to the client.
- Fix:
  - Require `auth()`.
  - Accept only a `badgeId` owned by the caller that has `passed` and no `tokenId` yet, and claim it atomically: `UPDATE … WHERE tokenId IS NULL RETURNING`.
  - Take topic and score from the database.
  - Cap mints per user.
  - Mint from a background job.

**C3. Quiz grading trusts the client, so certificates can be forged [D]**
- Location:
  - `api/quiz/generate/route.ts:173,196` sends `correctIndex` to the browser.
  - `api/quiz/submit/route.ts:33-56` grades `body.answers` against `body.questions[].correctIndex`, and trusts `body.assignmentPassed`.
  - `QuizView.tsx:463-469` has a "Manual override → I completed it ✓" button.
- Impact: every badge, mastery record and minted credential rests on a score the client chooses. This undermines the product's central claim.
- Fix:
  - Store each generated quiz on the server, keyed by a quiz ID, and send only the questions.
  - Grade against the stored answer key.
  - Derive `assignmentPassed` from a stored, server-computed assessment.
  - Remove the override button.

**C4. `POST /api/badges` creates any badge with any score [D]**
- Location: `src/app/api/badges/route.ts:43-61`. Its own comment says "for testing".
- Fix: delete the endpoint, or restrict it to admins.

**C5. Path traversal through `sourceId` into file storage [D]**
- Location:
  - `progress.ts:24` `path.join(PROGRESS_DIR, userId, \`${sourceId}.json\`)`, reached from `GET`/`POST /api/progress`.
  - `local-db.ts:47,54` (`getLocalRoadmap`/`saveLocalRoadmap`), reached from `POST /api/concept-map` and `/api/prerequisite-map`, which have no ownership check.
- Problem: a `sourceId` such as `../../package` makes the concept-map route read and return any `.json` file. It makes `POST /api/progress` write JSON the attacker controls to any writable `*.json` path, or read and overwrite another user's progress (`../<otherUserId>/<id>`).
- Where it applies: this works locally and on any host with a writable filesystem. On Vercel, writes fail for the reason in C1.
- Fix:
  - Validate IDs as UUIDs.
  - Call `verifySourceAccess` before any filesystem access.
  - Remove the filesystem layer entirely.

### HIGH

**H1. The Passport "mint" is fake but shown as on-chain [D]**
- Location: `api/badges/[badgeId]/mint/route.ts:67-69`, `(app)/passport/page.tsx:342`.
- Problem: the made-up `txHash` is shown with "✓ ON-CHAIN VERIFIED" and an Etherscan link to a transaction that does not exist. There is also a race: two concurrent calls can both "mint", because `updateBadgeMint` has no `tokenId IS NULL` guard.
- Fix: use the real mint path, or label it "Not minted" and store `null`.

**H2. SSRF in URL ingest [D; how much is reachable depends on hosting]**
- Location: `src/lib/ingestion/url-extract.ts:29` `fetchHtml`.
- Problem:
  - No scheme, host or IP allow-list, and redirects are followed.
  - The fetched text is stored and returned by `GET /api/sources/:id/content`.
  - The "educational content" filter (`ingestion/helpers.ts:49-60`) passes almost anything longer than 100 characters that contains a word like "example".
- Fix:
  - Allow only https.
  - Resolve DNS and block private, loopback, link-local and metadata IP ranges.
  - Use `redirect:'manual'` and check every hop.
  - Cap response size and return generic errors.

**H3. Missing ownership checks (IDOR) [D; the attacker needs a UUID]**
- Location:
  - `concept-map` and `prerequisite-map` have no `auth()` or ownership check.
  - `flashcards` GET has no owner filter.
  - The four ingest routes never verify `workspaceId`: `verifyWorkspaceAccess` exists and has zero callers.
  - `verifyContextAccess` (`auth/workspace.ts:51-64`) does no check for quiz, roadmap or problem contexts, so any quiz attempt, including its answers, can be loaded into another user's chat context.
- Impact:
  - Reading other users' data.
  - Planting content in someone else's workspace, which is stored prompt injection into the victim's LLM context.
  - Poisoning a victim's cached prerequisite map.
- Fix: one `requireSourceAccess` / `requireWorkspaceAccess` helper called by every route, and deny by default for unknown context types.

**H4. No row-level security, and the server client can fall back to the anon key [D schema / T exploit]**
- Location: `scripts/setup-db.sql` (no RLS on any of the 13 tables), `src/lib/supabase-server.ts:9-14`.
- Problem: when RLS is off, whoever holds the public anon key can read and write every table through PostgREST, including `users.plan`.
- Fix:
  - Enable RLS with deny-by-default on every table.
  - Require the service-role key on the server and throw if it is missing.

**H5. LLM spend is unmetered, and limits are dead code [D]**
- Problem:
  - `checkAIRateLimit`, `checkPlanLimits`, `getPlanLimits` and `logUsage` have zero callers.
  - Only `ai/assistant/chat` and `ai/assistant/correct` are rate-limited, and that limiter allows everything when the Upstash variables are missing (`ratelimit.ts:67,79`).
  - `quiz/generate` runs on the smart tier with about 60k characters in and 8,192 tokens out.
  - `flashcards` makes up to 19 LLM calls per request, and its old `transcript` path takes any text.
  - `assignment` and `quiz/analyze` call the LLM on arbitrary text and never call `auth()`.
- Impact: a simple script can run up an unbounded LLM bill. The dashboard's "tokens used" always shows 0.
- Fix: one `withAiGuard` wrapper (quota, rate limit that fails closed in production, `logUsage`), and caps on input size.

**H6. YouTube summary prompt contains the transcript twice [D]**
- Location: `api/ingest/youtube/route.ts:142-143`.
- Problem: ``Transcript (${normalizedTranscript.slice(0, 300000)} chars):`` puts the text where a `.length` was intended, then includes the text again.
- Impact: up to about 600k characters per ingest. The raw `JSON.parse` on an output capped at 1,024 tokens often fails.
- Fix: use `.length`, send a bounded excerpt, and parse with `parseAiJson`.

**H7. "Covers the entire content" is false [D]**
- Location: `buildSourceCoverageContext` (`source-chunks.ts:348`), `flashcards/route.ts:207`.
- Problem: for the local 461-chunk textbook, the coverage sampler then applies `.slice(0,60000)` and only reaches about chunk 171. Flashcards see `slice(0,14000)`, roughly the first two chunks.
- Fix: give each chunk a fixed budget, or summarise section by section (map-reduce).

**H8. Math verifier gets equations wrong and shares state between requests [D, reproduced]**
- Location: `api/math/verify-step/route.ts:63`.
- Problem:
  - `Algebrite.run(\`simplify(${curr} - (${prev}))\`)` runs on raw input.
  - `=` is assignment in Algebrite, so `2x+3=7 → x=2` is always marked wrong, and the LLM is then told to explain an "error" that isn't there.
  - The assignment persists in the module-level state that all requests share.
  - Algebrite returns syntax errors as a `"Stop: …"` string instead of throwing.
  - Unbounded input can pin the CPU.
- Fix:
  - Handle `=` by comparing `lhs - rhs` forms or solution sets.
  - Treat any result containing `Stop:` as a parse error.
  - Run `clearall` before each check.
  - Limit input length.
  - Run it in a worker with a timeout.

**H9. Chat has no memory and silently drops tool calls [D]**
- Location: `api/ai/assistant/chat/route.ts:64-67,100-130`; `ai.ts` streaming never reads `delta.tool_calls`.
- Impact: multi-turn tutoring does not work. If the model chooses a tool, the user gets an empty reply, and that empty reply is saved.
- Fix: send recent history, and stop sending tools until the tool-calling loop exists.

**H10. Lost updates on chat history [D]**
- Location: `chat/route.ts:132` runs two `addMessage` calls in parallel, and each does read → append → write on a JSON text blob (`chat-sessions.ts:103-142`). It is fire-and-forget after the stream closes.
- Fix: use a `chat_messages` table with one insert per message, or `after()`.

**H11. Stripe upgrade cannot succeed from the UI [D]**
- Location: `settings/billing/page.tsx:34` (the POST has no body); `api/stripe/checkout/route.ts` requires `priceId`. The error is swallowed in the UI.
- Also:
  - The webhook only sets Pro when status is `active` and never downgrades on `past_due`, `unpaid` or `canceled`.
  - There is no event-ID idempotency.
  - When `STRIPE_WEBHOOK_SECRET` is unset it falls back to `''` [T], so forged events would verify.
  - `returnUrl` is concatenated onto `APP_URL`, which allows an open redirect such as `@evil.com`.
  - Buying a certificate does nothing (`// TODO`).

**H12. The public verify page calls a route that doesn't exist [D]**
- Location: `verify/[tokenId]/page.tsx:15` → `/api/nft/verify/...`.
- Impact: every verification shows "Verification Failed", under a hardcoded "Blockchain Verified" label.

**H13. Progress data can be lost through a race [D]**
- Location: `hooks/useProgress.ts:48-67,104-112`.
- Problem:
  - It always posts full arrays from local state.
  - `setTotals` can fire before the initial fetch finishes and write `[]`.
  - Two hook instances overwrite each other.
- Fix: send only the changes, and wait for the initial load before saving.

### MEDIUM

- **M1. No timeouts on LLM calls** (`ai.ts:72,119`): there is no `AbortController`. Deterministic 4xx errors are re-sent to two fallback providers, and the first error is discarded. `data.choices[0]` throws when a 200 response contains an error body.
- **M2. SSE parser drops events and corrupts characters** (`ai.ts:152`): it has no carry-over buffer for a line split across reads, and it calls `decode()` without `{stream:true}`.
- **M3. Check-then-insert races:**
  - `upsertMastery` (`mastery.ts:31-65`) has no unique constraint on the key it uses.
  - `findOrCreateChatSession` can create duplicates.
  - The badge idempotency key includes the attempt ID, so every passing attempt creates a new certificate badge.
- **M4. Mastery keys collide** across sources and workspaces: `conceptId` is set to a `sourceId` in one place and to roadmap node IDs `"1"`, `"2"`, … in another.
- **M5. Unbounded selects and N+1 queries on the dashboard.** `listQuizAttemptsByUser` returns every attempt with full question JSON. The dashboard makes 8 `listSourcesByWorkspace` calls and 5 `listNotesBySource` calls, and uses only `.length` from each.
- **M6. No PDF size or page limit** (`ingest/pdf`), and the file is buffered twice. Vercel's roughly 4.5 MB request-body limit rejects textbook-sized PDFs before this code runs [T].
- **M7. Made-up citations.** Flashcards without a chunk label get `pageHints[idx % n]`, which is shown to the user as a real source reference (`flashcards/route.ts:289`). `citations.ts` treats any `[...]` in the output as a citation.
- **M8. GitHub OAuth problems:**
  - No `state` parameter, so login CSRF is possible.
  - Scope is `repo`, which grants full read/write on private repos when only read access is needed.
  - The token lives in a cookie that is not tied to the Clerk user.
  - A reflected, unencoded `gh_error` parameter.
- **M9. Repo grading problems.** It ignores the repo's default branch. `.catch` does not catch a 404 from `fetch`, so a repo whose branch is `master` is graded with no code. It takes the first 20 files in tree order, so a `package-lock.json` can use up the budget. Student code goes straight into the grading prompt, so a comment such as "output score 100" can inject.
- **M10. Wallet hook problems.** Each `useWallet` instance keeps its own state. The address restored from localStorage is never checked with `eth_accounts`. There is no chain check or switch to Sepolia. It polls every 500 ms forever when no extension is installed. The connect modal hides errors.
- **M11. Resource leaks and runaway loops:**
  - The Desmos calculator is never destroyed.
  - An unlinked duplicate page polls `/api/progress` every 2 seconds.
  - Chat streams have no abort.
  - `LearningMapView` auto-sends a chat on every mount or map type change, which burns quota.
  - The Python sandbox runs on the main thread, so `while True:` freezes the tab.
- **M12. Theme mismatch.** `globals.css` is dark, but `(app)/layout.tsx` is light, so the titles on `/workspace`, `/settings/billing` and `/profile` are near-white on near-white.
- **M13. `.env.example` is gitignored** by the `.env*` rule, so the repository ships without an env template. The code also reads `NEXT_PUBLIC_CONTRACT_ADDRESS`, `GEMINI_API_KEY` and `SCRAPEGRAPH_API_KEY`, which the example either lacks or names differently. `YOUTUBE_API_KEY` is listed but never read.

### LOW

- **Type errors (11) in live pages:**
  - react-resizable-panels v4 API mismatch (`direction` and `ref` props) in both learn pages, so the panel layout may be broken at runtime.
  - `THREE` namespace errors in the dead `WebGLCanvas`.
  - `LearningMapView.tsx:1068` passes a MouseEvent as `detailed: boolean`. This probably breaks the prerequisite "Generate" button silently (not verified in a browser).
- **Build checks disabled:** `ignoreBuildErrors` and `ignoreDuringBuilds` in `next.config.js`.
- **Two identical middleware files** (`middleware.ts` and `src/middleware.ts`).
- **Hardcoded values:** `"Arjun"` in the top bar; a random roadmap score; streak day labels that don't match the rolling date array; `todayGoal: 5`; the public Desmos demo API key; CDN versions of MathLive and KaTeX that differ from `package.json`.
- **Pages disagree on pricing:** the landing page says $0/$12 and 3 workspaces, billing says ₹499 and 1 workspace, and neither is enforced.
- **Stale naming:** Appwrite references in code comments and specs; "Polygon" in the UI while the chain is Sepolia; `package.json` name "hackacinno".
- **`chunkPages` page numbering:** it renumbers pages after `filter(Boolean)`, so one missing page shifts every later page number.
- **Notes editor saves unreliably:**
  - The unmount cleanup cancels the pending debounced save, so the last edits are lost.
  - It shows "saved" without checking `res.ok`.
  - The "Checklist" slash command inserts the literal text `"[ ] "`.

### Code quality

- **Dead code (a large amount):**
  - Unused top-level components: `AssignmentCard`, `ConceptMap` (755 lines), `NFTCard`, `QuizReportModal` (812), `ReportModal` (495), `WebGLCanvas`.
  - `learn/LearnWorkspace` (916 lines).
  - The whole `billing/*` UI.
  - Voice, hint and problem-upload components.
  - Five hooks.
  - `lib/limits.ts`, `lib/schemas/*` (five Zod schemas imported nowhere, and out of step with the code), `video-validator.ts`, and `mermaid-renderer.ts` (0 bytes).
  - About 13 API routes with no caller.
  - A 546-line duplicate of the learn page.
- **Unused dependencies:** `@blocknote/*` and `@mantine/*` (the most recent commit spent time fixing their peer dependencies), `reactflow`, `three`, `animejs`, `mermaid`, npm `mathlive` and `katex`, `@pinata/sdk`, `lucide-react`. `@upstash/redis` is imported but not declared in `package.json`.
- **Very large files:** `LearningMapView` 1,175 lines, `AssistantPanel` 1,111, `MathWhiteboard` 821, the learn page 771. The flashcards POST handler is about 230 lines and the `assess-repo/stream` `start()` is about 220.
- **Loose typing:** `: any` appears 36 times, `as any` 60 times, and there are 17 `eslint-disable` comments.
- **Git history:** 7 commits. The first is +30.6k lines, and later ones touch 82 to 226 files each. It does not read as reviewable, incremental work.
- **Repo clutter:** four root-level PNGs (about 6.4 MB) that nothing references, and all of `public/` is unreferenced.

---

# Security Review

The main problems, all present in the code:

1. **Credential integrity is broken end to end:** C2, C3, C4 and H1, plus prompt injection into repo grading (M9). *No credential this system issues is backed by evidence.* For a product whose pitch is verifiable proof of learning, this matters more than anything else.
2. **Path traversal into the file store** (C5).
3. **SSRF** in URL ingest (H2).
4. **Tenant isolation depends entirely on application code** (no RLS, H4), and that code has gaps (H3).
5. **Cost abuse** (H5, H6).
6. **Billing integrity** (H11): no downgrade on failed payment, no idempotency, an open redirect, and a webhook secret that fails open when it is not set.
7. **Operational key risk:** a raw owner EOA private key sits in serverless environment variables and holds sole mint authority. The contract has no pause, revoke or role separation, and tokens are transferable, which is odd for a credential.

**What is fine:**
- Middleware requires a Clerk session on everything except public pages and webhooks.
- Next 15.2.8 includes the fix for the middleware-bypass CVE-2025-29927.
- The Clerk webhook verifies the svix signature and fails closed.
- No secrets are committed. A search of tracked files and git history found none.
- No server secret uses a `NEXT_PUBLIC_*` name.

---

# Scalability Review

| Users | What breaks | Type |
|---|---|---|
| **10** | On Vercel, importing content and saving progress fail because the filesystem does not persist (C1). One malicious user can drain the mint wallet (C2) or run up LLM spend (H5). Chat loses messages (H10). Stripe upgrade doesn't work (H11). | Demonstrable |
| **1,000** | LLM cost has no cap and no metering, and the plan-tier limits don't exist. The dashboard payload grows with every quiz attempt (M5). Duplicate badges and mastery rows (M3). Heavy routes have no `maxDuration`, so they hit the platform default timeout. Provider 429s trigger up to 3 sequential calls with no backoff. | Demonstrable in code; how much it hurts is theoretical |
| **100,000** | Sequential scans caused by `TEXT` JSON blobs and missing composite indexes. A single owner EOA minting inside the request path will hit nonce collisions under concurrency. Lexical retrieval loads and regex-scans every chunk on every request. There is no queue for ingest or generation. There is no observability to diagnose any of this. | Theoretical but predictable |

No load testing was done, and no performance numbers are claimed.

---

# Product / Problem Validation

1. **What problem does it solve?** "Turn learning material into structured study, and prove you learned it." These are two problems bundled together: studying efficiently, and credible proof of skill.
2. **Who has it?** Students of every kind, self-taught learners, and job-seeking developers (for the proof-of-skill part).
3. **How often?** Studying: daily or weekly for students, often seasonal around exams. Proof of skill: episodic, mostly during a job search.
4. **How painful?** Studying: moderate, and already well served. Proof of skill: high for career-switchers and self-taught developers, but they don't trust new credential brands.
5. **What do people do instead?** NotebookLM/Gemini Notebook, ChatGPT, Quizlet, Anki (which has built-in FSRS), and for proof of skill: GitHub portfolios, recognised certificates (Coursera, AWS and others), and interviews.
6. **What existing products solve this?** See the competitor analysis below. The study loop is fully commoditised.
7. **Manual workarounds:** paste the material into ChatGPT or Claude and ask for flashcards, then export to Anki.
8. **Why would someone switch?** For the study loop, there is no reason today: competitors are free, have more features and carry more trusted brands. For the credential, only if employers recognised it, and there is no evidence they do.
9. **Must-have, nice-to-have, or demo?** The study loop is *nice-to-have, and replaceable for free*. The NFT passport is an *interesting demo*.
10. **Evidence people would pay?** Yes, for the category: Turbo AI is reported as profitable (press-reported, not audited), and Gizmo and StudyFetch raised Series A rounds. There is none for *this* product, which has no users, no traction data and a broken upgrade flow.
11. **Most likely first user:** a self-taught or bootcamp developer who wants a credible, shareable proof of a specific skill. Alternatively a small course or bootcamp operator who needs to grade projects at scale.
12. **Narrowest useful wedge:** see "Strongest Possible Wedge".
13. **Strongest differentiation today:** the *combination* of source-grounded study with a graded practical assessment (repo, code or math) feeding a credential. No single part is unique.
14. **Is it defensible?** No. Every component can be copied, and incumbents ship similar features. The only defensible asset would be *trust*: employers recognising the credential. That takes distribution, not code.
15. **How easy would it be for a competitor to copy?** Easy. NotebookLM already ships quizzes and flashcards, and Google just added a code-running environment to Gemini Notebook.
16. **What would keep it from being abandoned?** Only a narrow ICP with a paying buyer, most likely B2B (course operators or bootcamps), plus credentials in a standard format that employers already accept, plus grading that cannot be faked.

---

# Market Research

Research date: 2026-09-27. Prices come from official pages where they loaded. Otherwise they come from third-party sources and are marked [3p]. Items that could not be verified are marked [U].

**Big-tech free entrants (the main threat)**
- **NotebookLM, renamed "Gemini Notebook"** on 2026-07-16.
  - It has source-grounded chat, flashcards and quizzes (web in Sept 2025, mobile in Nov 2025), audio and video overviews, mind maps and a Learning Guide tutor.
  - Google says it now includes a cloud computer that can run code in each notebook.
  - Sources: https://workspaceupdates.googleblog.com/2025/09/flashcards-quizzes-reports-notebook-lm-google-education.html, https://workspaceupdates.googleblog.com/2026/07/notebooklm-now-gemini-notebook.html, https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/
  - Free tier, plus paid Google AI plans [3p]: https://elephas.app/blog/notebooklm-free-vs-plus
- **ChatGPT Study Mode** launched on 2025-07-29: https://openai.com/index/chatgpt-study-mode/. Users reported in April 2026 that it was removed or hidden [U]: https://news.ycombinator.com/item?id=47739305
- **Gemini Guided Learning** (Aug 2025): https://blog.google/products-and-platforms/products/education/guided-learning/
- **Claude learning mode** for all users (Aug 2025): https://www.engadget.com/ai/anthropic-brings-claudes-learning-mode-to-regular-users-and-devs-170018471.html. Claude for Teachers (Jul 2026): https://www.anthropic.com/news/claude-for-teachers
- **Khanmigo:** free for teachers, $4/month for learners: https://www.khanmigo.ai/pricing

**Startups with the same core loop**
- **Gizmo:** $22M Series A, April 2026, reports 13M learners: https://www.prnewswire.com/news-releases/gizmo-raises-22-million-series-a-to-make-learning-addictive-for-13-million-learners-worldwide-302741943.html
- **Turbo AI:** 5M users (company blog): https://www.turbo.ai/blog/october-2025-announcement-5-million-users. Press reports it as profitable on about $750K raised [3p, unaudited]: https://www.inc.com/diana-bocco/student-founders-entrepreneurs-ai-startup-venture-capital-funding/91380311, https://sacra.com/c/turbo-ai/
- **StudyFetch:** $11.5M Series A (Jun 2025) [3p]: https://finance.yahoo.com/news/studyfetch-helps-millions-students-learn-130000121.html
- **Quizlet** acquired Coconote (Feb 2026): https://www.prnewswire.com/news-releases/quizlet-supercharges-studying-with-new-product-innovations-and-strategic-acquisition-302679622.html
- **Knowt** pricing: https://knowt.com/plans. **RemNote** pricing: https://www.remnote.com/pricing. **Scholarly** pricing: https://scholarly.so/pricing
- **Anki** has had built-in FSRS since 23.10, so FSRS is not a differentiator: https://changes.ankiweb.net/changes/23.10.html

**Shakeout signals**
- **Chegg** cut 45% of staff in Oct 2025, citing AI: https://www.cnbc.com/2025/10/27/chegg-slashes-45percent-of-workforce-blames-new-realities-of-ai.html
- **Quizlet** shut down its Q-Chat tutor [3p]: https://quizgecko.com/blog/best-q-chat-alternative

**Open source**
- **open-notebook** (a self-hosted NotebookLM alternative, about 39.5K stars at research time): https://github.com/lfnovo/open-notebook
- Study-app clones: https://github.com/tomasmourato/studybolt, https://github.com/zijinz456/OpenTutor
- AI repo graders: https://github.com/jimjamscott22/AI-Project-Reviewer, https://github.com/bobmatnyc/ai-code-review
- Repeated "Show HN" launches of the same idea, for example https://news.ycombinator.com/item?id=47203567

**User complaints about AI study tools**
- AI-generated cards contain subtle errors (about 3 in 100 in one person's test): https://denovo.substack.com/p/ai-generated-anki-cards-are-not-to
- AI-written exam questions are rated weakest on relevance and depth: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11806894/
- **Learning harm:** in a randomised study, unrestricted GPT-4 access raised practice scores but lowered exam scores by 17% once access was removed. A tutor limited to hints mostly avoided the harm (PNAS 2025): https://www.pnas.org/doi/10.1073/pnas.2422633122
- Paywalls and ads: https://se.trustpilot.com/review/knowt.io. Reddit could not be fetched directly, so Reddit sentiment is [U].

**Credentials**
- **Open Badges 3.0 is built on W3C Verifiable Credentials:** https://www.1edtech.org/standards/open-badges
- Credly supports OB 3.0: https://learn.credly.com/blog/credly-supports-open-badge-3.0. Accredible supports OB 3.0 and W3C VC: https://www.accredible.com/newsroom/accredible-launches-support-for-open-badge-3-0-and-w3c-verifiable-credentials
- The EU's European Digital Credentials: https://europass.europa.eu/en/european-digital-credentials-learning
- Identity leaders have dismissed soulbound tokens and favour VCs: https://www.coindesk.com/web3/2023/04/27/leaders-in-decentralized-identity-slam-soulbound-tokens
- **Employers struggle to trust even standard badges:**
  - https://www.forbes.com/sites/dereknewton/2024/10/20/report-employers-still-dont-understand-trust-education-badges/
  - https://www.hrdive.com/news/digital-credentials-may-be-valuable-but-are-not-being-used/822579/
  - https://www.highereddive.com/news/employers-microcredentials-alternative-credentials-quality/643340/
- **Skills-based hiring barely changed outcomes** (fewer than 1 in 700 hires): https://www.burningglassinstitute.org/research/skills-based-hiring-2024
- Karat acquired Triplebyte's assessment technology, and the rest of Triplebyte wound down, a cautionary example for "credential developers for hiring": https://techcrunch.com/2023/03/16/technical-recruitment-platform-karat-snaps-up-triplebyte-to-add-ai-based-quizzes-for-engineers/
- A pro-micro-credential survey by Coursera is a conflicted source, since Coursera sells certificates.

**Grading and developer skill**
- **CodeGrade** (autograding for courses) pricing: https://www.codegrade.com/pricing
- **Frontend Mentor Pro:** https://www.frontendmentor.io/pro
- **roadmap.sh Premium:** https://roadmap.sh/premium
- **Exercism mentoring:** https://exercism.org/mentoring

**Market-size numbers:** none are used. The figures found ($80.5B by 2030, and others) came from unsourced "analysts" or blogs [U].

---

# Competitor Analysis

| Competitor | Target User | Core Problem | Main Features | Pricing | Strength | Weakness | Our Difference |
|---|---|---|---|---|---|---|---|
| Gemini Notebook (NotebookLM) | Students, researchers | Understand your own sources | Grounded chat, flashcards, quizzes, audio/video overviews, mind maps, tutor, code environment | Free; paid AI plans [3p] | Free, Google distribution, grounding | Weak spaced repetition, no credentials | Credential plus practical grading, but ours is currently forgeable |
| ChatGPT / Gemini / Claude learning modes | Everyone | Tutoring | Socratic modes, file upload | Free or bundled | Reach, model quality | Generic; features come and go | Source workspace and progress tracking |
| Quizlet (+ Coconote) | High school and college | Memorisation | Sets, Learn, lecture capture, AI | Paid tiers [3p] | Content library, brand | Paywall backlash | None meaningful |
| Knowt | High school (AP/SAT) | Free Quizlet alternative | Notes, video, PDF to cards and quizzes, tutor | Free with ads; Ultra paid (official) | Generous free tier | Ads | None meaningful |
| Turbo AI | College | Lecture to study materials | Recording, notes, cards, quizzes, podcasts | Freemium [3p] | Profitable, 5M users | Commodity features | None meaningful |
| Gizmo | College | Retention and engagement | AI cards, spaced repetition, games | Subscription [3p/U] | $22M funding, 13M learners | Throttled free tier | None meaningful |
| StudyFetch | College | All-in-one tutor | Tutor, lecture assistant, tests | Subscription [3p] | Owl Ventures / College Board | Tight free limits | None meaningful |
| RemNote / Anki | Serious learners, medicine | Long-term retention | Notes plus FSRS, AI cards | RemNote $8–18/month; Anki free | Deep, proven spaced repetition | Learning curve | Ours has FSRS in name only |
| Symbolab / Photomath | Math students | Step-by-step math | Deterministic engine steps | Subscription [3p] | Correctness | Makes copying answers easy | CAS check on *the student's own* steps plus a tutor limited to hints, but ours can't handle equations yet |
| Credly / Accredible | Issuers (universities, companies) | Credential issuing and verification | OB 3.0 / W3C VC issuing, wallets | B2B | Standards, employer familiarity | No learning or assessment | We assess and issue; they only issue |
| CodeGrade / Codio | Course operators | Grading programming work at scale | Autograders, LMS integration, AI assistant | Per student [official] | Real buyers (institutions) | Not learner-facing | Repo-level grading plus a study workspace |
| Exercism / Frontend Mentor / roadmap.sh | Self-taught developers | Practice and feedback | Exercises, mentors, AI review | Free to about $12/month | Community, trust | No portable credential | Evidence-backed credential, if made trustworthy |
| open-notebook and other OSS | Self-hosters | Private NotebookLM | Multi-provider RAG, podcasts | Free | Free, private | DIY setup | None |

## A. Features everyone already has
Import from PDF, video or URL; AI notes, summaries, flashcards and quizzes; mind or concept maps; a tutor chat; spaced repetition; audio overviews (most of the leaders).

## B. Features competitors are weak at
- Practical, graded evidence: code, repositories and math steps, checked deterministically.
- Linking study to a *portable, verifiable* credential.
- Accuracy guarantees for generated cards and questions (citations that are actually checked).

## C. Problems users complain about repeatedly
Hallucinated or subtly wrong cards; shallow questions; paywalls, ads and credit systems; features being removed (Q-Chat, Study Mode); AI making it easy to skip the learning (the PNAS evidence).

## D. Problems nobody appears to solve well
- Credible, low-cost proof of a *specific practical skill* that employers would trust.
- Accuracy that can be verified for high-stakes study material (medicine, licensing).

Both are hard for reasons of trust and distribution, not technology.

---

# Genuine Market Gaps

A gap only counts here if users care about it, it comes up often, and there is some path to getting paid.

1. **Grading at scale for course and bootcamp operators.**
   - There is a real buyer: CodeGrade's per-student pricing shows institutions pay.
   - Instructors feel the pain every week.
   - Your repo-assessment and sandbox tracing code is a starting point.
   - *Requires:* server-side, deterministic tests with LLM feedback as secondary. Today it is the reverse.
2. **Evidence-backed skill proof for self-taught developers, issued as Open Badges 3.0 / W3C VC.**
   - The pain is real (bootcamp closures, and degree-free hiring rarely happening in practice).
   - It is hard to monetise, as Triplebyte showed.
   - It only works if the evidence can be inspected: the repo, the test results, a timestamped trace.
3. **Math step feedback that is CAS-verified and limited to hints.**
   - There is evidence that a tutor limited to hints avoids the learning harm (PNAS).
   - Incumbents solve problems for students rather than checking the student's own steps.
   - It is contested, and your CAS layer needs real work before it counts.

# Weak / Fake Gaps

- **An NFT or on-chain credential.** There is no employer demand, the industry has chosen VC/OB 3.0, and the NFT label carries a reputational cost. The chain adds gas cost and key-management risk without adding trust. Trust comes from the evidence and the issuer.
- **"FSRS spaced repetition".** Anki, RemNote and Gizmo already have it, and here it is not even wired up.
- **"All sources in one workspace".** NotebookLM does this for free.
- **Concept maps and mind maps.** A commodity feature that looks good in demos and doesn't drive retention.
- **Model-tier routing.** Good engineering for cost, but invisible to users.
- **"AI grades your GitHub repo".** Free OSS versions exist, and an LLM-only grade that can be prompt-injected is not evidence.

---

# Startup Potential

**As scoped today: low.**
- The core is a commodity with free, better-distributed competitors.
- The differentiator (the NFT passport) targets a demand there is no evidence for, and is not currently trustworthy.
- There are no users, no revenue path that works (the upgrade button fails), and no distribution channel.
- The funded players in this space raised $10–22M to fight over students, a demographic HN commenters describe as a bad one to sell to.
- A solo developer has no advantage here.

**A narrow B2B pivot:** possible, but unproven. See the wedge below. It needs customer discovery before any more code.

---

# Portfolio Value

**Would these reviewers be interested?**
- **Startup CTO:** interested in the range and speed. They will be put off by broken trust (forgeable certificates, the fake mint), no tests, and suppressed type errors.
- **Senior engineer:** will spot the filesystem-on-serverless problem, the missing ownership checks, and the dead code within minutes. The ingestion work and the defensive JSON parsing (`src/lib/json.ts`) will earn respect.
- **AI engineer:** tiered routing with a fallback chain, a chunking strategy for each source type, lexical retrieval with neighbour expansion, and per-card verification calls are all reasonable. Missing: embeddings/RAG evaluation, output schema validation (Zod schemas exist but are unused), timeouts, and any evaluation harness. It will read as "competent LLM integration", not "AI engineering".
- **Backend engineer:** weak signal. There are no transactions, no queue, no RLS, no foreign keys, no idempotency, and no tests.

**Strongest technical aspects to showcase:**
1. PDF ingestion: grouping lines by y-coordinate and removing repeated headers and footers (`src/lib/ingestion/pdf-*.ts`).
2. Section-aware chunking with heading paths and page ranges, plus lexical retrieval with phrase and heading boosts (`src/lib/source-chunks.ts`).
3. The multi-stage JSON repair pipeline for LLM output (`src/lib/json.ts`).
4. Model-tier routing with a provider fallback chain (`src/lib/ai.ts`).
5. Browser-side Python execution with a `sys.settrace` step tracer (`CodeSandbox.tsx`).
6. CAS-backed math step equivalence checking (once it handles equations).
7. Streaming repo assessment over SSE.

**What makes it look weak:**
- **Unfinished prototype:** 404 links in the navigation, a hardcoded "Arjun", a random roadmap score, the fake mint shown as "ON-CHAIN VERIFIED", a broken verify page and a broken upgrade button.
- **AI-generated boilerplate:** very large single files (1,100+ lines), 5 or more unused dependencies (including the ones the latest commit fixed peer dependencies for), unused Zod schemas, barrel files that nothing imports, "for testing" endpoints left live, and commit messages that describe features which don't exist ("collaborative math workspace").
- **Overengineered student project:** blockchain, Stripe, Upstash, Pinata, a vector column and three state libraries, all on top of a core flow that doesn't persist on its deployment target.
- **Shallow LLM integration:** most generators truncate the source to the first N characters and prompt once. The "grounding" is not checked.

**To make ownership obvious in the README:**
- Describe the *actual* ingestion and chunking design and why it was chosen. Include before and after output from PDF cleaning.
- Include one honest architecture diagram, including the known limitations.
- Name a specific failure you found and fixed (for example the Algebrite `=` assignment trap), with a test.
- A small evaluation: for example, how many generated flashcards are correct against the source, on N samples.
- Explain the trust model for credentials: what is verified on the server and what isn't.
- A "Known limitations" section that matches this audit.
- Remove claims about BlockNote, FSRS, the verify page and Stripe until they work.

---

# Strongest Possible Wedge

**Current idea:** an all-in-one AI study workspace for anyone, from any source, with an NFT learning passport.

**Potential narrower ICP:** instructors or operators of small paid programming courses and cohorts (bootcamps, university lab TAs, YouTube course creators with cohorts) who need to grade student project repositories.

**Specific painful workflow:** every cohort, the instructor clones N student repos, runs them, checks them against a rubric, writes feedback, and issues a completion certificate that employers can't verify.

**Current workaround:** manual review; CodeGrade or Codio autograders (per student, tied to an LMS); GitHub Classroom with custom Actions; Google Forms plus a PDF certificate; Credly for issuing badges.

**Proposed wedge:**
1. Connect a repo.
2. Run the instructor's deterministic tests on the server.
3. Produce LLM-written feedback *attached to the test results*.
4. Issue an Open Badges 3.0 / W3C VC credential that links to the inspectable evidence (commit SHA, test log, rubric).

**Why this wedge is better:**
- There is a buyer with a budget and a recurring pain (every cohort).
- Grading must happen on the server, which is exactly the trust fix this codebase needs anyway.
- The credential is worth something because *the issuer is a known course* and the evidence can be inspected.
- It reuses the existing repo assessment, sandbox and badge code.

**Validate first:**
- Talk to 10–15 course operators.
- Ask them to hand over one real cohort's repositories for grading.
- Ask whether they would pay per cohort.

**What I should NOT build:**
- More study-loop generators (flashcards, mind maps, audio).
- NFT minting or anything on-chain.
- Voice mode.
- More AI assistant "modes".
- A mobile app.
- New import types.
- Gamification.
- A consumer Stripe tier for students.

---

# What I Should Build Next

**If I had 30 days and could only work on this project:**

**Week 1: validate the wedge (no code).**
- Interview 10 or more course or bootcamp instructors about how they grade and certify today, and what they pay.
- Kill-or-continue test: at least 3 agree to trial it on a real cohort.

**Week 2: fix the trust core.** These fixes are needed on either path, portfolio or startup:
- Grade quizzes on the server with stored answer keys.
- Remove `POST /api/badges` and the manual override.
- Lock down or remove `/api/mint-nft`.
- Move `data/` into Supabase tables and Storage.
- Validate IDs as UUIDs and add ownership helpers.
- Turn on RLS.

**Week 3: build the wedge.**
- Run instructor-defined tests on student repos on the server, in a container or sandbox service rather than the browser.
- Store evidence (commit SHA, logs, rubric results).
- LLM feedback that is secondary to the test results.

**Week 4: credential and proof.**
- Issue OB 3.0 / VC JSON with a public verify page that shows the evidence.
- Add tests for grading, credential issuing and the webhooks, and a CI workflow.
- Re-enable build-time type and lint checks.
- Rewrite the README honestly.

If week 1 fails, stop building the product. Spend week 2 and week 4's hygiene items on making this a clean portfolio piece.

# What I Should NOT Build

- Anything that competes head-on with NotebookLM/Gemini Notebook on the study loop.
- More on-chain features, a Polygon migration, a token or soulbound tokens.
- More assistant modes, voice mode, problem image OCR, or "collaborative" whiteboards.
- Consumer subscriptions before a single user has retained.
- Embeddings or RAG infrastructure before there is a use case that needs better retrieval than the current lexical approach.
- A large refactor before deciding between the portfolio and startup paths.

---

# Final Recommendation

**Classification: KEEP AS A PORTFOLIO PROJECT. VALIDATE BEFORE BUILDING MORE (only toward the B2B grading wedge).**

| Dimension | Assessment |
|---|---|
| **Product opportunity** | Weak as scoped. The study loop is commoditised and free from Google, OpenAI and Anthropic. The NFT credential has no evidence of demand. There is a plausible but unvalidated B2B wedge in project grading plus standards-based credentials. |
| **Technical quality** | Mixed. Some parts are solid (ingestion, chunking, JSON repair, model routing, the Pyodide tracer). The trust model is broken, storage doesn't persist on the deployment target, there are authorization gaps, and there are no tests or CI. Many features are mocked or dead. |
| **Portfolio value** | Moderate. It shows range, but the visible fakes (mint, verify, hardcoded name, random score) and the dead code reduce reviewer confidence. It would be good after a two-week cleanup and an honest README. |
| **Startup potential** | Low on the current path. It is unknown on the wedge path until customer interviews happen. |

**Plainly: this is technically ambitious, but the startup opportunity is weak as currently framed.** The most valuable next step is two weeks making the existing work honest and trustworthy, plus ten conversations with people who grade programming projects for a living. More features are not the next step.

---

# Research Sources

Primary and official sources:
- https://workspaceupdates.googleblog.com/2025/09/flashcards-quizzes-reports-notebook-lm-google-education.html
- https://workspaceupdates.googleblog.com/2026/07/notebooklm-now-gemini-notebook.html
- https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/
- https://blog.google/products-and-platforms/products/education/guided-learning/
- https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/
- https://openai.com/index/chatgpt-study-mode/
- https://www.anthropic.com/news/introducing-claude-for-education
- https://www.anthropic.com/news/claude-for-teachers
- https://www.khanmigo.ai/pricing
- https://knowt.com/plans
- https://www.remnote.com/pricing
- https://scholarly.so/pricing
- https://www.turbo.ai/blog/october-2025-announcement-5-million-users
- https://www.prnewswire.com/news-releases/gizmo-raises-22-million-series-a-to-make-learning-addictive-for-13-million-learners-worldwide-302741943.html
- https://www.prnewswire.com/news-releases/quizlet-supercharges-studying-with-new-product-innovations-and-strategic-acquisition-302679622.html
- https://changes.ankiweb.net/changes/23.10.html
- https://www.1edtech.org/standards/open-badges
- https://learn.credly.com/blog/credly-supports-open-badge-3.0
- https://www.accredible.com/newsroom/accredible-launches-support-for-open-badge-3-0-and-w3c-verifiable-credentials
- https://europass.europa.eu/en/european-digital-credentials-learning
- https://registrar.mit.edu/transcripts-records/diplomas/digital-diplomas
- https://www.codegrade.com/pricing
- https://www.frontendmentor.io/pro
- https://roadmap.sh/premium
- https://exercism.org/mentoring
- https://github.com/lfnovo/open-notebook
- https://github.com/tomasmourato/studybolt
- https://github.com/zijinz456/OpenTutor
- https://github.com/jimjamscott22/AI-Project-Reviewer
- https://github.com/bobmatnyc/ai-code-review
- https://www.pnas.org/doi/10.1073/pnas.2422633122
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11806894/
- https://www.burningglassinstitute.org/research/skills-based-hiring-2024

Secondary, news and discussion:
- https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt
- https://news.ycombinator.com/item?id=44725764
- https://news.ycombinator.com/item?id=47739305
- https://news.ycombinator.com/item?id=47203567
- https://www.engadget.com/ai/anthropic-brings-claudes-learning-mode-to-regular-users-and-devs-170018471.html
- https://9to5google.com/2025/11/06/notebooklm-app-flashcards-quizzes/
- https://www.inc.com/diana-bocco/student-founders-entrepreneurs-ai-startup-venture-capital-funding/91380311
- https://sacra.com/c/turbo-ai/
- https://finance.yahoo.com/news/studyfetch-helps-millions-students-learn-130000121.html
- https://quizgecko.com/blog/best-q-chat-alternative
- https://elephas.app/blog/notebooklm-free-vs-plus
- https://www.cnbc.com/2025/10/27/chegg-slashes-45percent-of-workforce-blames-new-realities-of-ai.html
- https://denovo.substack.com/p/ai-generated-anki-cards-are-not-to
- https://se.trustpilot.com/review/knowt.io
- https://www.coindesk.com/web3/2023/04/27/leaders-in-decentralized-identity-slam-soulbound-tokens
- https://www.forbes.com/sites/dereknewton/2024/10/20/report-employers-still-dont-understand-trust-education-badges/
- https://www.hrdive.com/news/digital-credentials-may-be-valuable-but-are-not-being-used/822579/
- https://www.highereddive.com/news/employers-microcredentials-alternative-credentials-quality/643340/
- https://techcrunch.com/2023/03/16/technical-recruitment-platform-karat-snaps-up-triplebyte-to-add-ai-based-quizzes-for-engineers/

Unverified claims noted in the text: the current status of ChatGPT Study Mode; exact prices for Gizmo, Quizlet, Turbo and Mindgrasp; Turbo AI's revenue; Reddit sentiment; all market-size figures.
