import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import {
  assetReferenceSchema,
  promptMessageSchema,
  promptSessionSchema,
  slotHintSchema,
} from './types.js';
import { promptSessions, messageStore, createInitialDraft } from './store.js';

const app = express();
app.use(cors());
app.use(express.json());

const createPromptSessionBody = z.object({
  title: z.string().min(1),
  creatorId: z.string().min(1),
});

const appendMessageBody = z.object({
  text: z.string().min(1),
  role: z.enum(['user', 'assistant', 'tool']).default('user'),
  source: z.enum(['text', 'voice', 'transcript', 'codex', 'system']).default('text'),
  slot: slotHintSchema.nullable().default(null),
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/prompt-sessions', (req, res) => {
  const body = createPromptSessionBody.parse(req.body);
  const session = promptSessionSchema.parse({
    id: uuid(),
    title: body.title,
    creatorId: body.creatorId,
    status: 'active',
    latestResponseId: null,
    createdAt: new Date().toISOString(),
  });
  promptSessions.set(session.id, session);
  messageStore.set(session.id, []);
  res.json({ session });
});

app.get('/prompt-sessions', (_req, res) => {
  res.json({ sessions: Array.from(promptSessions.values()) });
});

app.get('/prompt-sessions/:id/messages', (req, res) => {
  const { id } = req.params;
  if (!promptSessions.has(id)) {
    return res.status(404).json({ error: 'session not found' });
  }
  res.json({ messages: messageStore.get(id) ?? [] });
});

app.post('/prompt-sessions/:id/messages', (req, res) => {
  const { id } = req.params;
  if (!promptSessions.has(id)) {
    return res.status(404).json({ error: 'session not found' });
  }
  const body = appendMessageBody.parse(req.body);
  const message = promptMessageSchema.parse({
    id: uuid(),
    sessionId: id,
    text: body.text,
    role: body.role,
    source: body.source,
    slot: body.slot,
    createdAt: new Date().toISOString(),
  });
  const existing = messageStore.get(id) ?? [];
  existing.unshift(message);
  messageStore.set(id, existing);
  res.json({ message });
});

app.post('/scene-drafts/:id/export', (req, res) => {
  const { id } = req.params;
  const session = promptSessions.get(id);
  if (!session) {
    return res.status(404).json({ error: 'session not found' });
  }
  const draft = createInitialDraft(session);
  const assetsBody = (req.body.assets ?? []) as unknown[];
  const assets = assetsBody
    .map(assetReferenceSchema.safeParse)
    .filter(result => result.success)
    .map(result => result.data);
  const manifest = {
    ...draft,
    assets,
    history: messageStore.get(id) ?? [],
    exportedAt: new Date().toISOString(),
  };
  res.json({ manifest });
});

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`backend listening on http://localhost:${PORT}`);
});
