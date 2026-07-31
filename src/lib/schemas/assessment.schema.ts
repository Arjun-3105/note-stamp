import { z } from 'zod';

export const assessmentCheckpointSchema = z.object({
  label: z.string(),
  passed: z.boolean(),
  feedback: z.string(),
});

export const assessmentOutputSchema = z.object({
  score: z.number().min(0).max(100),
  checkpoints: z.array(assessmentCheckpointSchema),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  overallFeedback: z.string(),
});
