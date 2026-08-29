import fs from 'fs/promises';
import path from 'path';
import type { TextSection } from '@/lib/ingestion/structured-text';

export interface SourceChunk {
  id: string;
  sourceId: string;
  chunkIndex: number;
  text: string;
  wordCount: number;
  pageStart?: number;
  pageEnd?: number;
  sectionTitle?: string;
  headingPath?: string[];
}

export interface ChunkSourcePage {
  pageNumber: number;
  text: string;
}

import os from 'os';

const BASE_DIR = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? path.join(os.tmpdir(), 'learnloop-data')
  : path.join(process.cwd(), 'data');

const CHUNK_DIR = path.join(BASE_DIR, 'source-chunks');
const DEFAULT_WORDS_PER_CHUNK = 750;
const DEFAULT_OVERLAP_WORDS = 120;
const URL_WORDS_PER_CHUNK = 450;
const MAX_CONTEXT_CHARS = 60000;

async function ensureChunkDir() {
  try {
    await fs.mkdir(CHUNK_DIR, { recursive: true });
  } catch (error) {}
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/).map(w => w.trim()).filter(Boolean);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function estimatePageForWord(wordIndex: number, totalWords: number, pageCount?: number): number | undefined {
  if (!pageCount || pageCount <= 0 || totalWords <= 0) return undefined;
  const page = Math.floor((wordIndex / totalWords) * pageCount) + 1;
  return Math.max(1, Math.min(page, pageCount));
}

function reindexChunks(sourceId: string, chunks: SourceChunk[]): SourceChunk[] {
  return chunks.map((chunk, index) => ({
    ...chunk,
    id: `${sourceId}:${index}`,
    chunkIndex: index,
  }));
}

export function chunkTextByWords(
  sourceId: string,
  text: string,
  options: {
    wordsPerChunk?: number;
    overlapWords?: number;
    pageCount?: number;
    sectionTitle?: string;
    headingPath?: string[];
  } = {}
): SourceChunk[] {
  const words = wordsOf(text);
  const wordsPerChunk = options.wordsPerChunk ?? DEFAULT_WORDS_PER_CHUNK;
  const overlapWords = Math.min(options.overlapWords ?? DEFAULT_OVERLAP_WORDS, wordsPerChunk - 1);
  const step = wordsPerChunk - overlapWords;
  const chunks: SourceChunk[] = [];

  for (let start = 0, index = 0; start < words.length; start += step, index += 1) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunkWords = words.slice(start, end);
    if (chunkWords.length < 40 && chunks.length > 0) break;

    const pageStart = estimatePageForWord(start, words.length, options.pageCount);
    const pageEnd = estimatePageForWord(end, words.length, options.pageCount);
    chunks.push({
      id: `${sourceId}:${index}`,
      sourceId,
      chunkIndex: index,
      text: chunkWords.join(' '),
      wordCount: chunkWords.length,
      pageStart,
      pageEnd,
      sectionTitle: options.sectionTitle,
      headingPath: options.headingPath,
    });

    if (end >= words.length) break;
  }

  return chunks;
}

export function chunkSections(
  sourceId: string,
  sections: TextSection[],
  options: {
    wordsPerChunk?: number;
    overlapWords?: number;
    documentTitle?: string;
  } = {}
): SourceChunk[] {
  const wordsPerChunk = options.wordsPerChunk ?? URL_WORDS_PER_CHUNK;
  const chunks: SourceChunk[] = [];

  for (const section of sections) {
    const sectionTitle = section.heading ?? options.documentTitle;
    const sectionChunks = chunkTextByWords(sourceId, section.text, {
      wordsPerChunk,
      overlapWords: DEFAULT_OVERLAP_WORDS,
      sectionTitle,
      headingPath: section.headingPath,
    });

    for (const chunk of sectionChunks) {
      chunks.push({
        ...chunk,
        chunkIndex: chunks.length,
        id: `${sourceId}:${chunks.length}`,
      });
    }
  }

  return reindexChunks(sourceId, chunks);
}

