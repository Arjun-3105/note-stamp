import { z } from 'zod';

export const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
});

export const flashcardsOutputSchema = z.object({
  cards: z.array(flashcardSchema),
});
