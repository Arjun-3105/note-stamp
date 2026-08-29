import fs from 'fs/promises';
import path from 'path';

export interface UserProgress {
  userId: string;
  workspaceId: string;
  sourceId: string;
  completedChunks: number[];
  completedPages: number[];
  completedTopics: string[];
  totalChunks?: number;
  totalPages?: number;
  totalTopics?: number;
  updatedAt: string;
}

import os from 'os';

const BASE_DIR = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? path.join(os.tmpdir(), 'learnloop-data')
  : path.join(process.cwd(), 'data');

const PROGRESS_DIR = path.join(BASE_DIR, 'progress');

async function ensureDir(userId?: string) {
  try {
    const dir = userId ? path.join(PROGRESS_DIR, userId) : PROGRESS_DIR;
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {}
}

function progressPath(userId: string, sourceId: string) {
  return path.join(PROGRESS_DIR, userId, `${sourceId}.json`);
}

export async function getProgress(userId: string, sourceId: string): Promise<UserProgress | null> {
  try {
    const raw = await fs.readFile(progressPath(userId, sourceId), 'utf-8');
    return JSON.parse(raw) as UserProgress;
  } catch {
    return null;
  }
}

export async function saveProgress(progress: UserProgress): Promise<UserProgress> {
  const toSave: UserProgress = {
    ...progress,
    completedChunks: Array.from(new Set(progress.completedChunks)).sort((a, b) => a - b),
    completedPages: Array.from(new Set(progress.completedPages)).sort((a, b) => a - b),
    completedTopics: Array.from(new Set(progress.completedTopics)).sort(),
    updatedAt: new Date().toISOString(),
  };
  try {
    await ensureDir(progress.userId);
    await fs.writeFile(progressPath(progress.userId, progress.sourceId), JSON.stringify(toSave, null, 2), 'utf-8');
  } catch (error) {
    console.warn('[progress] Skipping local progress file write:', error);
  }
  return toSave;
}

export async function listProgressByWorkspace(userId: string, workspaceId: string): Promise<UserProgress[]> {
  try {
    await ensureDir(userId);
    const dir = path.join(PROGRESS_DIR, userId);
    const files = await fs.readdir(dir);
    const progresses: UserProgress[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, file), 'utf-8');
        const p = JSON.parse(raw) as UserProgress;
        if (p.workspaceId === workspaceId) progresses.push(p);
      } catch {}
    }
    return progresses;
  } catch {
    return [];
  }
}

export async function listProgressByUser(userId: string): Promise<UserProgress[]> {
  try {
    await ensureDir(userId);
    const dir = path.join(PROGRESS_DIR, userId);
    const files = await fs.readdir(dir);
    const progresses: UserProgress[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, file), 'utf-8');
        progresses.push(JSON.parse(raw) as UserProgress);
      } catch {}
    }
    return progresses;
  } catch {
    return [];
  }
}

export function computeProgressStats(progresses: UserProgress[]) {
  let totalChunks = 0, doneChunks = 0, totalPages = 0, donePages = 0, totalTopics = 0, doneTopics = 0;
  for (const p of progresses) {
    totalChunks += p.totalChunks ?? p.completedChunks.length;
    doneChunks += p.completedChunks.length;
    // pages: if total defined use it else approximate
    if (p.totalPages) totalPages += p.totalPages;
    donePages += p.completedPages.length;
    if (p.totalTopics) totalTopics += p.totalTopics;
    doneTopics += p.completedTopics.length;
  }
  // avoid double counting when total not set
  if (totalPages === 0) totalPages = donePages;
  if (totalTopics === 0) totalTopics = doneTopics;
  return { totalChunks, doneChunks, totalPages, donePages, totalTopics, doneTopics };
}
