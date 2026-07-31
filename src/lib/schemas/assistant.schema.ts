import { z } from 'zod';

export const assistantHintSchema = z.object({
  nudge: z.string(),
  relatedConcept: z.string(),
  shouldReveal: z.boolean(),
});

export const assistantCorrectionSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
  isCorrect: z.boolean(),
});
