# Notestamp — Full SaaS Implementation Reference v2
*Updated from LearnLoop codebase audit · Includes robust AI assistant system · Date: 2026-05-10*

> **What changed in v2:** Sections 4, 5, 6, 7, 8, and 19 updated throughout. New sections 20–24 added covering
> the AI assistant system (voice + text), quiz hint mode, roadmap query mode, note correction mode,
> problem upload correction, model routing strategy, and updated go-live checklist.
> The Feynman routes already in your codebase are the foundation — this doc shows how to unify them
> into one coherent assistant that works across every context in the app.

---

## 0) What You Have vs What You Need

### Current state (LearnLoop)
- Single-session stateless flow: paste URL → generate artifacts → maybe mint NFT
- One Appwrite collection (`sessions`) with globally open permissions
- No auth (beyond GitHub OAuth for repo assessment)
- No billing, no plan limits, no user accounts
- No persistent note workspace
- No learning passport / badge chain
- NFT minting works but is one-shot, no chain logic
- Three overlapping ingestion routes with duplicated logic
- Feynman assistant exists as a VOICE-ONLY isolated feature — not wired into notes, quizzes, or roadmaps

### Target state (Notestamp SaaS)
- Persistent multi-source workspace per user
- Full auth (Clerk) with user records in Appwrite
- Stripe billing with Free/Pro plan enforcement server-side
- Note editor (Tiptap) as the center of gravity
- Learning passport chain: micro-badge → skill badge → master cert
- Multi-source ingestion normalized to one SourceText format
- Centralized prompt registry with versioning + caching
- Zod validation on every AI response
- Rate limiting + ownership checks on every route
- Public credential verify page
- **Unified AI assistant: text + voice, context-aware, works in notes / quizzes / roadmaps / problem uploads**

---

## 1) Target Stack (exact versions)

| Layer | Tool | Version | Why |
|---|---|---|---|
| Framework | Next.js | 14.2.x | App Router stable, not 16 — avoid RC bugs |
| React | React | 18.3.x | Stable, not 19 RC |
| Language | TypeScript | 5.4.x | strict mode, keep as-is |
| Styling | Tailwind CSS | 3.4.x | keep as-is |
| Auth | Clerk | 5.x | replaces manual GitHub OAuth for app auth |
| Database | Appwrite Cloud | SDK 16.x | keep, restructure collections |
| Note editor | Tiptap | 2.4.x | new addition |
| AI gateway | OpenRouter | REST | keep, centralize in src/lib/ai.ts |
| Validation | Zod | 3.23.x | new addition, validates all AI JSON |
| Rate limiting | @upstash/ratelimit | 2.x | new addition |
| Billing | Stripe | 16.x | new addition |
| NFT | Ethers.js | 6.x | keep, already present |
| IPFS | Pinata | REST | keep as-is |
| Animation | Framer Motion | keep | already in package.json |
| PDF parse | pdf-parse | 1.1.x | new addition |
| Web scraper | @mozilla/readability + jsdom | new | new addition |
| Schema repair | jsonrepair | keep | already in src/lib/json.ts |
| Voice STT | Web Speech API (browser) | built-in | free, no cost — for voice input capture |
| Voice TTS | Web Speech API (browser) | built-in | free, no cost — for voice output playback |
| Image upload | Appwrite Storage | existing | for problem/worksheet uploads to assistant |

> **Voice note:** Your current Feynman feature likely uses browser Web Speech API or a similar approach.
> Keep that for the MVP — it's free. Only add Whisper/Deepgram if users complain about accuracy.
> Browser STT works fine for English; add server-side transcription later if you need multilingual support.

**Do not upgrade to Next.js 16 / React 19 yet.** Both are RC-stage. Your current package.json lists them
but they introduce App Router breaking changes. Pin to 14.2.x for production stability.

---

## 2) Environment Variables — Complete Production List

```bash
# ── Auth (Clerk) ──────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...           # for Clerk → Appwrite user sync

# ── Appwrite ──────────────────────────────────────────
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=...
NEXT_PUBLIC_APPWRITE_DATABASE_ID=notestamp
APPWRITE_API_KEY=...                     # server-side only

# ── AI model routing ──────────────────────────────────
OPENROUTER_API_KEY=sk-or-...
# Tier 1: ultra-cheap workhorse — summaries, flashcards, assistant chat
OPENROUTER_MODEL_BUDGET=google/gemini-2.5-flash-lite   # $0.10/$0.40 per 1M tokens
OPENROUTER_MODEL_FAST=deepseek/deepseek-v4-flash        # $0.14/$0.28 per 1M tokens
# Tier 2: quality for pedagogical tasks
OPENROUTER_MODEL_MID=anthropic/claude-haiku-4-5         # $1.00/$5.00 per 1M tokens
# Tier 3: flagship for grading + master cert
OPENROUTER_MODEL_SMART=anthropic/claude-sonnet-4-6      # $3.00/$15.00 per 1M tokens
# Emergency fallback
OPENROUTER_MODEL_FALLBACK=openai/gpt-4o-mini

# ── YouTube ──────────────────────────────────────────
YOUTUBE_API_KEY=...

# ── Stripe ───────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...            # ₹499/mo recurring
STRIPE_CERT_PRICE_ID=price_...          # ₹199 one-time per cert mint
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# ── Blockchain ───────────────────────────────────────
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/...  # mainnet NOT sepolia
PRIVATE_KEY=0x...                        # server wallet, never NEXT_PUBLIC_
CONTRACT_ADDRESS=0x...                   # no NEXT_PUBLIC_ — only used server-side
NEXT_PUBLIC_EXPLORER_URL=https://polygonscan.com      # for frontend links only

# ── IPFS ─────────────────────────────────────────────
PINATA_JWT=...
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# ── GitHub OAuth (repo assessment only) ──────────────
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# ── Rate limiting ─────────────────────────────────────
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# ── App ───────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://notestamp.com

# ── Assistant (future Whisper upgrade path) ───────────
# OPENAI_API_KEY=...   # only needed IF you add server-side Whisper transcription
#                       # not needed for MVP — browser Web Speech API is free
```

**Changes from v1:**
- Removed `OPENROUTER_MODEL_FAST` (was Claude Haiku) — restructured into 4-tier model routing
- Added `OPENROUTER_MODEL_BUDGET`, `OPENROUTER_MODEL_FAST` (DeepSeek), `OPENROUTER_MODEL_MID`
- Added comment block for future Whisper path (not needed at launch)
- `CONTRACT_ADDRESS` confirmed without `NEXT_PUBLIC_` prefix
- Explorer URL fixed to Polygon mainnet

---

## 3) Appwrite Database Schema — Full Restructure

**Database ID:** `notestamp`
**Replace** the single `sessions` collection with 9 purpose-built collections.
**New in v2:** `chat_sessions` collection added for AI assistant history.

### 3.1 `users`
| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | ✓ | Clerk user ID, unique index |
| `email` | string | ✓ | from Clerk webhook |
| `plan` | enum(`free`,`pro`) | ✓ | default `free` |
| `stripeCustomerId` | string | | set on first checkout |
| `stripeSubscriptionId` | string | | set on subscription active |
| `wallet` | string | | Polygon wallet address |
| `createdAt` | datetime | ✓ | auto |

**Permissions:** Server API key only. No `Role.any()`.
**Index:** `userId` ascending, unique.

### 3.2 `workspaces`
| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | ✓ | owner |
| `title` | string | ✓ | user-editable |
| `description` | string | | optional |
| `status` | enum(`active`,`archived`) | ✓ | default `active` |
| `sourceCount` | integer | ✓ | denormalized count |
| `completedUnits` | integer | ✓ | default 0 |
| `totalUnits` | integer | ✓ | default 0 |
| `createdAt` | datetime | ✓ | auto |
| `updatedAt` | datetime | ✓ | update on any child change |

**Permissions:** `Role.user(userId)` read/update/delete. Server API key for create.
**Index:** `userId` + `createdAt` descending.

### 3.3 `sources`
| Field | Type | Required | Notes |
|---|---|---|---|
| `workspaceId` | string | ✓ | parent workspace |
| `userId` | string | ✓ | owner |
| `type` | enum(`youtube`,`pdf`,`url`,`text`,`audio`) | ✓ | |
| `title` | string | ✓ | video title / filename / page title |
| `url` | string | | original URL if applicable |
| `inputHash` | string | ✓ | sha256 of raw content — cache key |
| `rawTextPath` | string | | Appwrite Storage file ID for raw text |
| `metadata` | string | | stringified JSON: duration/pages/author |
| `status` | enum(`processing`,`ready`,`failed`) | ✓ | default `processing` |
| `createdAt` | datetime | ✓ | auto |

