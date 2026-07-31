import { z } from 'zod';

export const conceptMapNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const conceptMapEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

export const conceptMapOutputSchema = z.object({
  nodes: z.array(conceptMapNodeSchema),
  edges: z.array(conceptMapEdgeSchema),
});