export function chunkPages(
  sourceId: string,
  pages: ChunkSourcePage[],
  options: { wordsPerChunk?: number; overlapWords?: number } = {}
): SourceChunk[] {
  const wordsPerChunk = options.wordsPerChunk ?? DEFAULT_WORDS_PER_CHUNK;
  const overlapWords = Math.min(options.overlapWords ?? DEFAULT_OVERLAP_WORDS, wordsPerChunk - 1);
  const chunks: SourceChunk[] = [];

  type ParagraphUnit = { text: string; pageNumber: number; wordCount: number };
  const units: ParagraphUnit[] = [];

  for (const page of pages) {
    if (!page.text.trim()) continue;
    const paragraphs = page.text.split(/\n\n+/).map(part => part.trim()).filter(Boolean);
    for (const paragraph of paragraphs) {
      units.push({
        text: paragraph,
        pageNumber: page.pageNumber,
        wordCount: wordsOf(paragraph).length,
      });
    }
  }

  let buffer: ParagraphUnit[] = [];
  let bufferWords = 0;

  const flush = (allowPartial = false) => {
    if (buffer.length === 0) return;
    if (!allowPartial && bufferWords < 40) return;

    const chunkIndex = chunks.length;
    chunks.push({
      id: `${sourceId}:${chunkIndex}`,
      sourceId,
      chunkIndex,
      text: buffer.map(unit => unit.text).join('\n\n'),
      wordCount: bufferWords,
      pageStart: buffer[0]?.pageNumber,
      pageEnd: buffer[buffer.length - 1]?.pageNumber,
      sectionTitle: buffer[0]?.pageNumber ? `Page ${buffer[0].pageNumber}` : undefined,
    });

    if (bufferWords <= overlapWords) {
      buffer = [];
      bufferWords = 0;
      return;
    }

    const overlapUnits: ParagraphUnit[] = [];
    let overlapCount = 0;
    for (let i = buffer.length - 1; i >= 0; i -= 1) {
      overlapUnits.unshift(buffer[i]);
      overlapCount += buffer[i].wordCount;
      if (overlapCount >= overlapWords) break;
    }

    buffer = overlapUnits;
    bufferWords = overlapUnits.reduce((sum, unit) => sum + unit.wordCount, 0);
  };

  for (const unit of units) {
    if (bufferWords + unit.wordCount > wordsPerChunk && buffer.length > 0) {
      flush(true);
    }
    buffer.push(unit);
    bufferWords += unit.wordCount;
  }

  flush(true);
  return reindexChunks(sourceId, chunks);
}

export async function saveSourceChunks(sourceId: string, chunks: SourceChunk[]): Promise<void> {
  try {
    await ensureChunkDir();
    const filePath = path.join(CHUNK_DIR, `${sourceId}.jsonl`);
    await fs.writeFile(filePath, chunks.map(chunk => JSON.stringify(chunk)).join('\n'), 'utf-8');
  } catch (error) {
    console.warn('[source-chunks] Skipping local chunk file write:', error);
  }
}

export async function getSourceChunks(sourceId: string): Promise<SourceChunk[]> {
  try {
    const filePath = path.join(CHUNK_DIR, `${sourceId}.jsonl`);
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').filter(Boolean).map(line => JSON.parse(line) as SourceChunk);
  } catch {
    return [];
  }
}

function tokenizeQuery(text: string): string[] {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'when', 'where', 'why', 'how',
    'into', 'about', 'your', 'you', 'are', 'was', 'were', 'have', 'has', 'had', 'does', 'did',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !stop.has(token));
}

function extractPhrases(query: string): string[] {
  const tokens = tokenizeQuery(query);
  const phrases: string[] = [];
  for (let size = 3; size >= 2; size -= 1) {
    for (let i = 0; i <= tokens.length - size; i += 1) {
      phrases.push(tokens.slice(i, i + size).join(' '));
    }
  }
  return phrases;
}

function countTermMatches(text: string, term: string): number {
  const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, 'g');
  return (text.match(pattern) || []).length;
}

