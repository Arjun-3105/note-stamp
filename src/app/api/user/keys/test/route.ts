import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey } = await req.json();

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json({ valid: false, error: 'API key is required' }, { status: 400 });
    }

    const key = apiKey.trim();

    if (provider === 'openrouter') {
      // Test OpenRouter using auth endpoint or a lightweight probe
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 401) {
          return NextResponse.json({ valid: false, error: 'Invalid OpenRouter API Key (401 Unauthorized).' });
        }
        if (res.status === 402) {
          return NextResponse.json({ valid: false, error: 'OpenRouter account has insufficient credits (402 Payment Required).' });
        }
        return NextResponse.json({ valid: false, error: `OpenRouter returned status ${res.status}: ${errorText.slice(0, 150)}` });
      }

      const data = await res.json().catch(() => ({}));
      const usage = data?.data?.usage || 0;
      const limit = data?.data?.limit;

      return NextResponse.json({
        valid: true,
        message: 'OpenRouter API key is active and valid!',
        details: {
          label: data?.data?.label || 'OpenRouter Key',
          usage,
          limit: limit ?? 'No limit',
        },
      });
    } else if (provider === 'gemini') {
      // Test Gemini using models list
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 400 || res.status === 403) {
          return NextResponse.json({ valid: false, error: 'Invalid Google Gemini API Key. Please verify key.' });
        }
        if (res.status === 429) {
          return NextResponse.json({ valid: false, error: 'Gemini API key exceeded quota/rate limit (429).' });
        }
        return NextResponse.json({ valid: false, error: `Gemini API returned status ${res.status}: ${errorText.slice(0, 150)}` });
      }

      return NextResponse.json({
        valid: true,
        message: 'Google Gemini API key is valid and connected!',
      });
    }

    return NextResponse.json({ valid: false, error: 'Invalid provider specified (use "openrouter" or "gemini")' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : 'Failed to test API key' },
      { status: 500 }
    );
  }
}
