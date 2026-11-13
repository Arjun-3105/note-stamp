/**
 * Central AI caller — all OpenRouter and Gemini requests go through here.
 * Uses a 4-tier model routing strategy per the Notestamp spec, with automatic
 * fallback to Google Gemini, custom user API keys support, and friendly credit exhaustion errors.
 */

export const MODELS = {
  budget: process.env.OPENROUTER_MODEL_BUDGET || process.env.GEMINI_MODEL || 'google/gemini-3.1-flash-lite',
  fast: process.env.OPENROUTER_MODEL_FAST || 'deepseek/deepseek-v4-flash',
  mid: process.env.OPENROUTER_MODEL_MID || 'anthropic/claude-haiku-4-5',
  smart: process.env.OPENROUTER_MODEL_SMART || 'anthropic/claude-sonnet-4-6',
  fallback: process.env.OPENROUTER_MODEL_FALLBACK || 'openai/gpt-4o-mini',
} as const;

export type ModelTier = keyof typeof MODELS;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class AICreditsExhaustedError extends Error {
  readonly code = 'AI_CREDITS_EXHAUSTED' as const;
  readonly status = 402;
  readonly isCreditsExhausted = true;

  constructor(message?: string) {
    super(
      message ||
      'AI service ran out of credits or quota limit reached. Please add your own OpenRouter or Gemini API key in Settings to continue.'
    );
    this.name = 'AICreditsExhaustedError';
  }
}

export function maskKey(key?: string | null): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

export function isCreditsOrQuotaError(status: number, messageOrBody: string): boolean {
  if (status === 402) return true;
  const lower = (messageOrBody || '').toLowerCase();
  if (status === 429) {
    if (
      lower.includes('credit') ||
      lower.includes('quota') ||
      lower.includes('resource has been exhausted') ||
      lower.includes('resource_exhausted') ||
      lower.includes('rate limit') ||
      lower.includes('balance') ||
      lower.includes('exceeded') ||
      lower.includes('too low')
    ) {
      return true;
    }
  }
  return (
    lower.includes('requires more credits') ||
    lower.includes('account balance is too low') ||
    lower.includes('insufficient credits') ||
    lower.includes('resource has been exhausted') ||
    lower.includes('resource_exhausted') ||
    lower.includes('balance is too low') ||
    lower.includes('ran out of cred')
  );
}

export function isCreditsExhaustedError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof AICreditsExhaustedError) return true;
  if (typeof error === 'object' && error !== null) {
    if ('code' in error && (error as any).code === 'AI_CREDITS_EXHAUSTED') return true;
    if ('isCreditsExhausted' in error && (error as any).isCreditsExhausted === true) return true;
    if ('status' in error && (error as any).status === 402) return true;
  }
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    msg.includes('requires more credits') ||
    msg.includes('account balance is too low') ||
    msg.includes('insufficient credits') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('ai_credits_exhausted') ||
    msg.includes('ran out of cred') ||
    msg.includes('out of credits') ||
    (msg.includes('402') && msg.includes('openrouter')) ||
    (msg.includes('429') && (msg.includes('gemini') || msg.includes('quota')))
  );
}

