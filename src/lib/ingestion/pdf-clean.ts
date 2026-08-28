const JUNK_LINE_PATTERNS = [
  /\.indd\s+\d+/i,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?$/i,
  /^www\.[a-z0-9.-]+\.[a-z]{2,}$/i,
  /^https?:\/\/[^\s]+$/i,
  /^page\s+\d+\s*(?:of\s+\d+)?\.?$/i,
  /^-{2,}\s*\d+\s*-{2,}$/,
  /^[A-Z0-9_]+\.(?:indd|pdf|eps)$/i,
];

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

export function isJunkPdfLine(line: string): boolean {
  const trimmed = normalizeLine(line);
  if (!trimmed) return true;
  if (trimmed.length <= 2 && /^\d+$/.test(trimmed)) return true;
  return JUNK_LINE_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function linesToParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    paragraphs.push(current.join(' ').replace(/\s+/g, ' ').trim());
    current = [];
  };

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (!line || isJunkPdfLine(line)) continue;

    const continuesPrevious =
      current.length > 0 &&
      (/-$/.test(current[current.length - 1]) ||
        (/^[a-z(,]/.test(line) && /[a-z0-9,]$/.test(current[current.length - 1])));
    if (continuesPrevious) {
      current[current.length - 1] = `${current[current.length - 1].replace(/-$/, '')} ${line}`;
    } else {
      if (current.length > 0) flush();
      current.push(line);
    }
  }

  flush();
  return paragraphs.filter(Boolean);
}

function lineKey(line: string): string {
  return normalizeLine(line).toLowerCase();
}

export function removeRepeatedEdgeLines(pageLines: string[][]): string[][] {
  const topCounts = new Map<string, number>();
  const bottomCounts = new Map<string, number>();

  for (const lines of pageLines) {
    const cleaned = lines.map(normalizeLine).filter(line => line && !isJunkPdfLine(line));
    for (const line of cleaned.slice(0, 2)) {
      topCounts.set(lineKey(line), (topCounts.get(lineKey(line)) ?? 0) + 1);
    }
    for (const line of cleaned.slice(-2)) {
      bottomCounts.set(lineKey(line), (bottomCounts.get(lineKey(line)) ?? 0) + 1);
    }
  }

  const threshold = Math.max(2, Math.floor(pageLines.length * 0.35));
  const repeatedTop = new Set(
    [...topCounts.entries()].filter(([, count]) => count >= threshold).map(([line]) => line)
  );
  const repeatedBottom = new Set(
    [...bottomCounts.entries()].filter(([, count]) => count >= threshold).map(([line]) => line)
  );

  return pageLines.map(lines => {
    const cleaned = lines.map(normalizeLine).filter(line => line && !isJunkPdfLine(line));
    return cleaned.filter((line, index) => {
      const key = lineKey(line);
      if (index < 2 && repeatedTop.has(key)) return false;
      if (index >= cleaned.length - 2 && repeatedBottom.has(key)) return false;
      return true;
    });
  });
}

export function formatPdfPageText(lines: string[]): string {
  return linesToParagraphs(lines).join('\n\n');
}

export function cleanPdfPages(pageLines: string[][]): string[] {
  const withoutEdges = removeRepeatedEdgeLines(pageLines);
  return withoutEdges.map(lines => formatPdfPageText(lines));
}
