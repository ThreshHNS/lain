import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  assetReferenceSchema,
  promptMessageSchema,
  promptMessageSourceSchema,
  promptSessionSchema,
  slotHintSchema,
} from './types.js';
import { promptSessions, messageStore, createInitialDraft } from './store.js';
import {
  AssistantUnavailableError,
  generateAssistantReply,
  transcribeAudio,
} from './assistant.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const createPromptSessionBody = z.object({
  title: z.string().min(1),
  creatorId: z.string().min(1),
});

const appendMessageBody = z.object({
  text: z.string().min(1),
  role: z.enum(['user', 'assistant', 'tool']).default('user'),
  source: promptMessageSourceSchema.default('text'),
  slot: slotHintSchema.nullable().default(null),
});

const respondPromptBody = z.object({
  assistantId: z.string().min(1).optional(),
  assistantLabel: z.string().min(1).default('Assistant'),
  sceneStateSummary: z.string().trim().min(1).optional(),
  slot: slotHintSchema.nullable().default(null),
  text: z.string().min(1),
});

const transcribeVoiceBody = z.object({
  audioBase64: z.string().min(1),
  filename: z.string().trim().min(1).default('voice-note.m4a'),
  mimeType: z.string().trim().min(1).default('audio/m4a'),
  prompt: z.string().trim().min(1).optional(),
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/prompt-sessions', (req, res) => {
  const body = createPromptSessionBody.parse(req.body);
  const session = promptSessionSchema.parse({
    id: randomUUID(),
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
    id: randomUUID(),
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

app.post('/prompt-sessions/:id/respond', async (req, res, next) => {
  const { id } = req.params;
  const session = promptSessions.get(id);
  if (!session) {
    return res.status(404).json({ error: 'session not found' });
  }

  try {
    const body = respondPromptBody.parse(req.body);
    const history = messageStore.get(id) ?? [];
    const reply = await generateAssistantReply({
      assistantLabel: body.assistantLabel,
      history,
      promptText: body.text,
      sceneStateSummary: body.sceneStateSummary ?? null,
      session,
      slot: body.slot,
    });
    const message = promptMessageSchema.parse({
      createdAt: new Date().toISOString(),
      id: randomUUID(),
      role: 'assistant',
      sessionId: id,
      slot: body.slot,
      source: 'codex',
      text: reply.text,
    });
    const existing = messageStore.get(id) ?? [];
    existing.unshift(message);
    messageStore.set(id, existing);
    promptSessions.set(id, {
      ...session,
      latestResponseId: message.id,
    });
    res.json({
      message,
      model: reply.model,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/voice/transcriptions', async (req, res, next) => {
  try {
    const body = transcribeVoiceBody.parse(req.body);
    const transcript = await transcribeAudio(body);
    res.json(transcript);
  } catch (error) {
    next(error);
  }
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
    .map(asset => assetReferenceSchema.safeParse(asset))
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

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'invalid request',
      issues: error.issues,
    });
  }

  if (error instanceof AssistantUnavailableError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
    });
  }

  console.error(error);
  return res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`backend listening on http://localhost:${PORT}`);
});