function scoreChunk(chunk: SourceChunk, terms: string[], phrases: string[]): number {
  const text = chunk.text.toLowerCase();
  const heading = (chunk.sectionTitle || '').toLowerCase();
  const pathText = (chunk.headingPath || []).join(' ').toLowerCase();
  let score = 0;

  for (const phrase of phrases) {
    if (text.includes(phrase)) score += 5;
    if (heading.includes(phrase)) score += 8;
    if (pathText.includes(phrase)) score += 6;
  }

  for (const term of terms) {
    score += countTermMatches(text, term);
    if (heading.includes(term)) score += 4;
    if (pathText.includes(term)) score += 3;
  }

  return score;
}

export async function retrieveSourceChunks(
  sourceId: string,
  query: string,
  options: { limit?: number; maxChars?: number } = {}
): Promise<SourceChunk[]> {
  const chunks = await getSourceChunks(sourceId);
  if (chunks.length === 0) return [];

  const terms = tokenizeQuery(query);
  if (terms.length === 0) return chunks.slice(0, options.limit ?? 8);

  const phrases = extractPhrases(query);
  const scored = chunks.map(chunk => ({
    chunk,
    score: scoreChunk(chunk, terms, phrases),
  }));

  const maxChars = options.maxChars ?? MAX_CONTEXT_CHARS;
  const selected: SourceChunk[] = [];
  let totalChars = 0;

  for (const { chunk, score } of scored.sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)) {
    if (score <= 0) continue;
    if (selected.length >= (options.limit ?? 10)) break;
    if (totalChars + chunk.text.length > maxChars && selected.length > 0) continue;
    selected.push(chunk);
    totalChars += chunk.text.length;
  }

  if (selected.length === 0) {
    return chunks.slice(0, options.limit ?? 8);
  }

  const selectedIndexes = new Set(selected.map(chunk => chunk.chunkIndex));
  for (const chunk of chunks) {
    if (selectedIndexes.has(chunk.chunkIndex)) continue;
    const neighborScore = scored.find(item => item.chunk.chunkIndex === chunk.chunkIndex)?.score ?? 0;
    if (neighborScore > 0) continue;

    const hasStrongNeighbor = selected.some(existing =>
      Math.abs(existing.chunkIndex - chunk.chunkIndex) === 1 &&
      (scored.find(item => item.chunk.chunkIndex === existing.chunkIndex)?.score ?? 0) >= 3
    );

    if (hasStrongNeighbor && selected.length < (options.limit ?? 10)) {
      if (totalChars + chunk.text.length <= maxChars) {
        selected.push(chunk);
        selectedIndexes.add(chunk.chunkIndex);
        totalChars += chunk.text.length;
      }
    }
  }

  return selected.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

export function formatChunkLabel(chunk: SourceChunk): string {
  const parts: string[] = [];

  if (chunk.headingPath && chunk.headingPath.length > 1) {
    parts.push(`Path: ${chunk.headingPath.join(' > ')}`);
  } else if (chunk.sectionTitle) {
    parts.push(`Section: ${chunk.sectionTitle}`);
  }

  if (chunk.pageStart) {
    parts.push(
      chunk.pageEnd && chunk.pageEnd !== chunk.pageStart
        ? `Page ${chunk.pageStart}-${chunk.pageEnd}`
        : `Page ${chunk.pageStart}`
    );
  }

  parts.push(`Chunk ${chunk.chunkIndex + 1}`);
  return parts.join(' | ');
}

export function formatChunksForPrompt(chunks: SourceChunk[]): string {
  return chunks.map(chunk => `[${formatChunkLabel(chunk)}]\n${chunk.text}`).join('\n\n---\n\n');
}

export async function buildSourceCoverageContext(sourceId: string, maxChars = 70000): Promise<string | null> {
  const chunks = await getSourceChunks(sourceId);
  if (chunks.length === 0) return null;

  const stride = Math.max(1, Math.floor(chunks.length / 24));
  const coverage = chunks.filter((_, index) => index % stride === 0).slice(0, 30);
  const formatted = formatChunksForPrompt(coverage);
  return formatted.slice(0, maxChars);
}
