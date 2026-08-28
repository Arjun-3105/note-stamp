export interface ParsedCitation {
  label: string;
  sectionTitle?: string;
  pageStart?: number;
  pageEnd?: number;
  chunkIndex?: number;
}

const CITATION_REGEX = /\[([^\]]+)\]/g;

function parseCitationLabel(label: string): ParsedCitation | null {
  try {
    // Expected format: "Section: X | Page Y-Z | Chunk N" or variations
    const parts = label.split('|').map(p => p.trim());
    const citation: ParsedCitation = { label };

    for (const part of parts) {
      if (part.startsWith('Section:')) {
        citation.sectionTitle = part.replace('Section:', '').trim();
      } else if (part.startsWith('Path:')) {
        citation.sectionTitle = part.replace('Path:', '').trim();
      } else if (part.startsWith('Page')) {
        const pageMatch = part.match(/Page\s+(\d+)(?:-(\d+))?/i);
        if (pageMatch) {
          citation.pageStart = parseInt(pageMatch[1], 10);
          citation.pageEnd = pageMatch[2] ? parseInt(pageMatch[2], 10) : citation.pageStart;
        }
      } else if (part.startsWith('Chunk')) {
        const chunkMatch = part.match(/Chunk\s+(\d+)/i);
        if (chunkMatch) {
          citation.chunkIndex = parseInt(chunkMatch[1], 10) - 1; // convert to 0-based
        }
      }
    }

    return citation;
  } catch {
    return null;
  }
}

export function parseCitations(text: string): ParsedCitation[] {
  const citations: ParsedCitation[] = [];
  let match;
  while ((match = CITATION_REGEX.exec(text)) !== null) {
    const parsed = parseCitationLabel(match[1]);
    if (parsed) citations.push(parsed);
  }
  return citations;
}

export function stripCitations(text: string): string {
  return text.replace(CITATION_REGEX, '').replace(/\s+/g, ' ').trim();
}

export interface CitationClickHandler {
  (citation: ParsedCitation): void;
}

export function splitTextWithCitations(text: string): Array<{ type: 'text'; content: string } | { type: 'citation'; content: ParsedCitation }> {
  const parts: Array<{ type: 'text'; content: string } | { type: 'citation'; content: ParsedCitation }> = [];
  let lastIndex = 0;
  let match;

  while ((match = CITATION_REGEX.exec(text)) !== null) {
    const beforeText = text.slice(lastIndex, match.index);
    if (beforeText) {
      parts.push({ type: 'text', content: beforeText });
    }

    const parsed = parseCitationLabel(match[1]);
    if (parsed) {
      parts.push({ type: 'citation', content: parsed });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) {
    parts.push({ type: 'text', content: remaining });
  }

  return parts;
}