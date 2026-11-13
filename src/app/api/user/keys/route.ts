import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { maskKey } from '@/lib/ai';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const orKey = cookieStore.get('user_openrouter_key')?.value?.trim() || '';
    const geminiKey = cookieStore.get('user_gemini_key')?.value?.trim() || '';

    return NextResponse.json({
      hasOpenRouterKey: Boolean(orKey),
      openRouterKeyMasked: maskKey(orKey),
      hasGeminiKey: Boolean(geminiKey),
      geminiKeyMasked: maskKey(geminiKey),
      hasCustomKeys: Boolean(orKey || geminiKey),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch API key status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { openRouterApiKey, geminiApiKey } = body;

    const cookieStore = await cookies();
    const oneYear = 60 * 60 * 24 * 365;

    let updatedOpenRouter = false;
    let updatedGemini = false;

    if (openRouterApiKey !== undefined) {
      const trimmed = (openRouterApiKey || '').trim();
      if (trimmed) {
        cookieStore.set('user_openrouter_key', trimmed, {
          path: '/',
          maxAge: oneYear,
          sameSite: 'lax',
          httpOnly: false,
        });
        updatedOpenRouter = true;
      } else {
        cookieStore.delete('user_openrouter_key');
      }
    }

    if (geminiApiKey !== undefined) {
      const trimmed = (geminiApiKey || '').trim();
      if (trimmed) {
        cookieStore.set('user_gemini_key', trimmed, {
          path: '/',
          maxAge: oneYear,
          sameSite: 'lax',
          httpOnly: false,
        });
        updatedGemini = true;
      } else {
        cookieStore.delete('user_gemini_key');
      }
    }

    const orKey = cookieStore.get('user_openrouter_key')?.value?.trim() || '';
    const geminiKey = cookieStore.get('user_gemini_key')?.value?.trim() || '';

    return NextResponse.json({
      success: true,
      message: 'API keys saved successfully!',
      hasOpenRouterKey: Boolean(orKey),
      openRouterKeyMasked: maskKey(orKey),
      hasGeminiKey: Boolean(geminiKey),
      geminiKeyMasked: maskKey(geminiKey),
      hasCustomKeys: Boolean(orKey || geminiKey),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save API keys' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('user_openrouter_key');
    cookieStore.delete('user_gemini_key');

    return NextResponse.json({
      success: true,
      message: 'Custom API keys removed. Reverted to shared system AI.',
      hasCustomKeys: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear API keys' },
      { status: 500 }
    );
  }
}
