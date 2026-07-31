import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai';
import { parseAiJson } from '@/lib/json';
import { getLocalRoadmap, saveLocalRoadmap } from '@/lib/local-db';

/**
 * POST /api/prerequisite-map
 * Generates a broader prerequisite knowledge tree for a given source/topic.
 * Returns nodes + edges showing what you need to know BEFORE this source.
 */
export async function POST(req: NextRequest) {
  try {
    const { sourceId, sourceTitle, sourceConcepts = [], detailed = false } = await req.json() as {
      sourceId?: string;
      sourceTitle?: string;
      sourceConcepts?: string[];
      detailed?: boolean;
    };

    if (sourceId) {
      const cached = await getLocalRoadmap(sourceId + '_prereqs', !!detailed);
      if (cached) return NextResponse.json(cached);
    }

    if (!sourceTitle) {
      return NextResponse.json({ error: 'sourceTitle is required' }, { status: 400 });
    }

    const conceptList = sourceConcepts.slice(0, 12).join(', ') || 'general concepts';

    const prompt = `
You are a senior curriculum designer and learning path architect.

Given a learning source titled: "${sourceTitle}"
Which covers these internal concepts: ${conceptList}

Your task: Generate a PREREQUISITE KNOWLEDGE ROADMAP — a dependency graph showing what broader knowledge areas someone needs to master BEFORE they can fully understand this source.

This is NOT about the source's internal concepts. It's about the broader skills and knowledge REQUIRED TO UNDERSTAND this source.

STRUCTURE REQUIREMENTS:
- Layer 0 (beginner): Absolute fundamentals — things everyone learns first
- Layer 1 (intermediate): Bridging knowledge — applying fundamentals to more specific domains
- Layer 2 (advanced): Near-prerequisites — the last things to master before this source
- Final node: The source itself (special "goal" node)

REQUIREMENTS:
- ${detailed ? '20 to 30 nodes total (highly granular and comprehensive)' : '8 to 15 nodes total'}
- Each node represents a distinct skill area or knowledge domain (broader than individual concepts)
- Include a "timeEstimate" for how long it typically takes to learn that area (e.g. "1-2 weeks", "1 month", "3-4 hours")
- Include a "category": "foundation" | "prerequisite" | "near-prerequisite" | "goal"
- The final node must be the source itself with category "goal" and id equal to the highest number
- Every node must have at least 1 edge
- Aim for clear linear learning paths from fundamentals to the goal

EDGE SEMANTICS:
- "builds on": This concept requires the previous one as base
- "required for": Cannot proceed without mastering this first
- "deepens with": This knowledge significantly enriches understanding
- "unlocks": Mastering this opens up access to the next concept

CRITICAL: Return ONLY valid JSON — no markdown, no text outside the object.

Expected format:
{
  "nodes": [
    {
      "id": "1",
      "label": "Skill Area Name",
      "description": "Why this is needed — 1-2 sentences",
      "difficulty": "beginner|intermediate|advanced",
      "category": "foundation|prerequisite|near-prerequisite|goal",
      "timeEstimate": "X weeks",
      "resources": "Best way to learn this (e.g., Khan Academy, practice problems)"
    }
  ],
  "edges": [
    { "source": "1", "target": "2", "label": "builds on" }
  ]
}`;

    const result = await callAI({
      systemPrompt: 'You are a senior curriculum architect. Return ONLY valid JSON.',
      userPrompt: prompt,
      jsonMode: true,
      tier: 'fast',
      maxTokens: 4096,
    });

    const data = parseAiJson<{ nodes: unknown[]; edges: unknown[] }>(result.content);

    if (Array.isArray(data.nodes)) {
      const validatedNodes = data.nodes.filter(
        n => typeof n === 'object' && n !== null && 'id' in n
      );
      const keptIds = new Set(validatedNodes.map((n: any) => n.id));
      data.nodes = validatedNodes;
      if (Array.isArray(data.edges)) {
        data.edges = (data.edges as Array<{ source: string; target: string }>).filter(
          e => keptIds.has(e.source) && keptIds.has(e.target)
        );
      }
    }

    if (sourceId) {
      await saveLocalRoadmap(sourceId + '_prereqs', data, !!detailed);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Prerequisite map error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate prerequisite map' },
      { status: 500 }
    );
  }
}
