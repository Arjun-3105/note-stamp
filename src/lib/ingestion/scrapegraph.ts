import { normalizeStructuredText } from '@/lib/ingestion/structured-text';

const SCRAPEGRAPH_API = 'https://v2-api.scrapegraphai.com/api/scrape';
const MIN_READABILITY_WORDS = 150;

export interface ScrapeGraphResult {
  title: string;
  markdown: string;
  fetchedUrl: string;
}

function getApiKey(): string | undefined {
  return process.env.SGAI_API_KEY || process.env.SCRAPEGRAPH_API_KEY;
}

export function isScrapeGraphConfigured(): boolean {
  return Boolean(getApiKey());
}

export async function scrapeUrlWithScrapeGraph(url: string): Promise<ScrapeGraphResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ScrapeGraphAI API key is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(SCRAPEGRAPH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'SGAI-APIKEY': apiKey,
      },
      body: JSON.stringify({
        url,
        formats: [{ type: 'markdown' }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`ScrapeGraphAI request failed (${response.status}): ${detail.slice(0, 200)}`);
    }

    const payload = await response.json();
    const markdown =
      payload?.markdown ??
      payload?.data?.markdown ??
      payload?.result?.markdown ??
      payload?.content ??
      '';

    if (!markdown || typeof markdown !== 'string') {
      throw new Error('ScrapeGraphAI returned no markdown content');
    }

    const title =
      payload?.title ??
      payload?.data?.title ??
      payload?.metadata?.title ??
      new URL(url).hostname;

    return {
      title: String(title),
      markdown: normalizeStructuredText(markdown),
      fetchedUrl: payload?.url ?? payload?.source_url ?? url,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function shouldFallbackToScrapeGraph(wordCount: number, readabilityFailed: boolean): boolean {
  if (!isScrapeGraphConfigured()) return false;
  return readabilityFailed || wordCount < MIN_READABILITY_WORDS;
}
