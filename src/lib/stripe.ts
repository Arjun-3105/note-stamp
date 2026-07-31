import Stripe from 'stripe';
import { getUser, updateUserPlan } from '@/lib/db/users';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const STRIPE_CERT_PRICE_ID = process.env.STRIPE_CERT_PRICE_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://notestamp.com';

/**
 * Create a Stripe customer if not exists
 */
export async function getOrCreateStripeCustomer(userId: string, email: string) {
  const user = await getUser(userId);

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await updateUserPlan(userId, 'free', customer.id);

  return customer.id;
}

/**
 * Create checkout session for subscription
 */
export async function createCheckoutSession(
  stripeCustomerId: string,
  priceId: string,
  returnUrl: string
) {
  return stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: priceId === STRIPE_CERT_PRICE_ID ? 'payment' : 'subscription',
    success_url: `${APP_URL}${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}${returnUrl}?cancelled=true`,
    billing_address_collection: 'required',
  });
}

/**
 * Create billing portal session
 */
export async function createBillingPortalSession(stripeCustomerId: string) {
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${APP_URL}/settings/billing`,
  });
}

/**
 * Get subscription status from Stripe
 */
export async function getSubscriptionStatus(stripeCustomerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    return { status: 'free', active: false };
  }

  const subscription = subscriptions.data[0];
  return {
    status: subscription.status,
    active: subscription.status === 'active',
    subscriptionId: subscription.id,
    priceId: subscription.items.data[0]?.price.id,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };
}

/**
 * Handle subscription events
 */
export async function handleSubscriptionEvent(event: Stripe.Event) {
  const object = event.data.object as Stripe.Subscription;

  if (!object.customer) {
    throw new Error('No customer attached to subscription');
  }

  const customerId = typeof object.customer === 'string' ? object.customer : object.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) throw new Error('Customer has been deleted');
  const userId = (customer as Stripe.Customer).metadata?.userId;

  if (!userId) {
    throw new Error('No userId in customer metadata');
  }

  const isPro = object.items.data.some(item => item.price.id === STRIPE_PRO_PRICE_ID);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      if (object.status === 'active' && isPro) {
        await updateUserPlan(userId, 'pro', customerId, object.id);
      }
      break;

    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
      await updateUserPlan(userId, 'free', customerId);
      break;
  }
}

/**
 * Enforce plan limits
 */
export async function checkPlanLimits(userId: string, tokens: number): Promise<boolean> {
  const { getMonthlyTokenUsage } = await import('@/lib/db/usage');
  const user = await getUser(userId);

  if (!user) return false;
  if (user.plan === 'pro') return true; // No limits for pro

  // Free plan: 100K tokens/month
  const usage = await getMonthlyTokenUsage(userId);
  const totalUsed = usage.inputTokens + usage.outputTokens;
  const freeLimit = 100_000;

  return totalUsed + tokens <= freeLimit;
}

