import { createHash } from 'crypto';

/**
 * Calculate SHA256 hash of content for caching
 */
export function calculateInputHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

import { normalizeStructuredText } from '@/lib/ingestion/structured-text';

/**
 * Flatten text for hashing and lightweight checks.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/** Preserve paragraph and heading structure for storage and chunking. */
export { normalizeStructuredText };

/**
 * Extract metadata from source
 */
export interface SourceMetadata {
  duration?: number;
  pages?: number;
  author?: string;
  publishedAt?: string;
  language?: string;
  wordCount?: number;
  [key: string]: unknown;
}

export function extractMetadata(text: string, sourceType: string): SourceMetadata {
  return {
    wordCount: text.split(/\s+/).length,
    language: 'en',
    sourceType,
  };
}

/**
 * Validate content is educational (basic classifier)
 */
export function isEducationalContent(text: string): boolean {
  return Boolean(text && text.trim().length > 10);
}

/**
 * Truncate text to max characters (respecting word boundaries)
 */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  
  const truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

