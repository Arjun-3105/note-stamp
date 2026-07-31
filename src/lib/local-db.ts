import fs from 'fs/promises';
import path from 'path';

// Store transcripts in a local 'data' directory in the project root
const DATA_DIR = path.join(process.cwd(), 'data', 'transcripts');
const ROADMAP_DIR = path.join(process.cwd(), 'data', 'roadmaps');

/**
 * Ensures the data directory exists
 */
async function ensureDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {}
  try {
    await fs.mkdir(ROADMAP_DIR, { recursive: true });
  } catch (error) {}
}

/**
 * Saves a transcript to the local file system
 */
export async function saveLocalTranscript(sourceId: string, transcript: string): Promise<void> {
  await ensureDir();
  const filePath = path.join(DATA_DIR, `${sourceId}.txt`);
  await fs.writeFile(filePath, transcript, 'utf-8');
}

/**
 * Retrieves a transcript from the local file system
 * Returns null if it doesn't exist
 */
export async function getLocalTranscript(sourceId: string): Promise<string | null> {
  try {
    const filePath = path.join(DATA_DIR, `${sourceId}.txt`);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    // File not found or read error
    return null;
  }
}

export async function saveLocalRoadmap(sourceId: string, roadmap: any, isDetailed: boolean = false): Promise<void> {
  await ensureDir();
  const suffix = isDetailed ? '_detailed' : '';
  const filePath = path.join(ROADMAP_DIR, `${sourceId}${suffix}.json`);
  await fs.writeFile(filePath, JSON.stringify(roadmap, null, 2), 'utf-8');
}

export async function getLocalRoadmap(sourceId: string, isDetailed: boolean = false): Promise<any | null> {
  try {
    const suffix = isDetailed ? '_detailed' : '';
    const filePath = path.join(ROADMAP_DIR, `${sourceId}${suffix}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}
