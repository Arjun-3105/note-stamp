import fs from 'fs/promises';
import path from 'path';
import type { ChunkSourcePage } from '@/lib/source-chunks';

const PAGE_DIR = path.join(process.cwd(), 'data', 'source-pages');

async function ensurePageDir() {
  await fs.mkdir(PAGE_DIR, { recursive: true });
}

export async function saveSourcePages(sourceId: string, pages: ChunkSourcePage[]): Promise<void> {
  await ensurePageDir();
  const filePath = path.join(PAGE_DIR, `${sourceId}.jsonl`);
  await fs.writeFile(filePath, pages.map(page => JSON.stringify(page)).join('\n'), 'utf-8');
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
