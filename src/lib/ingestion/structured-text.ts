export interface TextSection {
  heading?: string;
  headingPath?: string[];
  text: string;
}

/** Preserve paragraph breaks and heading lines while cleaning noise. */
export function normalizeStructuredText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function flattenSections(sections: TextSection[]): string {
  return sections
    .map(section => {
      const header = section.heading ? `${section.heading}\n\n` : '';
      return `${header}${section.text}`.trim();
    })
    .filter(Boolean)
    .join('\n\n');
}

const MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/;
const PLAIN_HEADING = /^([A-Z0-9][A-Z0-9\s\-:]{2,})$/;

function pushSection(sections: TextSection[], heading: string | undefined, lines: string[]) {
  const text = lines.join('\n\n').trim();
  if (!text) return;
  sections.push({
    heading,
    headingPath: heading ? [heading] : undefined,
    text,
  });
}

export function extractSectionsFromMarkdown(text: string, documentTitle?: string): TextSection[] {
  const normalized = normalizeStructuredText(text);
  const sections: TextSection[] = [];
  let heading = documentTitle;
  let buffer: string[] = [];

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const mdMatch = line.match(MARKDOWN_HEADING);
    if (mdMatch) {
      pushSection(sections, heading, buffer);
      buffer = [];
      heading = mdMatch[2].trim();
      continue;
    }

    buffer.push(line);
  }

  pushSection(sections, heading, buffer);
  return sections.length > 0 ? sections : [{ heading: documentTitle, text: normalized }];
}

export function extractSectionsFromPlainText(text: string, documentTitle?: string): TextSection[] {
  const normalized = normalizeStructuredText(text);
  if (normalized.includes('# ')) {
    return extractSectionsFromMarkdown(normalized, documentTitle);
  }

  const sections: TextSection[] = [];
  let heading = documentTitle;
  let buffer: string[] = [];

  for (const paragraph of normalized.split(/\n\n+/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const singleLine = trimmed.replace(/\n/g, ' ');
    const looksLikeHeading =
      trimmed.split('\n').length === 1 &&
      (PLAIN_HEADING.test(singleLine) || /^(\d+(\.\d+)*[.)]\s+.+)$/.test(singleLine)) &&
      singleLine.length < 120 &&
      singleLine.split(/\s+/).length <= 14;

    if (looksLikeHeading) {
      pushSection(sections, heading, buffer);
      buffer = [];
      heading = singleLine;
      continue;
    }

    buffer.push(trimmed);
  }

  pushSection(sections, heading, buffer);
  return sections.length > 0 ? sections : [{ heading: documentTitle, text: normalized }];
}

export function extractSectionsFromHtml(html: string, documentTitle?: string): TextSection[] {
  const sections: TextSection[] = [];
  let heading = documentTitle;
  let buffer: string[] = [];
  let headingStack: string[] = documentTitle ? [documentTitle] : [];

  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const blockRegex = /<(p|li|blockquote|pre|td|th)[^>]*>([\s\S]*?)<\/\1>/gi;

  const stripTags = (value: string) =>
    normalizeStructuredText(value.replace(/<br\s*\/?>/gi, '\n'));

  const flush = () => {
    const text = buffer.join('\n\n').trim();
    if (!text) return;
    sections.push({
      heading,
      headingPath: headingStack.length > 0 ? [...headingStack] : undefined,
      text,
    });
    buffer = [];
  };

  const tokens: Array<{ index: number; type: 'heading' | 'block'; level?: number; content: string }> = [];

  for (const match of html.matchAll(headingRegex)) {
    tokens.push({
      index: match.index ?? 0,
      type: 'heading',
      level: Number(match[1]),
      content: stripTags(match[2]),
    });
  }

  for (const match of html.matchAll(blockRegex)) {
    tokens.push({
      index: match.index ?? 0,
      type: 'block',
      content: stripTags(match[2]),
    });
  }

  tokens.sort((a, b) => a.index - b.index);

  for (const token of tokens) {
    if (!token.content) continue;

    if (token.type === 'heading') {
      flush();
      const level = token.level ?? 1;
      headingStack = headingStack.slice(0, Math.max(0, level - 1));
      headingStack[level - 1] = token.content;
      headingStack = headingStack.slice(0, level);
      heading = token.content;
      continue;
    }

    buffer.push(token.content);
  }

  flush();
  if (sections.length > 0) return sections;

  const fallback = stripTags(html);
  return fallback ? [{ heading: documentTitle, text: fallback }] : [];
}
