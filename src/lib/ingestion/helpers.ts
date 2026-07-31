import { createHash } from 'crypto';

/**
 * Calculate SHA256 hash of content for caching
 */
export function calculateInputHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Clean and normalize text content
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
}

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
  const educationalKeywords = [
    'learn', 'teach', 'explain', 'tutorial', 'course', 'lecture',
    'education', 'study', 'concept', 'theory', 'practice', 'exercise',
    'question', 'answer', 'problem', 'solution', 'example', 'definition',
  ];

  const lowerText = text.toLowerCase();
  const matches = educationalKeywords.filter(kw => lowerText.includes(kw));
  
  // Consider educational if contains any of the keywords and has reasonable length
  return matches.length > 0 && text.length > 100;
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

