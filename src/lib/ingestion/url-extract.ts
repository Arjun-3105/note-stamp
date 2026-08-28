import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import {
  extractSectionsFromHtml,
  extractSectionsFromMarkdown,
  flattenSections,
  normalizeStructuredText,
  type TextSection,
} from '@/lib/ingestion/structured-text';
import {
  scrapeUrlWithScrapeGraph,
  shouldFallbackToScrapeGraph,
} from '@/lib/ingestion/scrapegraph';

export interface UrlExtractResult {
  title: string;
  fetchedUrl: string;
  sections: TextSection[];
  transcript: string;
  wordCount: number;
  extractor: 'readability' | 'scrapegraph';
}

async function fetchHtml(url: string): Promise<{ html: string; fetchedUrl: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error('URL must return HTML or text content');
    }

    return {
      html: await response.text(),
      fetchedUrl: response.url,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractWithReadability(html: string, fetchedUrl: string): {
  title: string;
  sections: TextSection[];
  transcript: string;
  wordCount: number;
} | null {
  const dom = new JSDOM(html, { url: fetchedUrl });
  const readability = new Readability(dom.window.document);
  const article = readability.parse();

  if (!article) return null;

  const title = article.title || new URL(fetchedUrl).hostname;
  const sections = article.content
    ? extractSectionsFromHtml(article.content, title)
    : extractSectionsFromMarkdown(normalizeStructuredText(article.textContent || ''), title);

  const transcript = flattenSections(sections);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  return { title, sections, transcript, wordCount };
}

export async function extractUrlContent(url: string): Promise<UrlExtractResult> {
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  let htmlResult: { html: string; fetchedUrl: string };
  try {
    htmlResult = await fetchHtml(normalizedUrl);
  } catch (error) {
    if (shouldFallbackToScrapeGraph(0, true)) {
      const scraped = await scrapeUrlWithScrapeGraph(normalizedUrl);
      const sections = extractSectionsFromMarkdown(scraped.markdown, scraped.title);
      const transcript = flattenSections(sections);
      return {
        title: scraped.title,
        fetchedUrl: scraped.fetchedUrl,
        sections,
        transcript,
        wordCount: transcript.split(/\s+/).filter(Boolean).length,
        extractor: 'scrapegraph',
      };
    }
    throw error;
  }

  const readability = extractWithReadability(htmlResult.html, htmlResult.fetchedUrl);

  if (readability && !shouldFallbackToScrapeGraph(readability.wordCount, false)) {
    return {
      title: readability.title,
      fetchedUrl: htmlResult.fetchedUrl,
      sections: readability.sections,
      transcript: readability.transcript,
      wordCount: readability.wordCount,
      extractor: 'readability',
    };
  }

  if (shouldFallbackToScrapeGraph(readability?.wordCount ?? 0, !readability)) {
    const scraped = await scrapeUrlWithScrapeGraph(htmlResult.fetchedUrl);
    const sections = extractSectionsFromMarkdown(scraped.markdown, scraped.title);
    const transcript = flattenSections(sections);

    return {
      title: scraped.title,
      fetchedUrl: scraped.fetchedUrl,
      sections,
      transcript,
      wordCount: transcript.split(/\s+/).filter(Boolean).length,
      extractor: 'scrapegraph',
    };
  }

  if (!readability) {
    throw new Error('Could not extract readable content from URL');
  }

  return {
    title: readability.title,
    fetchedUrl: htmlResult.fetchedUrl,
    sections: readability.sections,
    transcript: readability.transcript,
    wordCount: readability.wordCount,
    extractor: 'readability',
  };
}
