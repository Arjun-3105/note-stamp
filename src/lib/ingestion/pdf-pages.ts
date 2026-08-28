import pdf from 'pdf-parse';
import { cleanPdfPages } from '@/lib/ingestion/pdf-clean';
import type { ChunkSourcePage } from '@/lib/source-chunks';

interface PdfTextItem {
  str: string;
  transform: number[];
}

interface PdfPageRenderData {
  pageIndex?: number;
  getTextContent: (options?: {
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
  }) => Promise<{
    items: PdfTextItem[];
  }>;
}

function groupItemsIntoLines(items: PdfTextItem[]): string[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    const yA = a.transform[5];
    const yB = b.transform[5];
    if (Math.abs(yA - yB) > 4) return yB - yA;
    return a.transform[4] - b.transform[4];
  });

  const lines: string[] = [];
  let currentLine = '';
  let currentY: number | undefined;

  for (const item of sorted) {
    const y = item.transform[5];
    const text = item.str.replace(/\s+/g, ' ');

    if (currentY === undefined || Math.abs(y - currentY) <= 4) {
      currentLine += text;
    } else {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = text;
    }
    currentY = y;
  }

  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines;
}

export async function extractPdfPages(buffer: Buffer): Promise<{
  pages: ChunkSourcePage[];
  fullText: string;
  pageCount: number;
}> {
  const pageLines: string[][] = [];

  const pagerender = (pageData: PdfPageRenderData) => {
    const pageNumber = (pageData.pageIndex ?? pageLines.length) + 1;

    return pageData
      .getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      })
      .then(textContent => {
        const lines = groupItemsIntoLines(textContent.items);
        pageLines[pageNumber - 1] = lines;
        return lines.join('\n');
      });
  };

  const pdfData = await pdf(buffer, { pagerender });
  const orderedLineGroups = pageLines.filter(Boolean);
  const cleanedTexts = cleanPdfPages(orderedLineGroups);
  const orderedPages = cleanedTexts.map((text, index) => ({
    pageNumber: index + 1,
    text,
  }));
  const fullText = orderedPages
    .map(page => `[[PAGE ${page.pageNumber}]]\n${page.text}`)
    .join('\n\n');

  return {
    pages: orderedPages,
    fullText,
    pageCount: pdfData.numpages || orderedPages.length,
  };
}
