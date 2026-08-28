import { supabaseServer, TABLES, mapDoc } from '@/lib/supabase-server';

export interface User {
  $id: string;
  userId: string;
  email: string;
  plan: 'free' | 'pro';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  wallet?: string;
  createdAt: string;
}

export interface CreateUserInput {
  userId: string;
  email: string;
  plan?: 'free' | 'pro';
  wallet?: string;
}

export async function createUser(data: CreateUserInput): Promise<User> {
  const { data: doc, error } = await supabaseServer
    .from(TABLES.USERS)
    .insert({
      userId: data.userId,
      email: data.email,
      plan: data.plan || 'free',
      wallet: data.wallet || null,
      createdAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return mapDoc<User>(doc);
}

export async function getUser(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLES.USERS)
      .select('*')
      .eq('userId', userId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDoc<User>(data);
  } catch {
    return null;
  }
}

export async function updateUser(userId: string, data: Partial<User>): Promise<User> {
  const user = await getUser(userId);
  if (!user) throw new Error('User not found');

  const { $id, ...updatePayload } = data;

  const { data: doc, error } = await supabaseServer
    .from(TABLES.USERS)
    .update(updatePayload)
    .eq('id', user.$id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update user: ${error.message}`);
  return mapDoc<User>(doc);
}

export async function updateUserPlan(
  userId: string,
  plan: 'free' | 'pro',
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<User> {
  return updateUser(userId, { plan, stripeCustomerId, stripeSubscriptionId });
}

export async function updateUserWallet(userId: string, wallet: string): Promise<User> {
  return updateUser(userId, { wallet });
}
