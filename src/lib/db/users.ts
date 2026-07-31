import { ID, Query } from 'node-appwrite';
import { serverDatabases, DB_ID, COLLECTIONS } from '@/lib/appwrite-server';

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
  return serverDatabases.createDocument(DB_ID, COLLECTIONS.USERS, ID.unique(), {
    userId: data.userId,
    email: data.email,
    plan: data.plan || 'free',
    wallet: data.wallet || null,
    createdAt: new Date().toISOString(),
  }) as unknown as User;
}

export async function getUser(userId: string): Promise<User | null> {
  try {
    const result = await serverDatabases.listDocuments(DB_ID, COLLECTIONS.USERS, [
      Query.equal('userId', userId),
      Query.limit(1),
    ]);
    return (result.documents[0] as unknown as User) || null;
  } catch {
    return null;
  }
}

export async function updateUser(userId: string, data: Partial<User>): Promise<User> {
  const user = await getUser(userId);
  if (!user) throw new Error('User not found');

  return serverDatabases.updateDocument(
    DB_ID,
    COLLECTIONS.USERS,
    user.$id,
    data
  ) as unknown as User;
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

