import { z } from 'zod';

export const slotHintSchema = z.enum(['walk', 'kill', 'seed', 'idle']);

export const promptMessageSourceSchema = z.enum([
  'asset',
  'codex',
  'photo',
  'system',
  'text',
  'transcript',
  'voice',
]);

export const promptSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  creatorId: z.string().min(1),
  status: z.enum(['active', 'archived']),
  latestResponseId: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const promptMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  text: z.string(),
  source: promptMessageSourceSchema,
  slot: slotHintSchema.nullable(),
  createdAt: z.string().datetime(),
});

export const assetReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.enum(['google_drive', 'poly_pizza', 'sketchfab', 'upload']),
  license: z.string(),
  url: z.string().url(),
  thumbnail: z.string().url().nullable(),
});

export type PromptSession = z.infer<typeof promptSessionSchema>;
export type PromptMessage = z.infer<typeof promptMessageSchema>;
export type AssetReference = z.infer<typeof assetReferenceSchema>;