export function formatAIErrorResponse(error: unknown, fallbackMessage = 'Failed to execute AI request') {
  const isCredits = isCreditsExhaustedError(error);
  if (isCredits) {
    return {
      response: {
        error: 'AI service ran out of credits or quota limit reached. Please add your own OpenRouter or Gemini API key in Settings to continue.',
        code: 'AI_CREDITS_EXHAUSTED',
        isCreditsExhausted: true,
      },
      status: 402,
    };
  }
  return {
    response: {
      error: error instanceof Error ? error.message : fallbackMessage,
      code: 'AI_ERROR',
      isCreditsExhausted: false,
    },
    status: 500,
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AICallOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  tier?: ModelTier;
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  customKeys?: {
    openRouterApiKey?: string;
    geminiApiKey?: string;
  };
}

export interface AIResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

/**
 * Resolves the effective API keys, checking options, request cookies/headers, and env variables.
 */
export async function getEffectiveApiKeys(customKeys?: { openRouterApiKey?: string; geminiApiKey?: string }) {
  let openRouterKey = customKeys?.openRouterApiKey?.trim();
  let geminiKey = customKeys?.geminiApiKey?.trim();

  // If in Next.js server context, dynamically inspect headers and cookies
  if (!openRouterKey || !geminiKey) {
    try {
      const { cookies, headers } = await import('next/headers');
      const cookieStore = await cookies();
      const headerList = await headers();

      if (!openRouterKey) {
        const hKey = headerList.get('x-openrouter-key');
        const cKey = cookieStore.get('user_openrouter_key')?.value;
        if (hKey?.trim()) openRouterKey = hKey.trim();
        else if (cKey?.trim()) openRouterKey = cKey.trim();
      }

      if (!geminiKey) {
        const hKey = headerList.get('x-gemini-key');
        const cKey = cookieStore.get('user_gemini_key')?.value;
        if (hKey?.trim()) geminiKey = hKey.trim();
        else if (cKey?.trim()) geminiKey = cKey.trim();
      }
    } catch {
      // In non-request contexts (build, background jobs), safely continue
    }
  }

  const defaultOpenRouterKey = process.env.OPENROUTER_API_KEY?.trim() || '';
  const defaultGeminiKey = process.env.GEMINI_API_KEY?.trim() || '';

  const effectiveOpenRouterKey = openRouterKey || defaultOpenRouterKey;
  const effectiveGeminiKey = geminiKey || defaultGeminiKey;

  const isUserOpenRouter = Boolean(openRouterKey && openRouterKey !== defaultOpenRouterKey);
  const isUserGemini = Boolean(geminiKey && geminiKey !== defaultGeminiKey);

  return {
    openRouterKey: effectiveOpenRouterKey,
    geminiKey: effectiveGeminiKey,
    isUserOpenRouter,
    isUserGemini,
    hasAnyKey: Boolean(effectiveOpenRouterKey || effectiveGeminiKey),
  };
}

export async function callAI(options: AICallOptions): Promise<AIResponse> {
  const { openRouterKey, geminiKey, isUserOpenRouter, isUserGemini } = await getEffectiveApiKeys(options.customKeys);
  const modelName = MODELS[options.tier || 'fast'];

  let openRouterFailedWithCredits = false;
  let openRouterErrorDetails = '';

  // 1. Try OpenRouter if key is present
  if (openRouterKey) {
    const headers = {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://notestamp.com',
      'X-Title': 'LearnLoop',
    };

    const body = {
      model: modelName,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      ...(options.jsonMode && { response_format: { type: 'json_object' } }),
      ...(options.tools && { tools: options.tools, tool_choice: options.toolChoice || 'auto' }),
    };

    try {
      let response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`OpenRouter primary failed (${response.status}): ${errorText.slice(0, 200)}`);

        if (response.status === 402 || isCreditsOrQuotaError(response.status, errorText)) {
          openRouterFailedWithCredits = true;
          openRouterErrorDetails = errorText;
        } else {
          // Attempt OpenRouter fallback model
          console.warn(`Attempting OpenRouter fallback model (${MODELS.fallback})...`);
          response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...body, model: MODELS.fallback }),
          });

          if (!response.ok) {
            const fallbackErrorText = await response.text().catch(() => '');
            if (response.status === 402 || isCreditsOrQuotaError(response.status, fallbackErrorText)) {
              openRouterFailedWithCredits = true;
              openRouterErrorDetails = fallbackErrorText;
            }
          }
        }
      }

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        const usage = data.usage || {};

        return {
          content,
          model: data.model || modelName,
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          cached: !!(usage.cache_read_input_tokens),
        };
      }
    } catch (err) {
      console.warn('OpenRouter request network error:', err);
    }
  }

  // 2. Fallback to direct Gemini API
  if (geminiKey) {
    console.warn('Attempting direct Gemini API fallback...');
    try {
      return await callGeminiFallback(options, geminiKey);
    } catch (geminiError) {
      console.error('Gemini fallback also failed:', geminiError);
      const isGeminiQuota = isCreditsOrQuotaError(429, String(geminiError));
      if (openRouterFailedWithCredits || isGeminiQuota) {
        const isUser = isUserOpenRouter || isUserGemini;
        throw new AICreditsExhaustedError(
          isUser
            ? 'Your configured API key ran out of credits or quota limit reached. Please update your API key in Settings.'
            : 'AI service ran out of credits or quota limit reached. Please add your own OpenRouter or Gemini API key in Settings to continue.'
        );
      }
      throw geminiError;
    }
  }

  // 3. If OpenRouter specifically ran out of credits and no Gemini succeeded
  if (openRouterFailedWithCredits) {
    throw new AICreditsExhaustedError(
      isUserOpenRouter
        ? 'Your configured OpenRouter key ran out of credits. Please top up or add a Google Gemini API key in Settings.'
        : 'AI service ran out of credits. Please add your own OpenRouter or Gemini API key in Settings to continue.'
    );
  }

  throw new Error('No AI provider available or configured. Please add your own OpenRouter or Gemini API key in Settings.');
}

