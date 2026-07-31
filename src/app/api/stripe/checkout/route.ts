import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUser } from '@/lib/db/users';
import { getOrCreateStripeCustomer, createCheckoutSession } from '@/lib/stripe';
import { z } from 'zod';

const RequestSchema = z.object({
  priceId: z.enum([
    process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
    process.env.STRIPE_CERT_PRICE_ID || 'price_cert',
  ]),
  returnUrl: z.string().default('/dashboard'),
});

/**
 * POST /api/stripe/checkout
 * Create a Stripe checkout session
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { priceId, returnUrl } = RequestSchema.parse(body);

    // Get user
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(userId, user.email);

    // Create checkout session
    const session = await createCheckoutSession(stripeCustomerId, priceId, returnUrl);

    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Checkout error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

