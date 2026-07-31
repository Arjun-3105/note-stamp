import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'notestamp';

const collectionsToCreate = [
  {
    id: 'users',
    name: 'Users',
    attributes: [
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'email', type: 'string', size: 100, required: true },
      { key: 'plan', type: 'string', size: 50, required: true },
      { key: 'stripeCustomerId', type: 'string', size: 100, required: false },
      { key: 'stripeSubscriptionId', type: 'string', size: 100, required: false },
      { key: 'wallet', type: 'string', size: 100, required: false },
      { key: 'createdAt', type: 'string', size: 50, required: true },
    ]
  },
  {
    id: 'workspaces',
    name: 'Workspaces',
    attributes: [
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'description', type: 'string', size: 1000, required: false },
      { key: 'status', type: 'string', size: 50, required: true },
      { key: 'sourceCount', type: 'integer', required: true },
      { key: 'completedUnits', type: 'integer', required: true },
      { key: 'totalUnits', type: 'integer', required: true },
      { key: 'createdAt', type: 'string', size: 50, required: true },
      { key: 'updatedAt', type: 'string', size: 50, required: true },
    ]
  },
  {
    id: 'sources',
    name: 'Sources',
    attributes: [
      { key: 'workspaceId', type: 'string', size: 100, required: true },
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'type', type: 'string', size: 50, required: true },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'url', type: 'string', size: 500, required: false },
      { key: 'inputHash', type: 'string', size: 255, required: true },
      { key: 'rawTextPath', type: 'string', size: 500, required: false },
      { key: 'metadata', type: 'string', size: 5000, required: false },
      { key: 'status', type: 'string', size: 50, required: true },
      { key: 'createdAt', type: 'string', size: 50, required: true },
    ]
  },
  {
    id: 'notes',
    name: 'Notes',
    attributes: [
      { key: 'sourceId', type: 'string', size: 100, required: true },
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'content', type: 'string', size: 50000, required: true },
      { key: 'tags', type: 'string', array: true, size: 50, required: false },
      { key: 'wordCount', type: 'integer', required: true },
      { key: 'createdAt', type: 'string', size: 50, required: true },
      { key: 'updatedAt', type: 'string', size: 50, required: true },
    ]
  },
  {
    id: 'flashcard_sets',
    name: 'Flashcard Sets',
    attributes: [
      { key: 'sourceId', type: 'string', size: 100, required: true },
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'cards', type: 'string', size: 50000, required: true },
      { key: 'promptVersion', type: 'string', size: 50, required: true },
      { key: 'model', type: 'string', size: 100, required: true },
      { key: 'generatedAt', type: 'string', size: 50, required: true },
    ]
  },
  {
    id: 'quiz_attempts',
    name: 'Quiz Attempts',
    attributes: [
      { key: 'sourceId', type: 'string', size: 100, required: true },
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'questions', type: 'string', size: 50000, required: true },
      { key: 'answers', type: 'string', size: 10000, required: true },
      { key: 'score', type: 'integer', required: true },
      { key: 'passed', type: 'boolean', required: true },
      { key: 'takenAt', type: 'string', size: 50, required: false },
    ]
  },
  {
    id: 'badges',
    name: 'Badges',
    attributes: [
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'type', type: 'string', size: 50, required: true },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'skill', type: 'string', size: 100, required: true },
      { key: 'sourceId', type: 'string', size: 100, required: false },
      { key: 'workspaceId', type: 'string', size: 100, required: false },
      { key: 'evidenceIds', type: 'string', size: 5000, required: true },
      { key: 'componentBadgeIds', type: 'string', size: 5000, required: false },
      { key: 'score', type: 'integer', required: true },
      { key: 'tokenId', type: 'string', size: 100, required: false },
      { key: 'txHash', type: 'string', size: 255, required: false },
      { key: 'ipfsHash', type: 'string', size: 255, required: false },
      { key: 'metadataUri', type: 'string', size: 500, required: false },
      { key: 'mintedAt', type: 'string', size: 50, required: false },
    ]
  },
  {
    id: 'chat_sessions',
    name: 'Chat Sessions',
    attributes: [
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'contextType', type: 'string', size: 50, required: true },
      { key: 'contextId', type: 'string', size: 100, required: true },
      { key: 'messages', type: 'string', size: 50000, required: true },
      { key: 'mode', type: 'string', size: 50, required: true },
      { key: 'inputType', type: 'string', size: 50, required: true },
      { key: 'summary', type: 'string', size: 1000, required: false },
      { key: 'createdAt', type: 'string', size: 50, required: true },
      { key: 'updatedAt', type: 'string', size: 50, required: true },
    ]
  },
  {
    id: 'usage_log',
    name: 'Usage Log',
    attributes: [
      { key: 'userId', type: 'string', size: 100, required: true },
      { key: 'route', type: 'string', size: 255, required: true },
      { key: 'model', type: 'string', size: 100, required: false },
      { key: 'inputTokens', type: 'integer', required: false },
      { key: 'outputTokens', type: 'integer', required: false },
      { key: 'cached', type: 'boolean', required: true },
      { key: 'durationMs', type: 'integer', required: false },
      { key: 'createdAt', type: 'string', size: 50, required: true },
    ]
  }
];

async function setup() {
  console.log(`Setting up DB: ${dbId}`);
  
  // 1. Truncate (delete all existing collections)
  try {
    const collectionsRes = await db.listCollections(dbId);
    console.log(`Found ${collectionsRes.total} collections to delete.`);
    for (const coll of collectionsRes.collections) {
      console.log(`Deleting collection: ${coll.$id}`);
      await db.deleteCollection(dbId, coll.$id);
    }
  } catch (err) {
    if (err.code === 404) {
      console.log(`Database ${dbId} not found. Please create it manually in the Appwrite UI first!`);
      process.exit(1);
    }
    console.error('Error listing collections:', err);
  }

  // 2. Create required collections
  for (const coll of collectionsToCreate) {
    console.log(`\nCreating collection: ${coll.id}`);
    try {
      await db.createCollection(dbId, coll.id, coll.name);
      console.log(`-> Created collection ${coll.id}`);
    } catch (err) {
      console.error(`-> Error creating collection ${coll.id}:`, err.message);
      continue;
    }

    // 3. Create attributes
    for (const attr of coll.attributes) {
      try {
        if (attr.type === 'string') {
          await db.createStringAttribute(dbId, coll.id, attr.key, attr.size, attr.required, undefined, attr.array);
        } else if (attr.type === 'integer') {
          await db.createIntegerAttribute(dbId, coll.id, attr.key, attr.required, 0, 999999999, undefined, attr.array);
        } else if (attr.type === 'boolean') {
          await db.createBooleanAttribute(dbId, coll.id, attr.key, attr.required, undefined, attr.array);
        }
        console.log(`   -> Created attribute ${attr.key}`);
      } catch (err) {
        console.error(`   -> Error creating attribute ${attr.key}:`, err.message);
      }
    }
  }

  console.log('\nDone! Note: Appwrite creates attributes asynchronously. Wait a few seconds before using the DB.');
}

setup().catch(console.error);
