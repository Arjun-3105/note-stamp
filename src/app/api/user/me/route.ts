import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUser } from '@/lib/db/users';
import { getMonthlyTokenUsage, getCachedHitRate } from '@/lib/db/usage';
import { getSubscriptionStatus } from '@/lib/stripe';

/**
 * GET /api/user/me
 * Get current user profile with plan/usage info
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get usage data
    const usage = await getMonthlyTokenUsage(userId);
    const cacheHitRate = await getCachedHitRate(userId);

    // Get Stripe subscription status
    let subscription = null;
    if (user.stripeCustomerId) {
      subscription = await getSubscriptionStatus(user.stripeCustomerId);
    }

    return NextResponse.json({
      user: {
        id: user.userId,
        email: user.email,
        plan: user.plan,
        wallet: user.wallet,
        stripeCustomerId: user.stripeCustomerId,
        createdAt: user.createdAt,
      },
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.inputTokens + usage.outputTokens,
        cacheHitRate,
        freeLimit: 100_000,
        isPro: user.plan === 'pro',
      },
      subscription,
    });
  } catch (error) {
    console.error('User info error:', error);
    return NextResponse.json(
      { error: 'Failed to get user info' },
      { status: 500 }
    );
  }
}

