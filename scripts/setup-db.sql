-- LearnLoop Supabase Database Schema Setup Script
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  wallet TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  "sourceCount" INT NOT NULL DEFAULT 0,
  "completedUnits" INT NOT NULL DEFAULT 0,
  "totalUnits" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Sources Table
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  "inputHash" TEXT NOT NULL,
  "rawTextPath" TEXT,
  metadata TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Source chunks for grounded retrieval. The app currently also writes a local
-- JSONL copy for development; production should write/read this table and use
-- the embedding column for vector search.
CREATE TABLE IF NOT EXISTS public.source_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceId" TEXT NOT NULL,
  "chunkIndex" INT NOT NULL,
  text TEXT NOT NULL,
  "wordCount" INT NOT NULL,
  "pageStart" INT,
  "pageEnd" INT,
  "sectionTitle" TEXT,
  embedding vector(1536),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_source_chunk UNIQUE ("sourceId", "chunkIndex")
);

-- 4. Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  "wordCount" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Flashcard Sets Table
CREATE TABLE IF NOT EXISTS public.flashcard_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  cards TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  model TEXT NOT NULL,
  "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  questions TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INT NOT NULL,
  passed BOOLEAN NOT NULL,
  "takenAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Badges Table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  skill TEXT NOT NULL,
  "sourceId" TEXT,
  "workspaceId" TEXT,
  "evidenceIds" TEXT NOT NULL,
  "componentBadgeIds" TEXT,
  score INT NOT NULL,
  "tokenId" TEXT,
  "txHash" TEXT,
  "ipfsHash" TEXT,
  "metadataUri" TEXT,
  "mintedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "idempotencyKey" TEXT UNIQUE
);

-- 8. Chat Sessions Table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "contextType" TEXT NOT NULL,
  "contextId" TEXT NOT NULL,
  messages TEXT NOT NULL,
  mode TEXT NOT NULL,
  "inputType" TEXT NOT NULL DEFAULT 'text',
  summary TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Usage Log Table
CREATE TABLE IF NOT EXISTS public.usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  route TEXT NOT NULL,
  model TEXT,
  "inputTokens" INT DEFAULT 0,
  "outputTokens" INT DEFAULT 0,
  cached BOOLEAN DEFAULT false,
  "durationMs" INT DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Sandbox Traces Table
CREATE TABLE IF NOT EXISTS public.sandbox_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "submissionId" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceId" TEXT,
  code TEXT NOT NULL,
  frames TEXT NOT NULL,
  "testResults" TEXT,
  stdout TEXT NOT NULL,
  stderr TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Math Attempts Table
CREATE TABLE IF NOT EXISTS public.math_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "problemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  steps TEXT NOT NULL,
  "finalAnswerCorrect" BOOLEAN NOT NULL,
  "confidenceScore" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Concept Mastery Table
CREATE TABLE IF NOT EXISTS public.concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "studentId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "masteryScore" DOUBLE PRECISION NOT NULL,
  stability DOUBLE PRECISION NOT NULL,
  "lastReviewed" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sourceOfMastery" TEXT NOT NULL,
  CONSTRAINT unique_student_concept UNIQUE ("studentId", "conceptId")
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_workspaces_userId ON public.workspaces("userId");
CREATE INDEX IF NOT EXISTS idx_sources_workspaceId ON public.sources("workspaceId");
CREATE INDEX IF NOT EXISTS idx_sources_inputHash ON public.sources("inputHash", "userId");
CREATE INDEX IF NOT EXISTS idx_source_chunks_sourceId ON public.source_chunks("sourceId", "chunkIndex");
CREATE INDEX IF NOT EXISTS idx_source_chunks_embedding ON public.source_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_notes_sourceId ON public.notes("sourceId");
CREATE INDEX IF NOT EXISTS idx_flashcards_sourceId ON public.flashcard_sets("sourceId");
CREATE INDEX IF NOT EXISTS idx_quizzes_sourceId ON public.quiz_attempts("sourceId");
CREATE INDEX IF NOT EXISTS idx_quizzes_userId ON public.quiz_attempts("userId");
CREATE INDEX IF NOT EXISTS idx_badges_userId ON public.badges("userId");
CREATE INDEX IF NOT EXISTS idx_chat_sessions_lookup ON public.chat_sessions("userId", "contextType", "contextId", mode);
CREATE INDEX IF NOT EXISTS idx_usage_log_user_date ON public.usage_log("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_sandbox_traces_subId ON public.sandbox_traces("submissionId");
CREATE INDEX IF NOT EXISTS idx_concept_mastery_student ON public.concept_mastery("studentId");
