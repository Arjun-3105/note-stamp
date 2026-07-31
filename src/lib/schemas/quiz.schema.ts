import { z } from 'zod';

export const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
  explanation: z.string(),
});

export const quizOutputSchema = z.object({
  questions: z.array(quizQuestionSchema),
});
