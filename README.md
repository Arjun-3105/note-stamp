# Notestamp - AI Study Workspace + Learning Passport

Notestamp (formerly LearnLoop) is an AI study workspace. Import learning content from YouTube, PDFs, web pages or plain text, study it with generated notes, flashcards, concept maps, quizzes and practice problems, and earn on-chain credentials backed by real progress.

---

## Features

- **Multi-source import**
  - YouTube transcripts, PDFs, article URLs and pasted text
  - Content is chunked and paged so progress is tracked per chunk, page and topic

- **Study workspace**
  - Persistent workspaces with multiple sources each
  - Block-based notes editor (BlockNote)
  - AI flashcards with spaced repetition (FSRS), concept maps, prerequisite maps and roadmaps
  - AI assistant panel with modes, hints, answer correction and problem upload

- **Practice and assessment**
  - Quiz generation and quiz analysis reports
  - Practice problem generation and verification
  - Math workspace: MathLive input, step-by-step verification, symbolic solving (Algebrite) and Desmos graphing
  - Code sandbox with execution and tracing
  - GitHub repo assessment, auto-read into quizzes, with checkpoint-level feedback

- **Learning passport**
  - Achievements passport with badges earned from progress
  - ERC-721 skill credentials minted on-chain, metadata on IPFS via Pinata
  - Public credential verification page (`/verify/[tokenId]`)
  - Global MetaMask wallet connection

- **Accounts and billing**
  - Clerk authentication, synced to Supabase via webhook
  - Stripe subscriptions (Pro and Certificate plans) with a billing portal
  - Rate limiting via Upstash Redis

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 18, TailwindCSS 4, Framer Motion, Mantine, BlockNote, Monaco, KaTeX, MathLive, React Flow, D3, Mermaid, Three.js
- **Backend:** Next.js Route Handlers, Supabase (Postgres), Clerk, Stripe, Upstash Redis
- **AI:** OpenRouter with tiered model routing and a direct Gemini fallback
- **Blockchain:** Solidity (ERC-721, OpenZeppelin), Hardhat, Ethers.js v6, Pinata/IPFS
- **Ingestion:** `youtube-transcript`, `pdf-parse`, Mozilla Readability + jsdom, optional ScrapeGraphAI

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/Arjun-3105/note-stamp.git
cd note-stamp
npm install
```

The repo includes an `.npmrc` with `legacy-peer-deps` to resolve BlockNote/Mantine peer dependency conflicts.

### 2. Environment variables

Copy `.env.example` to `.env` and fill in:

| Area | Variables |
|---|---|
| Auth (Clerk) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| Database (Supabase) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| AI | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_BUDGET`, `OPENROUTER_MODEL_FAST`, `OPENROUTER_MODEL_MID`, `OPENROUTER_MODEL_SMART`, `OPENROUTER_MODEL_FALLBACK`, `GEMINI_MODEL`, `GEMINI_API_KEY` (for the Gemini fallback) |
| Billing (Stripe) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_CERT_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Blockchain | `RPC_URL`, `PRIVATE_KEY`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_EXPLORER_URL` |
| IPFS (Pinata) | `PINATA_JWT`, `PINATA_API_KEY`, `PINATA_SECRET_KEY` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| App | `NEXT_PUBLIC_APP_URL` |
| Optional | `SCRAPEGRAPH_API_KEY` (richer URL extraction) |

> Note: `.env.example` lists `CONTRACT_ADDRESS`, but the mint route and passport page read `NEXT_PUBLIC_CONTRACT_ADDRESS`. Set the latter.

### 3. Set up the database

Run `scripts/setup-db.sql` in the Supabase SQL editor, then check that the tables exist:

```bash
npm run db:check
```

### 4. Deploy the contract (optional, needed for minting)

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Copy the deployed address into `NEXT_PUBLIC_CONTRACT_ADDRESS`. An `amoy` (Polygon testnet) network is also configured in `hardhat.config.js`.

### 5. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Usage

1. Sign in, then create a workspace.
2. Import a source (YouTube, PDF, URL or text) from `/import` or the workspace.
3. Study in the learn view: notes, flashcards, concept maps, assistant, math whiteboard and code sandbox.
4. Take quizzes and practice problems. Progress is tracked per chunk, page and topic.
5. Optionally connect GitHub to have a repo assessed and turned into a quiz.
6. Earn badges in your passport, connect MetaMask and mint a skill credential on-chain.

---

## Project Structure

- `src/app/(app)/` - signed-in pages: dashboard, import, workspace, passport, roadmap, profile, settings/billing
- `src/app/(workspace)/learn/` - the study view for a workspace source
- `src/app/(auth)/` - Clerk sign-in and sign-up
- `src/app/verify/`, `src/app/profile/nft/` - public credential and NFT pages
- `src/app/api/` - route handlers (ingest, ai, flashcards, concept-map, quiz, practice, math, sandbox, assess-repo, badges, mint-nft, stripe, webhooks, and more)
- `src/components/` - UI components (assistant, editor, learn, math, quiz, sandbox, wallet, badges, ...)
- `src/lib/` - AI routing, ingestion, Supabase, Stripe, rate limiting, progress tracking
- `contracts/` - `SkillNFT.sol` ERC-721 contract
- `scripts/` - contract deploy, database SQL and table check
- `data/` - local cache for transcripts, source chunks and pages, progress and roadmaps
- `notestamp_saas_spec_v2.md`, `newspecs.md` - product specs

---

## Deployment

The app deploys to Vercel. `vercel.json` raises `maxDuration` to 60s for the long-running AI routes (ingest, assignment, concept map, flashcards, repo assessment, quiz analysis).

---

## Contributing

1. Fork the repo
2. Create your branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes
4. Push to your branch
5. Open a pull request