**Index:** `inputHash` ascending (for cache lookup). `workspaceId` + `createdAt`.

### 3.4 `notes`
| Field | Type | Required | Notes |
|---|---|---|---|
| `sourceId` | string | ✓ | parent source |
| `userId` | string | ✓ | owner |
| `title` | string | ✓ | editable |
| `content` | string | ✓ | Tiptap JSON stringified, max 500KB |
| `tags` | string[] | | array of tag strings |
| `wordCount` | integer | | updated on save |
| `updatedAt` | datetime | ✓ | updated on every save |
| `createdAt` | datetime | ✓ | auto |

### 3.5 `flashcard_sets`
| Field | Type | Required | Notes |
|---|---|---|---|
| `sourceId` | string | ✓ | parent source |
| `userId` | string | ✓ | owner |
| `cards` | string | ✓ | JSON array: [{front,back,id}] |
| `promptVersion` | string | ✓ | e.g. `flashcards-v2` |
| `model` | string | ✓ | which model generated |
| `generatedAt` | datetime | ✓ | auto |

**Index:** `sourceId` ascending — first check here before calling AI.

### 3.6 `quiz_attempts`
| Field | Type | Required | Notes |
|---|---|---|---|
| `sourceId` | string | ✓ | which source this quiz covers |
| `userId` | string | ✓ | who took it |
| `questions` | string | ✓ | JSON: [{question,options[],correctIndex,explanation}] |
| `answers` | string | ✓ | JSON: [selectedIndex, ...] |
| `score` | integer | ✓ | 0–100 |
| `passed` | boolean | ✓ | score >= 70 |
| `takenAt` | datetime | ✓ | auto |

**Index:** `sourceId` + `userId` + `takenAt` descending.
**Note:** Store every attempt, not just the latest. This is evidence for badge minting.

### 3.7 `badges`
| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | ✓ | owner |
| `type` | enum(`micro`,`skill`,`master`) | ✓ | |
| `title` | string | ✓ | e.g. "React Hooks — Chapter 3" |
| `skill` | string | ✓ | top-level skill name |
| `sourceId` | string | | for micro badges |
| `workspaceId` | string | | for skill + master badges |
| `evidenceIds` | string | ✓ | JSON array of quiz_attempt IDs |
| `componentBadgeIds` | string | | JSON array of badge IDs (for skill/master) |
| `score` | integer | ✓ | avg score across evidence |
| `tokenId` | string | | Polygon token ID after mint |
| `txHash` | string | | mint transaction hash |
| `ipfsHash` | string | | IPFS CID of metadata |
| `metadataUri` | string | | full ipfs:// URI |
| `mintedAt` | datetime | | null until minted |
| `createdAt` | datetime | ✓ | auto (badge earned, before mint) |
| `idempotencyKey` | string | ✓ | unique — prevents double mint |

**Index:** `userId` + `type` + `createdAt`. `idempotencyKey` unique.

### 3.8 `usage_log`
| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | ✓ | |
| `route` | string | ✓ | e.g. `/api/flashcards` |
| `model` | string | | which AI model called |
| `inputTokens` | integer | | for cost tracking |
| `outputTokens` | integer | | for cost tracking |
| `cached` | boolean | ✓ | true if served from cache |
| `durationMs` | integer | | response time |
| `createdAt` | datetime | ✓ | auto |

**Index:** `userId` + `createdAt` descending. Used for plan limit checks.

### 3.9 `chat_sessions` ← NEW in v2
| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | ✓ | owner |
| `contextType` | enum(`source`,`quiz`,`roadmap`,`problem`) | ✓ | what the assistant is talking about |
| `contextId` | string | ✓ | sourceId / quizAttemptId / workspaceId / uploadedFileId |
| `messages` | string | ✓ | JSON array of {role,content,timestamp,mode} — max 50 messages, then summarise |
| `mode` | enum(`teacher`,`corrector`,`quiz_hint`,`roadmap_guide`,`problem_solver`) | ✓ | active mode |
| `inputType` | enum(`text`,`voice`) | ✓ | how the last message was sent |
| `summary` | string | | AI-generated summary of older messages when history > 30 msgs |
| `createdAt` | datetime | ✓ | auto |
| `updatedAt` | datetime | ✓ | on every new message |

**Index:** `userId` + `contextType` + `contextId` — one session per user per context.
**Design note:** When `messages` array exceeds 30 entries, summarise the oldest 20 into the `summary`
field and trim those messages. This prevents the context window from bloating on long study sessions.
The summary gets injected back into the system prompt: "Previous conversation summary: {summary}".

---

