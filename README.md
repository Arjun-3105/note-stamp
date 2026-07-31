# Notestamp - AI Study Workspace + Learning Passport

LearnLoop is evolving from a hackathon proof-of-concept into a full study workspace.
Import learning content, generate structured study artifacts, track mastery over time, and earn verifiable credentials from real progress.

---

## Features (Current + In Progress)

- Workspace-centered learning
  - Persistent sessions and history
  - AI flashcards, concept maps, assignments, quiz analysis
  - Resume and continue learning instead of one-shot generation

- Assessment and evidence
  - GitHub repo assessment flow
  - Checkpoint-level feedback and score outputs
  - Foundation for evidence-based progression

- Learning passport (roadmap)
  - Micro badges per chapter
  - Skill badges per track
  - Master credential from cumulative evidence

---

## Why This Is Different

- Not just YouTube-to-NFT automation
- Persistent study workspace as system of record
- Multi-source ingestion roadmap (YouTube, PDF, article, text, audio)
- Credentialing tied to progression evidence, not a single completion click

---

## Tech Stack

- Frontend: Next.js 16, React 19, TailwindCSS 4, Framer Motion
- Backend: Next.js Route Handlers, Appwrite, OpenRouter-compatible LLM APIs
- Blockchain: Solidity (ERC-721), Hardhat, Ethers.js, IPFS metadata via Pinata
- Other: Mermaid.js, Dagre, YouTube Transcript API

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/yourusername/learnloop.git
cd learnloop
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in:

- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `YOUTUBE_API_KEY`
- `APP_URL`
- `NEXT_PUBLIC_APPWRITE_*` and `APPWRITE_API_KEY`
- `PINATA_API_KEY`, `PINATA_SECRET_KEY`, `PINATA_JWT`
- `RPC_URL`, `PRIVATE_KEY`, `NEXT_PUBLIC_CONTRACT_ADDRESS`

### 3. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Usage (Current Flow)

1. Paste a YouTube URL to generate flashcards, concept map, and assignment.
2. Connect GitHub for code assessment and grading.
3. Complete and submit work for evaluation.
4. Mint credential output on-chain.

---

## Project Structure

- `src/app/` - Next.js app routes and API handlers
- `src/components/` - UI components
- `src/lib/` - shared utilities and integrations
- `contracts/` - Solidity smart contracts
- `scripts/` - deployment scripts
- `IMPLEMENTATION_TASKLIST.md` - handoff execution plan for humans/LLMs

---

## Execution Roadmap

The active implementation checklist lives in:

- `IMPLEMENTATION_TASKLIST.md`

This file is designed for multi-LLM handoff and includes:
- phase-wise tasks
- status tracking
- completion timestamps
- known tech debt
- recommended execution order

---

## Contributing

1. Fork the repo
2. Create your branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes
4. Push to your branch
5. Open a pull request

---

## License

This project is licensed under the MIT License.
