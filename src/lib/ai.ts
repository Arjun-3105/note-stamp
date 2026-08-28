/**
 * Central AI caller — all OpenRouter requests go through here.
 * Uses a 4-tier model routing strategy per the Notestamp spec.
 */

export const MODELS = {
  budget: process.env.OPENROUTER_MODEL_BUDGET || process.env.GEMINI_MODEL || 'google/gemini-3.1-flash-lite',
  fast: process.env.OPENROUTER_MODEL_FAST || 'deepseek/deepseek-v4-flash',
  mid: process.env.OPENROUTER_MODEL_MID || 'anthropic/claude-haiku-4-5',
  smart: process.env.OPENROUTER_MODEL_SMART || 'anthropic/claude-sonnet-4-6',
  fallback: process.env.OPENROUTER_MODEL_FALLBACK || 'openai/gpt-4o-mini',
} as const;

export type ModelTier = keyof typeof MODELS;

const API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getHeaders() {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY is not configured');
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://notestamp.com',
    'X-Title': 'Notestamp',
  };
}

interface AICallOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  tier?: ModelTier;
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface AIResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

export async function callAI(options: AICallOptions): Promise<AIResponse> {
  const modelName = MODELS[options.tier || 'fast'];

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

  let response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  // Fallback to direct Gemini API if OpenRouter fails completely
  if (!response.ok) {
    console.warn(`OpenRouter primary failed (${response.status}). Attempting OpenRouter fallback model...`);
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...body, model: MODELS.fallback }),
    });
  }

  // If OpenRouter fallback still fails, try direct Google Gemini API
  if (!response.ok) {
    console.warn(`OpenRouter fallback failed (${response.status}). Attempting direct Gemini API...`);
    try {
      return await callGeminiFallback(options);
    } catch (geminiError) {
      console.error('Gemini fallback also failed:', geminiError);
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenRouter error (${response.status}): ${errorText} | Gemini Error: ${geminiError}`);
    }
  }

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

export async function callAIStreaming(
  options: AICallOptions,
  onChunk: (chunk: string) => void
): Promise<AIResponse> {
  const modelName = MODELS[options.tier || 'fast'];

  let response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: getHeaders(),
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
    console.warn(`OpenRouter streaming failed (${response.status}). Attempting direct Gemini API streaming...`);
    return callGeminiStreamingFallback(options, onChunk);
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
  }

  return { content: fullContent, model: modelName, inputTokens, outputTokens, cached: false };
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
async function callGeminiFallback(options: AICallOptions): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured for fallback');
  
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  
  const body = {
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 1024,
      ...(options.jsonMode && { responseMimeType: 'application/json' }),
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
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
    cached: false
  };
}

async function callGeminiStreamingFallback(
  options: AICallOptions, 
  onChunk: (chunk: string) => void
): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured for fallback');
  
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
  
  const body = {
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 1024,
      ...(options.jsonMode && { responseMimeType: 'application/json' }),
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
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
    cached: false 
  };
}