## 4) Complete Folder Structure (updated)

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                           # landing page
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                     # sidebar + topbar shell
│   │   ├── dashboard/page.tsx
│   │   ├── workspace/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx               # 3-panel workspace view
│   │   │       └── [sourceId]/page.tsx
│   │   ├── passport/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── import/page.tsx
│   │   ├── quiz/[sourceId]/page.tsx       # quiz page with assistant hint button
│   │   ├── roadmap/[workspaceId]/page.tsx # NEW — visual roadmap of passport progress
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   └── billing/page.tsx
│   │   └── profile/page.tsx
│   ├── verify/
│   │   └── [tokenId]/page.tsx
│   └── api/
│       ├── webhooks/
│       │   ├── clerk/route.ts
│       │   └── stripe/route.ts
│       ├── stripe/
│       │   ├── checkout/route.ts
│       │   └── portal/route.ts
│       ├── ingest/
│       │   ├── youtube/route.ts
│       │   ├── pdf/route.ts
│       │   ├── url/route.ts
│       │   └── text/route.ts
│       ├── ai/
│       │   ├── flashcards/route.ts
│       │   ├── summary/route.ts
│       │   ├── quiz/route.ts
│       │   ├── concept-map/route.ts
│       │   ├── assignment/route.ts
│       │   └── assistant/
│       │       ├── chat/route.ts          # NEW — unified streaming chat endpoint
│       │       ├── hint/route.ts          # NEW — quiz hint (non-streaming, single response)
│       │       ├── correct/route.ts       # NEW — note/answer correction
│       │       └── upload/route.ts        # NEW — image/PDF problem upload handler
│       │   # NOTE: /api/feynman/* routes get MIGRATED into /api/ai/assistant/*
│       │   # Do NOT delete feynman routes until assistant routes are live and tested
│       ├── passport/
│       │   ├── evaluate/route.ts
│       │   └── mint/route.ts
│       ├── nft/
│       │   ├── mint-badge/route.ts
│       │   ├── mint-cert/route.ts
│       │   └── verify/[tokenId]/route.ts
│       ├── github/
│       │   ├── auth/route.ts
│       │   ├── callback/route.ts
│       │   └── assess/route.ts
│       └── user/
│           ├── me/route.ts
│           └── usage/route.ts
├── components/
│   ├── editor/
│   │   ├── TiptapEditor.tsx               # note editor
│   │   ├── BubbleMenu.tsx                 # AI bubble: summarise, explain, correct
│   │   └── SlashMenu.tsx
│   ├── workspace/
│   │   ├── WorkspaceCard.tsx
│   │   ├── SourcePanel.tsx
│   │   ├── RightSidebar.tsx               # tabs: Notes/Cards/Quiz/Map/Ask AI
│   │   └── ProgressBar.tsx
│   ├── assistant/                         # NEW — all assistant UI components
│   │   ├── AssistantPanel.tsx             # main panel — renders in right sidebar "Ask AI" tab
│   │   ├── AssistantInput.tsx             # text input + mic button (both modes)
│   │   ├── VoiceButton.tsx                # mic button, handles Web Speech API lifecycle
│   │   ├── MessageBubble.tsx              # renders one assistant message with mode badge
│   │   ├── ModeSelector.tsx               # teacher / corrector / quiz me / guide buttons
│   │   ├── HintOverlay.tsx                # quiz hint — floating overlay, not full panel
│   │   ├── CorrectionDiff.tsx             # shows original text vs corrected text side-by-side
│   │   └── ProblemUpload.tsx              # image/PDF upload for problem correction mode
│   ├── flashcard/
│   │   ├── FlipCard.tsx
│   │   └── FlashcardDeck.tsx
│   ├── quiz/
│   │   ├── QuizQuestion.tsx
│   │   ├── ScoreCard.tsx
│   │   └── QuizHintButton.tsx             # NEW — "Ask for hint" button during quiz
│   ├── roadmap/                           # NEW
│   │   ├── RoadmapView.tsx                # visual progress map of all units in passport
│   │   ├── RoadmapNode.tsx                # one unit — locked/active/done state
│   │   └── RoadmapAssistant.tsx           # assistant panel in roadmap context
│   ├── passport/
│   │   ├── PassportCard.tsx
│   │   ├── BadgeChain.tsx
│   │   ├── BadgeGrid.tsx
│   │   └── MintButton.tsx
│   ├── billing/
│   │   ├── UpgradeModal.tsx
│   │   ├── PricingTable.tsx
│   │   └── PlanBadge.tsx
│   ├── import/
│   │   ├── YouTubeImport.tsx
│   │   ├── PdfImport.tsx
│   │   ├── UrlImport.tsx
│   │   └── TextImport.tsx
│   ├── verify/
│   │   └── CertCard.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       ├── TopBar.tsx
│       └── UpgradePrompt.tsx
├── lib/
│   ├── appwrite.ts
│   ├── db/
│   │   ├── users.ts
│   │   ├── workspaces.ts
│   │   ├── sources.ts
│   │   ├── notes.ts
│   │   ├── flashcards.ts
│   │   ├── quizzes.ts
│   │   ├── badges.ts
│   │   ├── usage.ts
│   │   └── chat-sessions.ts              # NEW — CRUD for chat history
│   ├── ai.ts                              # central AI caller
│   ├── assistant/                         # NEW — all assistant logic lives here
│   │   ├── context-builder.ts            # builds system prompt from contextType + contextId
│   │   ├── modes.ts                      # mode definitions, system prompts per mode
│   │   ├── history.ts                    # load/save/summarise message history
│   │   └── upload-parser.ts             # parse uploaded image/PDF for problem correction
│   ├── prompts/
│   │   ├── index.ts
│   │   ├── flashcards.ts
│   │   ├── summary.ts
│   │   ├── quiz.ts
│   │   ├── concept-map.ts
│   │   ├── assignment.ts
│   │   ├── feynman.ts                    # KEEP — migrate content to assistant/modes.ts
│   │   └── assistant.ts                  # NEW — assistant system prompt templates
│   ├── schemas/
│   │   ├── flashcards.schema.ts
│   │   ├── quiz.schema.ts
│   │   ├── concept-map.schema.ts
│   │   ├── assessment.schema.ts
│   │   └── assistant.schema.ts           # NEW — hint/correction output shapes
│   ├── ingestion/
│   │   ├── normalize.ts
│   │   ├── youtube.ts
│   │   ├── pdf.ts
│   │   ├── url.ts
│   │   └── cache.ts
│   ├── passport/
│   │   └── rules.ts
│   ├── nft/
│   │   ├── metadata.ts
│   │   ├── badge-image.ts
│   │   └── mint.ts
│   ├── stripe.ts
│   ├── limits.ts
│   ├── ratelimit.ts
│   ├── github.ts
│   ├── json.ts
│   ├── workspace-domain.ts
│   └── video-validator.ts
├── types/
│   └── index.ts
├── hooks/
│   ├── useWorkspace.ts
│   ├── usePassport.ts
│   ├── usePlan.ts
│   ├── useAssistant.ts                   # NEW — manages assistant state + streaming
│   ├── useVoice.ts                       # NEW — Web Speech API wrapper hook
│   └── useGitHubAuth.ts
└── middleware.ts
```

---

## 5) TypeScript Interfaces — Complete `src/types/index.ts` (updated)

```typescript
// ── Domain models ─────────────────────────────────────

export type Plan = 'free' | 'pro'
export type SourceType = 'youtube' | 'pdf' | 'url' | 'text' | 'audio'
export type BadgeType = 'micro' | 'skill' | 'master'
export type WorkspaceStatus = 'active' | 'archived'
export type SourceStatus = 'processing' | 'ready' | 'failed'

// ── AI Assistant types (NEW in v2) ────────────────────

export type AssistantContextType = 'source' | 'quiz' | 'roadmap' | 'problem'

export type AssistantMode =
  | 'teacher'       // "explain this concept from my notes/source"
  | 'corrector'     // "check if my understanding is right"
  | 'quiz_hint'     // "give me a hint for this question without the answer"
  | 'roadmap_guide' // "what should I focus on next in this learning path"
  | 'problem_solver' // "help me understand this problem (from uploaded image/PDF)"

export type InputType = 'text' | 'voice'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  mode: AssistantMode
  inputType: InputType
  // For corrector mode — stores the diff so CorrectionDiff.tsx can render it
  correction?: {
    original: string
    corrected: string
    explanation: string
    isCorrect: boolean
  }
  // For quiz_hint mode — structured hint without revealing answer
  hint?: {
    nudge: string           // "Think about what happens when X meets Y"
    relatedConcept: string  // "Review: closure in JavaScript"
    shouldReveal: boolean   // true only if user asked 3+ times for same question
  }
}

export interface ChatSession {
  $id: string
  userId: string
  contextType: AssistantContextType
  contextId: string
  messages: AssistantMessage[]
  mode: AssistantMode
  inputType: InputType
  summary?: string        // compressed history of older messages
  createdAt: string
  updatedAt: string
}

// Context payload — what gets built by context-builder.ts and injected into system prompt
export interface AssistantContext {
  contextType: AssistantContextType
  sourceText?: string           // raw transcript or note content
  noteContent?: string          // user's own notes (Tiptap text extracted)
  currentQuestion?: string      // active quiz question (for quiz_hint mode)
  questionOptions?: string[]    // MCQ options (for quiz_hint — model must NOT reveal correct index)
  roadmapState?: {
    completedUnits: string[]
    currentUnit: string
    remainingUnits: string[]
    avgScore: number
  }
  uploadedContent?: string      // OCR/parsed text from uploaded problem image or PDF
  uploadedMimeType?: string     // 'image/jpeg' | 'application/pdf' etc.
}

// ── Existing domain models (unchanged) ───────────────

export interface User {
  $id: string
  userId: string
  email: string
  plan: Plan
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  wallet?: string
  createdAt: string
}

export interface Workspace {
  $id: string
  userId: string
  title: string
  description?: string
  status: WorkspaceStatus
  sourceCount: number
  completedUnits: number
  totalUnits: number
  createdAt: string
  updatedAt: string
}

export interface Source {
  $id: string
  workspaceId: string
  userId: string
  type: SourceType
  title: string
  url?: string
  inputHash: string
  rawTextPath?: string
  metadata?: Record<string, unknown>
  status: SourceStatus
  createdAt: string
}

export interface Note {
  $id: string
  sourceId: string
  userId: string
  title: string
  content: string
  tags: string[]
  wordCount: number
  updatedAt: string
  createdAt: string
}

export interface Flashcard {
  id: string
  front: string
  back: string
}

