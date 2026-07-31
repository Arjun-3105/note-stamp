import { callAI } from './ai';
import { parseAiJson } from './json';

/**
 * Checks if a video's metadata and transcript suggest it is educational.
 * Returns true if educational, false otherwise.
 */
export async function checkIsEducational(meta: {
  title: string;
  description: string;
  channelName: string;
  categoryId?: string;
  transcript: string;
}): Promise<{ isEducational: boolean; reason?: string }> {
  const systemPrompt = `You are a content classifier. Analyze video information and determine if it is educational.
Return ONLY a JSON object: {"isEducational": boolean, "reason": "Brief 1-sentence explanation"}
Educational content includes: tutorials, lectures, deep dives, explanations, how-to guides, academic content.
Non-educational: pure entertainment, music, vlogs, comedy without educational purpose.`;

  const userPrompt = `Title: ${meta.title}
Channel: ${meta.channelName}
Category ID: ${meta.categoryId || 'Unknown'}
Description: ${meta.description.slice(0, 1000)}
Transcript excerpt: ${meta.transcript.slice(0, 2000)}`;

  try {
    const result = await callAI({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      maxTokens: 200,
      tier: 'budget',
    });
    return parseAiJson(result.content) as { isEducational: boolean; reason?: string };
  } catch (error) {
    console.error('Educational check failed:', error);
    return { isEducational: true };
  }
}