export async function callAIStreaming(
  options: AICallOptions,
  onChunk: (chunk: string) => void
): Promise<AIResponse> {
  const { openRouterKey, geminiKey, isUserOpenRouter, isUserGemini } = await getEffectiveApiKeys(options.customKeys);
  const modelName = MODELS[options.tier || 'fast'];

  let openRouterFailedWithCredits = false;

  if (openRouterKey) {
    const headers = {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://notestamp.com',
      'X-Title': 'LearnLoop',
    };

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: options.systemPrompt },
            { role: 'user', content: options.userPrompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1024,
          stream: true,
          ...(options.tools && { tools: options.tools, tool_choice: options.toolChoice || 'auto' }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`OpenRouter streaming failed (${response.status}): ${errorText.slice(0, 200)}`);
        if (response.status === 402 || isCreditsOrQuotaError(response.status, errorText)) {
          openRouterFailedWithCredits = true;
        }
      } else if (response.body) {
        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const json = JSON.parse(data);
              const token = json.choices?.[0]?.delta?.content || '';
              if (token) {
                fullContent += token;
                onChunk(token);
              }
              if (json.usage) {
                inputTokens = json.usage.prompt_tokens || 0;
                outputTokens = json.usage.completion_tokens || 0;
              }
            } catch {
              // skip malformed SSE chunks
            }
          }
        }

        return { content: fullContent, model: modelName, inputTokens, outputTokens, cached: false };
      }
    } catch (err) {
      console.warn('OpenRouter streaming network error:', err);
    }
  }

  // Fallback to Gemini streaming
  if (geminiKey) {
    console.warn('OpenRouter streaming unavailable. Attempting direct Gemini API streaming fallback...');
    try {
      return await callGeminiStreamingFallback(options, onChunk, geminiKey);
    } catch (geminiError) {
      console.error('Gemini streaming fallback failed:', geminiError);
      if (openRouterFailedWithCredits || isCreditsOrQuotaError(429, String(geminiError))) {
        throw new AICreditsExhaustedError(
          (isUserOpenRouter || isUserGemini)
            ? 'Your custom API key ran out of credits or quota limit reached.'
            : 'AI service ran out of credits or quota limit reached. Please add your own OpenRouter or Gemini API key in Settings to continue.'
        );
      }
      throw geminiError;
    }
  }

  if (openRouterFailedWithCredits) {
    throw new AICreditsExhaustedError(
      'AI service ran out of credits. Please add your own OpenRouter or Gemini API key in Settings to continue.'
    );
  }

  throw new Error('AI streaming failed: No available providers or credits.');
}

/** Rough per-call cost estimate for dashboards. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    [MODELS.budget]: { input: 0.10 / 1e6, output: 0.40 / 1e6 },
    [MODELS.fast]:   { input: 0.14 / 1e6, output: 0.28 / 1e6 },
    [MODELS.mid]:    { input: 1.00 / 1e6, output: 5.00 / 1e6 },
    [MODELS.smart]:  { input: 3.00 / 1e6, output: 15.0 / 1e6 },
  };
  const rates = pricing[model] || { input: 0.5 / 1e6, output: 1.5 / 1e6 };
  return inputTokens * rates.input + outputTokens * rates.output;
}

/**
 * Direct Google Gemini API fallback
 */
async function callGeminiFallback(options: AICallOptions, explicitKey?: string): Promise<AIResponse> {
  const apiKey = explicitKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured for fallback');

  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 1024,
      ...(options.jsonMode && { responseMimeType: 'application/json' }),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};

  return {
    content,
    model: `${geminiModel} (fallback)`,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    cached: false,
  };
}

async function callGeminiStreamingFallback(
  options: AICallOptions,
  onChunk: (chunk: string) => void,
  explicitKey?: string
): Promise<AIResponse> {
  const apiKey = explicitKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured for fallback');

  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 1024,
      ...(options.jsonMode && { responseMimeType: 'application/json' }),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Streaming API error (${response.status}): ${errorText}`);
  }

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;

        try {
          const json = JSON.parse(dataStr);
          const token = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (token) {
            fullContent += token;
            onChunk(token);
          }
          if (json.usageMetadata) {
            inputTokens = json.usageMetadata.promptTokenCount || 0;
            outputTokens = json.usageMetadata.candidatesTokenCount || 0;
          }
        } catch {
          // Ignore parse errors on partial chunks
        }
      }
    }
  }

  return {
    content: fullContent,
    model: `${geminiModel} (fallback)`,
    inputTokens,
    outputTokens,
    cached: false,
  };
}
