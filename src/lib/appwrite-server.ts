/**
 * Appwrite server-side client singleton.
 * Uses node-appwrite with the server API key — NEVER expose to client.
 * All server-side DB operations import from here.
 */
import { Client, Databases, Storage, Users } from 'node-appwrite';

if (!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
  throw new Error('NEXT_PUBLIC_APPWRITE_ENDPOINT is not set');
}
if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) {
  throw new Error('NEXT_PUBLIC_APPWRITE_PROJECT_ID is not set');
}
if (!process.env.APPWRITE_API_KEY) {
  throw new Error('APPWRITE_API_KEY is not set');
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

export const serverDatabases = new Databases(client);
export const serverStorage = new Storage(client);
export const serverUsers = new Users(client);

export const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'notestamp';

export const COLLECTIONS = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  SOURCES: 'sources',
  NOTES: 'notes',
  FLASHCARD_SETS: 'flashcard_sets',
  QUIZ_ATTEMPTS: 'quiz_attempts',
  BADGES: 'badges',
  USAGE_LOG: 'usage_log',
  CHAT_SESSIONS: 'chat_sessions',
  SANDBOX_TRACES: 'sandbox_traces',
  MATH_ATTEMPTS: 'math_attempts',
  CONCEPT_MASTERY: 'concept_mastery',
} as const;