export interface FlashcardSet {
  $id: string
  sourceId: string
  userId: string
  cards: Flashcard[]
  promptVersion: string
  model: string
  generatedAt: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface QuizAttempt {
  $id: string
  sourceId: string
  userId: string
  questions: QuizQuestion[]
  answers: number[]
  score: number
  passed: boolean
  takenAt: string
}

export interface Badge {
  $id: string
  userId: string
  type: BadgeType
  title: string
  skill: string
  sourceId?: string
  workspaceId?: string
  evidenceIds: string[]
  componentBadgeIds?: string[]
  score: number
  tokenId?: string
  txHash?: string
  ipfsHash?: string
  metadataUri?: string
  mintedAt?: string
  createdAt: string
  idempotencyKey: string
}

export interface SourceText {
  text: string
  title: string
  chunks: string[]
  metadata: {
    type: SourceType
    sourceUrl?: string
    pageCount?: number
    duration?: number
    author?: string
    publishedAt?: string
    language?: string
  }
}

export interface FlashcardsOutput { cards: Flashcard[] }
export interface QuizOutput { questions: QuizQuestion[] }
export interface ConceptMapOutput {
  nodes: { id: string; label: string }[]
  edges: { from: string; to: string; label?: string }[]
}
export interface AssessmentOutput {
  score: number
  checkpoints: { label: string; passed: boolean; feedback: string }[]
  strengths: string[]
  gaps: string[]
  overallFeedback: string
}

export interface PlanLimits {
  workspaces: number
  aiCallsPerMonth: number
  assistantMessagesPerMonth: number   // NEW — separate limit for assistant
  pdfUploads: number
  badgeMints: number
  sourcesPerWorkspace: number
  problemUploadsPerMonth: number      // NEW — image/PDF uploads to assistant
}

export interface ApiError {
  error: string
  code: 'upgrade_required' | 'rate_limited' | 'not_found' | 'unauthorized' | 'invalid_input'
  retryAfter?: number
}
```

---

## 6) Central AI Caller — `src/lib/ai.ts` (updated with model routing)

```typescript
import { z } from 'zod'
import { logUsage } from './db/usage'

// Model routing strategy — maps task tier to model string
// IMPORTANT: update env vars to match Section 2 of this doc
export const MODELS = {
  budget: process.env.OPENROUTER_MODEL_BUDGET!,    // gemini-2.5-flash-lite: summaries
  fast: process.env.OPENROUTER_MODEL_FAST!,         // deepseek-v4-flash: flashcards, assistant
  mid: process.env.OPENROUTER_MODEL_MID!,           // claude-haiku-4-5: quiz, feynman
  smart: process.env.OPENROUTER_MODEL_SMART!,       // claude-sonnet-4-6: grading, master cert
  fallback: process.env.OPENROUTER_MODEL_FALLBACK!, // gpt-4o-mini: emergency only
} as const

export type ModelTier = keyof typeof MODELS

interface CallAIOptions<T> {
  prompt: string
  systemPrompt?: string
  schema: z.ZodType<T>
  model?: ModelTier
  userId: string
  routeId: string
  maxTokens?: number
  stream?: false  // use callAIStream for streaming
}

// Non-streaming — for JSON generation (flashcards, quiz, concept map etc.)
export async function callAI<T>(opts: CallAIOptions<T>): Promise<T> {
  const { prompt, systemPrompt, schema, model = 'fast', userId, routeId } = opts
  const modelName = MODELS[model]
  const start = Date.now()

  const makeRequest = async (m: string, strictPrompt: boolean) => {
    const suffix = strictPrompt ? '\n\nReturn ONLY valid JSON. No markdown. No explanation.' : ''
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        // IMPORTANT: add your DeepSeek API key in OpenRouter settings to bypass 5% markup
      },
      body: JSON.stringify({
        model: m,
        response_format: { type: 'json_object' },
        max_tokens: opts.maxTokens ?? 1500,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt + suffix },
        ],
      }),
    })
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.choices[0].message.content as string
  }

  let raw: string
  let usedModel = modelName

  try {
    raw = await makeRequest(modelName, false)
  } catch {
    try {
      usedModel = MODELS.fallback
      raw = await makeRequest(MODELS.fallback, true)
    } catch (e) {
      throw new Error(`AI call failed on all models: ${e}`)
    }
  }

  const { parseAiJson } = await import('./json')  // your existing excellent repair lib
  const parsed = parseAiJson(raw)

  const result = schema.safeParse(parsed)
  if (!result.success) {
    const raw2 = await makeRequest(usedModel, true)
    const parsed2 = parseAiJson(raw2)
    const result2 = schema.safeParse(parsed2)
    if (!result2.success) {
      throw new Error(`Schema validation failed: ${result2.error.message}`)
    }
    return result2.data
  }

  logUsage({ userId, route: routeId, model: usedModel, cached: false, durationMs: Date.now() - start }).catch(() => {})
  return result.data
}

