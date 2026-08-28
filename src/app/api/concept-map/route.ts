import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { parseAiJson } from "@/lib/json";
import { getLocalTranscript, getLocalRoadmap, saveLocalRoadmap } from "@/lib/local-db";
import { getSource } from "@/lib/db/sources";
import { buildSourceCoverageContext } from "@/lib/source-chunks";

export async function POST(req: NextRequest) {
  try {
    const { sourceId, detailed } = await req.json() as { sourceId?: string; detailed?: boolean };

    if (!sourceId) {
      return NextResponse.json({ error: "Source ID is required" }, { status: 400 });
    }

    const cachedRoadmap = await getLocalRoadmap(sourceId, !!detailed);
    if (cachedRoadmap) {
      return NextResponse.json(cachedRoadmap);
    }

    let sourceContent = await buildSourceCoverageContext(sourceId);
    if (!sourceContent) {
      sourceContent = await getLocalTranscript(sourceId);
    }
    
    // Fallback to Appwrite summary
    if (!sourceContent) {
      const source = await getSource(sourceId);
      if (source) {
        let meta: any = {};
        try { meta = JSON.parse(source.metadata as unknown as string || '{}'); } catch {}
        if (meta.summary) {
          sourceContent = JSON.stringify(meta.summary);
        }
      }
    }

    if (!sourceContent) {
      return NextResponse.json({ error: "Source content not found" }, { status: 404 });
    }

    const excerpt = sourceContent.slice(0, detailed ? 70000 : 45000);

    const detailedInstructions = detailed 
      ? `\n- Produce a VERY DETAILED roadmap (25-40 nodes) covering all nuanced topics.
- FOCUS ON DEEPER FOUNDATIONAL CONTEXT: Ensure every prerequisite is thoroughly mapped and explained.
- Include a very robust "FOUNDATION" layer that breaks down even basic assumptions before moving to CORE.`
      : `\n- Produce as many nodes as needed (typically 8-20 for most videos)`;

    const prompt = `
You are a senior curriculum architect. Your task is to extract ALL important concepts from this transcript and build a comprehensive, densely-connected learning dependency map.

═══════════════════════════════════════════════════════════════════════════════════
CRITICAL CONNECTIVITY REQUIREMENT: NO ORPHANED NODES ALLOWED
═══════════════════════════════════════════════════════════════════════════════════

EVERY SINGLE NODE must have AT LEAST ONE incoming OR outgoing edge. Completely isolated nodes are FORBIDDEN.

COMPREHENSIVE NODE GENERATION:${detailedInstructions}
- Organize into 3 hierarchical layers:
  1. FOUNDATION: Core prerequisites (first nodes)
  2. CORE: Main topic nodes (middle nodes) 
  3. ADVANCED: Extensions & applications (last nodes)
- Create "bridge nodes" that explicitly link different learning paths together

EDGE DENSITY TARGET: Aim for 1.2 to 1.5 edges per node on average
- If you have 15 nodes, generate 18-22 edges total
- More edges = stronger learning network

NODE SELECTION CRITERIA:
1. Include EVERY concept mentioned as foundational or repeated
2. Always include intermediate bridge concepts (don't jump directly from Foundation to Advanced)
3. DO NOT group concepts — keep them separate for granular learning
4. Include common misunderstandings or frequent stumbling blocks
5. Add final nodes that show real-world applications

EDGE SEMANTICS: Each edge must represent TRUE learning dependency:
- "required for": A is strictly necessary prerequisite for B
- "used inside": A is a component/helper used within B
- "enables": A gives you capability to do B  
- "extends": B builds on or expands A's concepts
- "composes with": A and B combine to form something larger
- "replaces": B is a newer/better version or alternative to A
- "simplifies": A makes B easier to understand or implement

HIERARCHICAL ORDERING RULES:
- Lower node IDs = earlier in learning sequence (Foundation first)
- Higher node IDs = later in learning sequence (Advanced last)
- Node IDs must be consecutive integers starting at "1"
- Order nodes so that prerequisites always come before dependent concepts

VALIDATION CHECKLIST (must satisfy ALL):
✓ Every node has at least 1 incoming or outgoing edge
✓ No 'required for' edges point backwards (from higher ID to lower ID)
✓ Edge source and target IDs exist in nodes
✓ No node is unreachable from Foundation layer
✓ At least 1 path exists from Foundation → Core → Advanced
✓ Bridge concepts connect at least 2 different learning paths

ANTI-PATTERN CHECKER: If found, fix immediately:
- ✗ Node with 0 edges → DELETE or create edge
- ✗ Circular dependencies ('A requires B requires A') → BREAK cycle by changing edge direction
- ✗ All edges point FROM node 1 → REDISTRIBUTE: add edges TO other Foundation nodes

CRITICAL JSON REQUIREMENTS: Return ONLY valid JSON — no markdown fences, no text outside object.
- Use double quotes for ALL keys and string values
- Do NOT use double quotes inside string values — use single quotes or rephrase
- No trailing commas
- Valid JSON array syntax: [...], valid object syntax: {...}

Expected Format:
{
  "nodes": [
    {
      "id": "1",
      "label": "Concept Name (3-5 words)",
      "description": "Why essential — 2 sentences explaining what breaks without it",
      "difficulty": "beginner|intermediate|advanced",
      "videoInsight": "Specific thing video says/shows about this concept",
      "practicalExample": "One minimal concrete example (use single quotes for code)"
    }
  ],
  "edges": [
    { "source": "1", "target": "2", "label": "required for" },
    { "source": "2", "target": "3", "label": "enables" }
  ]
}

EXAMPLE for 5-node graph (showing proper structure):
{
  "nodes": [
    { "id": "1", "label": "Foundation Concept A", "difficulty": "beginner", ... },
    { "id": "2", "label": "Foundation Concept B", "difficulty": "beginner", ... },
    { "id": "3", "label": "Bridge Concept", "difficulty": "intermediate", ... },
    { "id": "4", "label": "Core Topic", "difficulty": "intermediate", ... },
    { "id": "5", "label": "Advanced Application", "difficulty": "advanced", ... }
  ],
  "edges": [
    { "source": "1", "target": "3", "label": "required for" },
    { "source": "2", "target": "3", "label": "required for" },
    { "source": "3", "target": "4", "label": "enables" },
    { "source": "4", "target": "5", "label": "extends" },
    { "source": "2", "target": "4", "label": "used inside" }
  ]
}
Note: Node IDs 1-5 all have edges. No orphans. 5 edges for 5 nodes = 1.0 edge ratio.

Transcript/Summary excerpt (${sourceContent.length} chars available):
${excerpt}
`;

    const result = await callAI({
      systemPrompt: 'You are a senior curriculum architect. Return ONLY valid JSON.',
      userPrompt: prompt,
      jsonMode: true,
      tier: 'fast',
      maxTokens: 4096,
    });
    const data = parseAiJson<{ nodes: unknown[]; edges: unknown[] }>(result.content);

    // Validate and clean data (no hard limit - allow comprehensive graphs)
    if (Array.isArray(data.nodes)) {
      const validatedNodes = data.nodes.filter(n => typeof n === 'object' && n !== null && 'id' in n);
      const keptIds = new Set(validatedNodes.map((n: any) => n.id));
      data.nodes = validatedNodes;
      if (Array.isArray(data.edges)) {
        data.edges = (data.edges as Array<{ source: string; target: string }>).filter(
          (e) => keptIds.has(e.source) && keptIds.has(e.target)
        );
      }
    }

    await saveLocalRoadmap(sourceId, data, !!detailed);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Concept map error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate concept map" },
      { status: 500 }
    );
  }
}

