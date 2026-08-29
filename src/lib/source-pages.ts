import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { ChunkSourcePage } from '@/lib/source-chunks';

const BASE_DIR = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? path.join(os.tmpdir(), 'learnloop-data')
  : path.join(process.cwd(), 'data');

const PAGE_DIR = path.join(BASE_DIR, 'source-pages');

async function ensurePageDir() {
  try {
    await fs.mkdir(PAGE_DIR, { recursive: true });
  } catch (error) {}
}

export async function saveSourcePages(sourceId: string, pages: ChunkSourcePage[]): Promise<void> {
  try {
    await ensurePageDir();
    const filePath = path.join(PAGE_DIR, `${sourceId}.jsonl`);
    await fs.writeFile(filePath, pages.map(page => JSON.stringify(page)).join('\n'), 'utf-8');
  } catch (error) {
    console.warn('[source-pages] Skipping local page file write:', error);
  }
}

export async function getSourcePages(sourceId: string): Promise<ChunkSourcePage[]> {
  try {
    const filePath = path.join(PAGE_DIR, `${sourceId}.jsonl`);
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as ChunkSourcePage)
      .sort((a, b) => a.pageNumber - b.pageNumber);
  } catch {
    return [];
  }
}

export async function getSourcePage(sourceId: string, pageNumber: number): Promise<ChunkSourcePage | null> {
  const pages = await getSourcePages(sourceId);
  return pages.find(page => page.pageNumber === pageNumber) ?? null;
}

export async function getSourcePageCount(sourceId: string): Promise<number> {
  const pages = await getSourcePages(sourceId);
  return pages.length;
}