// Streaming — for assistant chat responses (returns ReadableStream)
// NOTE: schema not used for streaming — free-form text response
export async function callAIStream(opts: {
  messages: { role: string; content: string }[]
  model?: ModelTier
  userId: string
  routeId: string
  maxTokens?: number
}): Promise<ReadableStream> {
  const { messages, model = 'fast', userId, routeId } = opts
  const modelName = MODELS[model]

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      stream: true,
      max_tokens: opts.maxTokens ?? 1000,
      messages,
    }),
  })

  if (!res.ok) throw new Error(`Stream request failed: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  // Log usage async — note: token count not available for streaming until stream end
  // Use a rough estimate: log with inputTokens = 0, update later if needed
  logUsage({ userId, route: routeId, model: modelName, cached: false, durationMs: 0 }).catch(() => {})

  return res.body
}
```

---

## 7) Prompt Registry — `src/lib/prompts/` (updated)

Every prompt file follows the same pattern. **New:** `assistant.ts` added.

```typescript
// src/lib/prompts/assistant.ts
// Central system prompts for all assistant modes.
// These are STABLE — they sit at the top of every request and benefit from DeepSeek prompt caching.
// Structure prompts longest-to-shortest so the stable system prefix gets cached.

export const PROMPT_VERSION_ASSISTANT = 'assistant-v1'

// TEACHER mode — answers questions grounded in source material
export function buildTeacherSystemPrompt(sourceText: string, noteContent?: string): string {
  return `You are a knowledgeable study assistant helping a student understand their learning material.

IMPORTANT RULES:
- Answer ONLY based on the source material and notes provided below
- If the answer is not in the material, say "That's not covered in this source — try asking about [related topic that IS covered]"
- Use clear, simple language. Explain like you're tutoring a student, not writing a textbook
- Give examples where helpful
- Keep responses concise — 3–5 sentences for simple questions, up to 8 sentences for complex ones
- Never make up information not present in the source

SOURCE MATERIAL:
${sourceText.slice(0, 8000)}
${noteContent ? `\nSTUDENT'S NOTES:\n${noteContent.slice(0, 2000)}` : ''}`
}

// CORRECTOR mode — checks understanding against source
export function buildCorrectorSystemPrompt(sourceText: string): string {
  return `You are a study assistant that checks a student's understanding against their source material.

When the student explains a concept or gives an answer:
1. Identify what they got RIGHT first — be specific and encouraging
2. Identify what they got WRONG or MISSED — be clear but kind
3. Give the correct version in 2–3 sentences
4. End with one follow-up question to deepen understanding

Return a JSON object:
{"isCorrect": boolean, "correct": ["things they got right"], "incorrect": ["things they got wrong"],
 "correction": "corrected explanation in 2-3 sentences", "followUp": "one question to go deeper"}

SOURCE MATERIAL:
${sourceText.slice(0, 8000)}`
}

// QUIZ HINT mode — hints without revealing the answer
// CRITICAL: Never reveal the correct option index or letter.
// If the student asks "just tell me the answer" — still only give a nudge.
// Only reveal the answer if they have asked for help 3+ times on the same question (shouldReveal: true).
export function buildQuizHintSystemPrompt(
  question: string,
  options: string[],
  correctIndex: number,  // server has this — NEVER send to client, NEVER include in response text
  hintCount: number
): string {
  return `You are a study assistant giving hints for a quiz question. 
CRITICAL: You must NEVER directly reveal which option is correct. Never say "The answer is A" or "Option 2 is right".
Instead, give clues that help the student reason toward the answer themselves.

The question is: "${question}"
The options are: ${options.map((o, i) => `${i + 1}. ${o}`).join(', ')}

Hint attempt number: ${hintCount}
${hintCount >= 3 ? 'This is the 3rd hint — you may now give a stronger nudge that makes the answer very clear, but still do not state it explicitly.' : ''}

Return JSON: {"nudge": "hint without revealing answer", "relatedConcept": "what concept to review",
              "shouldReveal": ${hintCount >= 3}}`
}

// ROADMAP GUIDE mode — helps student decide what to study next
export function buildRoadmapGuideSystemPrompt(roadmapState: {
  completedUnits: string[]
  currentUnit: string
  remainingUnits: string[]
  avgScore: number
}): string {
  return `You are a learning guide helping a student navigate their study roadmap.

Their progress:
- Completed: ${roadmapState.completedUnits.join(', ') || 'None yet'}
- Currently on: ${roadmapState.currentUnit}
- Remaining: ${roadmapState.remainingUnits.join(', ')}
- Average score so far: ${roadmapState.avgScore}%

Help them:
1. Understand what they should focus on in their current unit
2. Identify if they need to review anything from completed units (if score < 75%)
3. Preview what's coming next to build excitement
4. Give one concrete action they can take right now

Keep responses motivating and specific. Do not hallucinate topic content — only discuss the unit names provided.`
}

// PROBLEM SOLVER mode — analyzes uploaded problem image/PDF
export function buildProblemSolverSystemPrompt(uploadedContent: string, mimeType: string): string {
  return `You are a study assistant helping a student understand a problem from their ${mimeType.includes('image') ? 'image' : 'document'}.

The extracted content from their upload is:
${uploadedContent.slice(0, 5000)}

Your approach:
1. First, identify what TYPE of problem this is (math, coding, essay question, diagram analysis, etc.)
2. Break it down into parts the student needs to address
3. DO NOT solve it for them — guide them to solve it themselves
4. Ask them what they've already tried before giving more guidance
5. If it's a math/coding problem, point them to the relevant concept or formula

If the content extraction was poor quality (gibberish or very short), tell the student and ask them to describe the problem in text instead.`
}
```

---

## 8) Zod Schemas — `src/lib/schemas/` (updated)

```typescript
// src/lib/schemas/assistant.schema.ts

import { z } from 'zod'

// For CORRECTOR mode — structured JSON response
export const CorrectionOutputSchema = z.object({
  isCorrect: z.boolean(),
  correct: z.array(z.string()),
  incorrect: z.array(z.string()),
  correction: z.string().min(10),
  followUp: z.string().min(10),
})

// For QUIZ HINT mode — structured JSON response
export const HintOutputSchema = z.object({
  nudge: z.string().min(10),
  relatedConcept: z.string(),
  shouldReveal: z.boolean(),
})

// Assistant mode streaming is free-form text — no schema needed.
// Only corrector and hint use callAI() with schema validation.
// Everything else uses callAIStream().

// ── Existing schemas (unchanged) ─────────────────────

// flashcards.schema.ts
export const FlashcardSchema = z.object({
  id: z.string(),
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(1000),
})
export const FlashcardsOutputSchema = z.object({
  cards: z.array(FlashcardSchema).min(1).max(20),
})

// quiz.schema.ts
export const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(10),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(10),
})
export const QuizOutputSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(3).max(10),
})
```

---

## 9) Ingestion Normalization — `src/lib/ingestion/normalize.ts`

*(Unchanged from v1 — keeping for completeness)*

```typescript
import crypto from 'crypto'
import type { SourceText, SourceType } from '@/types'

export function buildSourceText(
  rawText: string,
  title: string,
  type: SourceType,
  meta: Partial<SourceText['metadata']> = {}
): SourceText {
  const chunks = chunkText(rawText, 2000)
  return { text: rawText, title, chunks, metadata: { type, ...meta } }
}

export function hashSourceText(text: string): string {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex')
}

function chunkText(text: string, wordsPerChunk: number): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
  }
  return chunks
}
```

---

## 10) Ingestion Routes — What Changes

*(Unchanged from v1 — see original for full details)*

---

## 11) Middleware — `src/middleware.ts`

*(Unchanged from v1)*

---

## 12) Plan Limits — `src/lib/limits.ts` (updated)

```typescript
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    workspaces: 2,
    aiCallsPerMonth: 20,
    assistantMessagesPerMonth: 10,    // free users get taste of assistant
    pdfUploads: 1,
    badgeMints: 0,
    sourcesPerWorkspace: 5,
    problemUploadsPerMonth: 2,        // free users can upload 2 problems
  },
  pro: {
    workspaces: Infinity,
    aiCallsPerMonth: 500,
    assistantMessagesPerMonth: Infinity,
    pdfUploads: Infinity,
    badgeMints: Infinity,
    sourcesPerWorkspace: Infinity,
    problemUploadsPerMonth: Infinity,
  },
}
// NOTE: assistantMessages and problemUploads are your strongest Pro conversion triggers.
// Free users will hit 10 messages mid-study session and feel the pain of the limit.
// Make the upgrade modal appear at message 8 with "2 messages left this month" warning.
```

---

## 13) Stripe Routes — *(Unchanged from v1)*

---

## 14) Learning Passport Rules Engine — *(Unchanged from v1)*

---

## 15) NFT Mint Route — *(Unchanged from v1)*

---

## 16) Public Verify Page — *(Unchanged from v1)*

---

## 17) GitHub Assessment — What to Fix — *(Unchanged from v1)*

---

## 18) Known Risks from Current Code — Fix Priority

| Risk | Current file | Severity | Fix |
|---|---|---|---|
| Globally open Appwrite permissions | `appwrite.ts` | 🔴 Critical | Per-user role permissions on all collections |
| Private key accessible client-side risk | `mint-nft/route.ts` | 🔴 Critical | Confirm never in NEXT_PUBLIC vars |
| Explorer URL hardcoded to Sepolia | `mint-nft/route.ts` | 🟠 High | Move to `NEXT_PUBLIC_EXPLORER_URL` env var |
| `video-validator.ts` uses raw `JSON.parse` | `video-validator.ts` | 🟠 High | Replace with `parseAiJson` |
| No auth on AI routes | all `/api/ai/*` | 🔴 Critical | Add Clerk auth check + ownership validation |
| Branch fallback missing on non-stream assess | `assess-repo/route.ts` | 🟡 Medium | Delete non-stream route, use stream only |
| Three overlapping ingestion routes | transcript/ingest/summarize | 🟡 Medium | Consolidate to `/api/ingest/youtube` |
| No rate limiting on any route | all routes | 🔴 Critical | Add Upstash ratelimit middleware |
| Sessions collection open to any Role | `appwrite.ts` setup route | 🔴 Critical | Delete setup route after migration |
| Feynman quiz_hint reveals correct answer risk | NEW | 🔴 Critical | `correctIndex` must NEVER leave server. See Section 20. |

---

## 19) Tiptap Editor Setup (updated — AI bubble menu expanded)

```typescript
// src/components/editor/TiptapEditor.tsx

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useDebouncedCallback } from 'use-debounce'
import { useEffect, useState } from 'react'

interface TiptapEditorProps {
  noteId: string
  sourceId: string            // needed to open correct assistant context
  initialContent?: string
  onSave?: (content: string) => void
  onOpenAssistant?: (mode: AssistantMode, selectedText?: string) => void  // NEW
}

export function TiptapEditor({ noteId, sourceId, initialContent, onSave, onOpenAssistant }: TiptapEditorProps) {
  const [selectedText, setSelectedText] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your notes…' }),
    ],
    content: initialContent ? JSON.parse(initialContent) : '',
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3' },
    },
    onSelectionUpdate: ({ editor }) => {
      const text = editor.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to,
        ' '
      )
      setSelectedText(text)
    },
  })

  const save = useDebouncedCallback(async () => {
    if (!editor) return
    const content = JSON.stringify(editor.getJSON())
    await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    onSave?.(content)
  }, 2000)

  useEffect(() => {
    editor?.on('update', save)
    return () => { editor?.off('update', save) }
  }, [editor, save])

  return (
    <div className="relative">
      {editor && selectedText.length > 10 && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          {/* Each button opens the assistant panel in a specific mode with the selected text pre-loaded */}
          <button onClick={() => onOpenAssistant?.('teacher', selectedText)}>
            Explain
          </button>
          <button onClick={() => onOpenAssistant?.('corrector', selectedText)}>
            Check this
          </button>
          <button onClick={() => onOpenAssistant?.('teacher', `Summarise: ${selectedText}`)}>
            Summarise
          </button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
```

---

## 20) AI Assistant System — Complete Implementation (NEW in v2)

> **Background:** Your current codebase has `/api/feynman/evaluate` and `/api/feynman/re-explain` as
> isolated voice-only routes. These are the correct foundation. This section unifies them into a
> single coherent assistant that works across 5 contexts with both text and voice input.
> Do NOT delete the Feynman routes until this system is live and tested.

### 20.1 Context Builder — `src/lib/assistant/context-builder.ts`

This is the most important file in the assistant system. It fetches the right data from Appwrite
and builds the system prompt based on what context the user is in.

```typescript
import { getSource } from '../db/sources'
import { getNote } from '../db/notes'
import { getQuizAttempt } from '../db/quizzes'
import { getWorkspace } from '../db/workspaces'
import { getChatSession } from '../db/chat-sessions'
import {
  buildTeacherSystemPrompt,
  buildCorrectorSystemPrompt,
  buildQuizHintSystemPrompt,
  buildRoadmapGuideSystemPrompt,
  buildProblemSolverSystemPrompt,
} from '../prompts/assistant'
import type { AssistantContext, AssistantMode, AssistantContextType, AssistantMessage } from '@/types'

interface BuildContextResult {
  systemPrompt: string
  // conversationMessages: already-formatted message array for the API call
  conversationMessages: { role: string; content: string }[]
}

export async function buildAssistantContext(
  userId: string,
  contextType: AssistantContextType,
  contextId: string,
  mode: AssistantMode,
  userMessage: string,
  history: AssistantMessage[],
  // For quiz_hint mode — these must come from server, never from client
  quizServerData?: { correctIndex: number; hintCount: number }
): Promise<BuildContextResult> {

  let systemPrompt = ''

  // Build system prompt based on context
  if (contextType === 'source' && (mode === 'teacher' || mode === 'corrector')) {
    // Fetch source text from Appwrite Storage
    const source = await getSource(contextId)
    if (source.userId !== userId) throw new Error('Unauthorized')

    let sourceText = ''
    if (source.rawTextPath) {
      // Fetch raw text from Appwrite Storage
      const file = await appwriteStorage.getFileDownload(source.rawTextPath)
      sourceText = await file.text()
    }

    // Also fetch user's notes for this source — adds their own context
    const note = await getNote({ sourceId: contextId, userId })
    const noteContent = note ? extractTextFromTiptap(note.content) : undefined

    systemPrompt = mode === 'teacher'
      ? buildTeacherSystemPrompt(sourceText, noteContent)
      : buildCorrectorSystemPrompt(sourceText)
  }

  else if (contextType === 'quiz' && mode === 'quiz_hint') {
    // SECURITY: correctIndex comes from server lookup, never from client request body
    const attempt = await getQuizAttempt(contextId)
    if (attempt.userId !== userId) throw new Error('Unauthorized')

    // Find the question being asked about from the message context
    // The frontend sends the question text, server verifies it exists in the attempt
    const questionIndex = attempt.questions.findIndex(q =>
      userMessage.toLowerCase().includes(q.question.toLowerCase().slice(0, 30))
    )
    const question = questionIndex >= 0 ? attempt.questions[questionIndex] : attempt.questions[0]

    systemPrompt = buildQuizHintSystemPrompt(
      question.question,
      question.options,
      question.correctIndex,  // server-side only — never sent to client
      quizServerData?.hintCount ?? 1
    )
  }

  else if (contextType === 'roadmap' && mode === 'roadmap_guide') {
    const workspace = await getWorkspace(contextId)
    if (workspace.userId !== userId) throw new Error('Unauthorized')

    // Build roadmap state from workspace + source completion data
    const roadmapState = await buildRoadmapState(workspace, userId)
    systemPrompt = buildRoadmapGuideSystemPrompt(roadmapState)
  }

  else if (contextType === 'problem' && mode === 'problem_solver') {
    // contextId is an Appwrite Storage file ID for the uploaded problem
    const fileContent = await parseUploadedFile(contextId, userId)
    systemPrompt = buildProblemSolverSystemPrompt(fileContent.text, fileContent.mimeType)
  }

  // Build conversation history for the API call
  // If there's a summary (older messages were compressed), inject it first
  const session = await getChatSession({ userId, contextType, contextId })
  const summaryMessage = session?.summary
    ? [{ role: 'user', content: `[Previous conversation summary: ${session.summary}]` },
       { role: 'assistant', content: 'Understood. I have context from our previous conversation.' }]
    : []

  const historyMessages = history.slice(-20).map(m => ({
    role: m.role,
    content: m.content,
  }))

  const conversationMessages = [
    ...summaryMessage,
    ...historyMessages,
    { role: 'user', content: userMessage },
  ]

  return { systemPrompt, conversationMessages }
}

// Extracts plain text from Tiptap JSON for injection into context
function extractTextFromTiptap(tiptapJson: string): string {
  try {
    const doc = JSON.parse(tiptapJson)
    const texts: string[] = []
    function walk(node: any) {
      if (node.type === 'text') texts.push(node.text)
      if (node.content) node.content.forEach(walk)
    }
    walk(doc)
    return texts.join(' ')
  } catch {
    return tiptapJson  // fallback if not valid JSON
  }
}
```

### 20.2 Streaming Chat Route — `POST /api/ai/assistant/chat`

```typescript
// This is the main assistant endpoint — handles teacher, corrector (streaming), and roadmap_guide modes
// NOTE: corrector mode can also use this endpoint for a conversational flow,
//       or use /api/ai/assistant/correct for the structured JSON diff response

import { auth } from '@clerk/nextjs/server'
import { buildAssistantContext } from '@/lib/assistant/context-builder'
import { callAIStream } from '@/lib/ai'
import { saveChatMessage } from '@/lib/db/chat-sessions'
import { requireLimit } from '@/lib/limits'
import { ratelimit } from '@/lib/ratelimit'

export async function POST(request: Request) {
  const { userId } = auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  // Rate limit: 20 requests/min per user for assistant
  const { success } = await ratelimit.limit(`assistant:${userId}`)
  if (!success) return new Response(JSON.stringify({ code: 'rate_limited' }), { status: 429 })

  const user = await getUser(userId)
  await requireLimit(userId, user.plan, 'assistantMessagesPerMonth')

  const body = await request.json()
  const { contextType, contextId, mode, userMessage, history, inputType } = body

  // Validate inputs
  if (!contextType || !contextId || !mode || !userMessage) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
  }

  // Build context — fetches source/quiz/roadmap data from Appwrite
  const { systemPrompt, conversationMessages } = await buildAssistantContext(
    userId, contextType, contextId, mode, userMessage, history || []
  )

  // Get streaming response from OpenRouter
  // Use 'fast' (DeepSeek) for teacher/roadmap, 'mid' (Haiku) for corrector
  const modelTier = mode === 'corrector' ? 'mid' : 'fast'
  const stream = await callAIStream({
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationMessages,
    ],
    model: modelTier,
    userId,
    routeId: '/api/ai/assistant/chat',
    maxTokens: 800,  // keep responses concise — students don't want essays
  })

  // Save the user message to chat history async — don't block the stream
  saveChatMessage({
    userId, contextType, contextId, mode, inputType,
    message: { role: 'user', content: userMessage, timestamp: new Date().toISOString(), mode, inputType }
  }).catch(() => {})

  // Return the stream directly to the client
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### 20.3 Quiz Hint Route — `POST /api/ai/assistant/hint`

```typescript
// Separate route from main chat because:
// 1. It needs to access correctIndex server-side (NEVER expose to client)
// 2. Returns structured JSON, not a stream
// 3. Tracks hintCount per question to escalate hints progressively

import { callAI } from '@/lib/ai'
import { HintOutputSchema } from '@/lib/schemas/assistant.schema'
import { buildQuizHintSystemPrompt } from '@/lib/prompts/assistant'

export async function POST(request: Request) {
  const { userId } = auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { quizAttemptId, questionId } = await request.json()

  // Server-side lookup — client never sends correctIndex
  const attempt = await getQuizAttempt(quizAttemptId)
  if (!attempt || attempt.userId !== userId) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const question = attempt.questions.find(q => q.id === questionId)
  if (!question) return Response.json({ error: 'Question not found' }, { status: 404 })

  // Get hint count for this specific question from chat history
  const session = await getChatSession({ userId, contextType: 'quiz', contextId: quizAttemptId })
  const hintCount = session?.messages.filter(
    m => m.mode === 'quiz_hint' && m.content.includes(question.question.slice(0, 20))
  ).length ?? 0

  const systemPrompt = buildQuizHintSystemPrompt(
    question.question,
    question.options,
    question.correctIndex,  // server-only — not in response
    hintCount + 1
  )

  const result = await callAI({
    prompt: `Student needs a hint for this quiz question. Generate the hint now.`,
    systemPrompt,
    schema: HintOutputSchema,
    model: 'mid',  // Haiku — needs to reason about pedagogy
    userId,
    routeId: '/api/ai/assistant/hint',
    maxTokens: 200,
  })

  // Save hint to chat history
  await saveChatMessage({
    userId, contextType: 'quiz', contextId: quizAttemptId, mode: 'quiz_hint', inputType: 'text',
    message: {
      role: 'assistant', content: result.nudge,
      timestamp: new Date().toISOString(), mode: 'quiz_hint', inputType: 'text',
      hint: result
    }
  })

  return Response.json(result)
}
```

### 20.4 Correction Route — `POST /api/ai/assistant/correct`

```typescript
// Handles two scenarios:
// A) User selects text in their notes and asks "check this"
// B) User uploads an image/PDF of their written answer

import { callAI } from '@/lib/ai'
import { CorrectionOutputSchema } from '@/lib/schemas/assistant.schema'
import { buildCorrectorSystemPrompt } from '@/lib/prompts/assistant'

export async function POST(request: Request) {
  const { userId } = auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = request.headers.get('content-type') || ''

  let userExplanation: string
  let sourceText: string
  let sourceId: string

  if (contentType.includes('multipart/form-data')) {
    // Scenario B: uploaded image/PDF
    const formData = await request.formData()
    const file = formData.get('file') as File
    sourceId = formData.get('sourceId') as string
    userExplanation = formData.get('explanation') as string ?? ''

    // Parse the uploaded file
    const parsed = await parseUploadedFile(file)
    // If image: use Gemini Flash (multimodal) to extract text from image
    // If PDF: use pdf-parse
    userExplanation = userExplanation || parsed.text
  } else {
    // Scenario A: text selection from notes
    const body = await request.json()
    sourceId = body.sourceId
    userExplanation = body.selectedText
  }

  // Fetch source material for comparison
  const source = await getSource(sourceId)
  if (!source || source.userId !== userId) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const rawSourceText = await getSourceRawText(source)

  const result = await callAI({
    prompt: `The student wrote or said: "${userExplanation}"\n\nCheck their understanding against the source material.`,
    systemPrompt: buildCorrectorSystemPrompt(rawSourceText),
    schema: CorrectionOutputSchema,
    model: 'mid',  // Haiku — needs nuanced pedagogical feedback
    userId,
    routeId: '/api/ai/assistant/correct',
    maxTokens: 600,
  })

  return Response.json(result)
}
```

### 20.5 Voice Hook — `src/hooks/useVoice.ts`

```typescript
// Wraps browser Web Speech API for both STT (speech-to-text) and TTS (text-to-speech)
// No external API needed — completely free using browser built-ins

'use client'

import { useState, useCallback, useRef } from 'react'

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Try Chrome or Edge.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('')
      setTranscript(text)
      if (event.results[event.results.length - 1].isFinal) {
        onResult(text)
      }
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error)
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  // TTS: speak assistant response aloud
  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel()  // stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  return { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking }
}
```

### 20.6 Assistant Panel Component — `src/components/assistant/AssistantPanel.tsx`

```typescript
// Main assistant UI — renders in the "Ask AI" tab of the right sidebar
// Also renders as a floating overlay during quiz (HintOverlay.tsx uses same logic)

'use client'

import { useState, useRef, useEffect } from 'react'
import { useVoice } from '@/hooks/useVoice'
import { MessageBubble } from './MessageBubble'
import { ModeSelector } from './ModeSelector'
import { VoiceButton } from './VoiceButton'
import { CorrectionDiff } from './CorrectionDiff'
import type { AssistantMode, AssistantContextType, AssistantMessage } from '@/types'

interface AssistantPanelProps {
  contextType: AssistantContextType
  contextId: string
  initialMode?: AssistantMode
  initialMessage?: string  // pre-populated from Tiptap bubble menu selection
}

export function AssistantPanel({ contextType, contextId, initialMode = 'teacher', initialMessage }: AssistantPanelProps) {
  const [mode, setMode] = useState<AssistantMode>(initialMode)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState(initialMessage ?? '')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { isListening, isSpeaking, startListening, stopListening, speak } = useVoice()

  // Auto-send if initialMessage was passed (from Tiptap bubble menu)
  useEffect(() => {
    if (initialMessage) sendMessage(initialMessage)
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: AssistantMessage = {
      role: 'user', content: text,
      timestamp: new Date().toISOString(),
      mode, inputType: isListening ? 'voice' : 'text'
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    // For corrector mode — use structured /correct endpoint, not streaming chat
    if (mode === 'corrector') {
      const res = await fetch('/api/ai/assistant/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: contextId, selectedText: text }),
      })
      const correction = await res.json()
      const assistantMsg: AssistantMessage = {
        role: 'assistant', content: correction.correction,
        timestamp: new Date().toISOString(), mode, inputType: 'text',
        correction
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsStreaming(false)
      return
    }

    // For all other modes — streaming chat
    const res = await fetch('/api/ai/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextType, contextId, mode,
        userMessage: text,
        history: messages.slice(-10),  // send last 10 messages as context
        inputType: isListening ? 'voice' : 'text',
      }),
    })

    if (!res.ok || !res.body) { setIsStreaming(false); return }

    // Stream the response token by token
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    const assistantMsg: AssistantMessage = {
      role: 'assistant', content: '',
      timestamp: new Date().toISOString(), mode, inputType: 'text'
    }
    setMessages(prev => [...prev, assistantMsg])

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      // Parse SSE chunks — each line starts with "data: "
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const data = line.replace('data: ', '')
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data)
          const token = parsed.choices?.[0]?.delta?.content ?? ''
          fullText += token
          setMessages(prev => [
            ...prev.slice(0, -1),
            { ...prev[prev.length - 1], content: fullText }
          ])
        } catch { /* malformed chunk — skip */ }
      }
    }

    // After streaming complete — speak the response if voice mode was used
    if (isListening || userMsg.inputType === 'voice') {
      speak(fullText)
    }

    setIsStreaming(false)
  }

  return (
    <div className="flex flex-col h-full">
      <ModeSelector mode={mode} onModeChange={setMode} contextType={contextType} />

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground pt-8">
            {mode === 'teacher' && 'Ask anything about this topic…'}
            {mode === 'corrector' && 'Type your understanding and I\'ll check it against the source…'}
            {mode === 'quiz_hint' && 'Stuck on a question? Ask for a hint…'}
            {mode === 'roadmap_guide' && 'Ask me what to focus on next…'}
            {mode === 'problem_solver' && 'Upload your problem or describe it…'}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <MessageBubble message={msg} />
            {msg.correction && <CorrectionDiff correction={msg.correction} />}
          </div>
        ))}
        {isStreaming && <div className="text-xs text-muted-foreground animate-pulse">Thinking…</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder={isListening ? 'Listening…' : 'Ask something…'}
          className="flex-1 text-sm border rounded-lg px-3 py-2"
          disabled={isStreaming}
        />
        <VoiceButton
          isListening={isListening}
          isSpeaking={isSpeaking}
          onStart={() => startListening(text => sendMessage(text))}
          onStop={stopListening}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

---

## 21) Quiz Hint Integration — `src/components/quiz/QuizHintButton.tsx` (NEW)

```typescript
// Floating hint button during quiz — opens HintOverlay without leaving the quiz page

'use client'

import { useState } from 'react'
import type { QuizQuestion } from '@/types'

interface QuizHintButtonProps {
  question: QuizQuestion
  quizAttemptId: string
}

export function QuizHintButton({ question, quizAttemptId }: QuizHintButtonProps) {
  const [hint, setHint] = useState<{ nudge: string; relatedConcept: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const requestHint = async () => {
    setLoading(true)
    const res = await fetch('/api/ai/assistant/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizAttemptId, questionId: question.id }),
    })
    const data = await res.json()
    setHint(data)
    setLoading(false)
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={requestHint}
        disabled={loading}
        className="text-xs text-muted-foreground underline mt-2"
      >
        {loading ? 'Getting hint…' : 'Need a hint?'}
      </button>

      {open && hint && (
        // Simple overlay — no router navigation, stays on quiz page
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
             onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
               onClick={e => e.stopPropagation()}>
            <h3 className="font-medium text-sm mb-2">Hint</h3>
            <p className="text-sm mb-3">{hint.nudge}</p>
            {hint.relatedConcept && (
              <p className="text-xs text-muted-foreground">Review: {hint.relatedConcept}</p>
            )}
            <button onClick={() => setOpen(false)} className="mt-4 text-xs underline">
              Got it, back to quiz
            </button>
          </div>
        </div>
      )}
    </>
  )
}
```

---

## 22) Problem Upload Handler — `POST /api/ai/assistant/upload` (NEW)

```typescript
// Handles image and PDF uploads for the problem_solver assistant mode.
// STRATEGY:
// - Images: send directly to Gemini Flash multimodal (it can see images natively)
//           Gemini 2.5 Flash-Lite supports image input at $0.10/M tokens
// - PDFs: extract text with pdf-parse, then use DeepSeek for analysis
// This keeps costs minimal — only use the multimodal model when genuinely needed.

import { put } from '@/lib/appwrite-storage'  // wrapper around Appwrite Storage

export async function POST(request: Request) {
  const { userId } = auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await requireLimit(userId, user.plan, 'problemUploadsPerMonth')

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: 'Only JPEG, PNG, WebP images and PDFs are supported' }, { status: 400 })
  }

  // Validate file size: 5MB max
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'File too large — max 5MB' }, { status: 400 })
  }

  let extractedText: string
  let fileId: string

  if (file.type === 'application/pdf') {
    // PDF: extract text server-side, store the text
    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfData = await pdfParse(buffer)
    extractedText = pdfData.text.slice(0, 5000)

    // Store file in Appwrite Storage for audit trail
    fileId = await storeFileInAppwrite(file, userId)
  } else {
    // Image: store in Appwrite Storage, return fileId
    // The actual AI analysis happens in /api/ai/assistant/chat when mode = 'problem_solver'
    // We send the image URL to Gemini Flash (multimodal) there
    fileId = await storeFileInAppwrite(file, userId)

    // For images, use Gemini Flash multimodal to extract text/description
    extractedText = await extractTextFromImage(fileId, file.type)
  }

  return Response.json({ fileId, extractedText, mimeType: file.type })
}

async function extractTextFromImage(fileId: string, mimeType: string): Promise<string> {
  // Get the file URL from Appwrite Storage
  const fileUrl = getAppwriteFileUrl(fileId)

  // Use Gemini Flash-Lite (supports image input) via OpenRouter
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL_BUDGET,  // Gemini Flash-Lite — multimodal
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: fileUrl }
          },
          {
            type: 'text',
            text: 'Extract and transcribe all text, equations, diagrams, and problem statements visible in this image. Be thorough and exact.'
          }
        ]
      }]
    }),
  })

  const data = await res.json()
  return data.choices[0].message.content
}
```

---

## 23) Model Routing Summary — Which Model for Which Task

| Task | Route | Model | Cost/call | Rationale |
|---|---|---|---|---|
| YouTube summarise | `/api/ingest/youtube` | `budget` (Gemini Flash-Lite) | ~$0.0005 | Simple text task |
| Flashcard generation | `/api/ai/flashcards` | `fast` (DeepSeek V4 Flash) | ~$0.0008 | Best structured JSON output |
| Concept map | `/api/ai/concept-map` | `fast` (DeepSeek V4 Flash) | ~$0.001 | Graph node/edge JSON |
| AI note summary | `/api/ai/summary` | `budget` (Gemini Flash-Lite) | ~$0.0005 | Cheapest reliable |
| Quiz generation | `/api/ai/quiz` | `mid` (Claude Haiku 4.5) | ~$0.005 | Pedagogical quality matters |
| Feynman/corrector | `/api/ai/assistant/correct` | `mid` (Claude Haiku 4.5) | ~$0.008 | Nuanced feedback |
| Quiz hint | `/api/ai/assistant/hint` | `mid` (Claude Haiku 4.5) | ~$0.003 | Needs to understand pedagogy |
| Assistant chat (teacher/guide) | `/api/ai/assistant/chat` | `fast` (DeepSeek V4 Flash) | ~$0.002/msg | Fast streaming, good context |
| Problem image OCR | `/api/ai/assistant/upload` | `budget` (Gemini Flash-Lite) | ~$0.002 | Multimodal — Gemini only |
| GitHub repo grading | `/api/github/assess` | `smart` (Claude Sonnet 4.6) | ~$0.04 | Needs real code reasoning |
| Master cert assessment | `/api/passport/mint` | `smart` (Claude Sonnet 4.6) | ~$0.02 | High-stakes — quality first |
| Badge rules evaluation | `src/lib/passport/rules.ts` | None — pure logic | $0 | No AI needed for rule checks |

**Cost estimate at 100 active users/month:** ~$18–25 total AI cost.
**At ₹499/mo × 100 users = ₹49,900 MRR. Gross margin on AI layer: ~97%.**

**Cost saving trick:** Add your DeepSeek API key in OpenRouter provider settings.
This bypasses OpenRouter's 5% markup on all DeepSeek calls.
With caching enabled on DeepSeek (stable system prompts), cache-hit input tokens cost $0.0028/M instead of $0.14/M — a 50x reduction on repeated context (like source text that appears in every assistant call for a given source).

---

## 24) Updated Go-Live Checklist

### Before charging users (security first):
- [ ] Clerk auth protecting all `/app/*` routes
- [ ] Per-user Appwrite permissions (no `Role.any()`)
- [ ] Stripe webhook signature verified before any plan update
- [ ] Private key confirmed server-only (grep codebase: `NEXT_PUBLIC_PRIVATE_KEY` must not exist)
- [ ] Rate limiting active on all AI routes (including assistant)
- [ ] Plan limits enforced server-side on AI routes
- [ ] Explorer URL pointing to Polygon mainnet not Sepolia
- [ ] **`correctIndex` confirmed never present in any API response to client** — grep for it
- [ ] **File upload size validated server-side** — not just client-side (client-side is bypassable)
- [ ] **Uploaded files stored in Appwrite Storage with per-user permissions** — not publicly accessible

### Before ProductHunt:
- [ ] Public verify page renders with correct OG tags (test with LinkedIn Post Inspector)
- [ ] LinkedIn share card works
- [ ] NFT minting idempotency key prevents double-mint
- [ ] Passport rules engine tested: micro → skill → master chain
- [ ] Tiptap auto-save confirmed (watch Appwrite logs during typing)
- [ ] PDF upload size limit enforced (10MB)
- [ ] Free tier limits block at correct threshold (create test account, hit limit)
- [ ] **Assistant streaming works end-to-end: text input → tokens appear → voice reads response**
- [ ] **Quiz hint tested: does NOT reveal correct answer in response JSON**
- [ ] **Corrector diff renders correctly in CorrectionDiff.tsx**
- [ ] **Voice works in Chrome AND mobile Safari** (Web Speech API has different quirks on iOS)
- [ ] **Problem upload: image OCR extraction tested with a real handwritten problem**
- [ ] **Chat session history persists across page refreshes** (check chat_sessions collection)
- [ ] **History summarization runs correctly when messages > 30** — prevents context bloat

### Contract:
- [ ] Redeploy `SkillNFT.sol` with new name (not "LearnLoop Skill" / "LSKL")
- [ ] New contract address in env vars
- [ ] Verify contract on Polygonscan

### Assistant feature — important caveats for launch:
> These are things that will bite you if you don't address them before real users:
>
> 1. **Web Speech API on iOS Safari** behaves differently — it requires a user gesture (button tap)
>    to start and has shorter timeout before auto-stopping. Test on iPhone before launch.
>
> 2. **DeepSeek API can be slow** (higher latency than Claude/GPT on first token).
>    Add a visible "Thinking…" animation immediately on submit so users don't think it froze.
>    Streaming helps here — first token usually appears within 1-2 seconds.
>
> 3. **The corrector mode returns JSON** but you're displaying it as a diff UI.
>    Make sure CorrectionDiff.tsx handles edge cases: empty `correct` array, very long corrections,
>    and the case where `isCorrect: true` (user was right — celebrate this, don't just say "correct").
>
> 4. **Context window management:** DeepSeek V4 Flash has 1M tokens but you're paying per token.
>    Cap source text injection at 8000 tokens. Cap conversation history at 20 messages.
>    Use the `summary` field in `chat_sessions` to compress older messages.
>
> 5. **The roadmap feature is your most compelling demo** but also the most complex to build.
>    Launch without it. Ship teacher + corrector + quiz hint first.
>    Roadmap guide can come in week 3 after you have users testing the simpler modes.

---

*v2 of this document. Every file path maps to your existing repo or is a new file to create.
Start with Section 18 (security fixes), then Section 20.2 (assistant chat route),
then Section 20.5 (voice hook). The rest builds on top of those three.*
