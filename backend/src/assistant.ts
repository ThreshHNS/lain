import type { PromptMessage, PromptSession } from './types.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe';
const MAX_CONTEXT_MESSAGES = 8;

type GenerateAssistantReplyInput = {
  assistantLabel: string;
  history: PromptMessage[];
  promptText: string;
  sceneStateSummary?: string | null;
  session: PromptSession;
  slot: PromptMessage['slot'];
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type OpenAITranscriptionResponse = {
  error?: {
    message?: string;
  };
  text?: string;
};

export class AssistantUnavailableError extends Error {
  code: string;
  status: number;

  constructor(message: string, status = 503, code = 'MODEL_UNAVAILABLE') {
    super(message);
    this.name = 'AssistantUnavailableError';
    this.code = code;
    this.status = status;
  }
}

function getOpenAIApiKey(actionLabel: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AssistantUnavailableError(`OPENAI_API_KEY is not configured for ${actionLabel}.`);
  }

  return apiKey;
}

function normalizeHistoryMessage(message: PromptMessage) {
  if (message.role === 'assistant') {
    return {
      content: message.text,
      role: 'assistant' as const,
    };
  }

  return {
    content:
      message.role === 'tool' ? `[tool:${message.source}] ${message.text}` : message.text,
    role: 'user' as const,
  };
}

function extractAssistantText(payload: OpenAIChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(part => part.text?.trim())
      .filter((value): value is string => Boolean(value))
      .join('\n')
      .trim();
  }

  return '';
}

export async function generateAssistantReply({
  assistantLabel,
  history,
  promptText,
  sceneStateSummary,
  session,
  slot,
}: GenerateAssistantReplyInput) {
  const apiKey = getOpenAIApiKey('editor replies');

  const contextMessages = history
    .slice(0, MAX_CONTEXT_MESSAGES)
    .reverse()
    .map(normalizeHistoryMessage);
  const systemPrompt = [
    `You are ${assistantLabel}, helping edit an interactive scene draft titled "${session.title}".`,
    'Respond with concise, production-minded scene direction.',
    slot ? `Current slot hint: ${slot}.` : 'No slot hint is currently active.',
    sceneStateSummary ? `Latest live scene state: ${sceneStateSummary}.` : null,
    'Do not claim to have executed tools, changed assets, or modified runtime state unless the user explicitly confirms that a connected tool completed that work.',
    'When useful, call out the next concrete edit or validation step.',
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  try {
    const response = await fetch(OPENAI_API_URL, {
      body: JSON.stringify({
        messages: [
          {
            content: systemPrompt,
            role: 'system',
          },
          ...contextMessages,
          {
            content: promptText,
            role: 'user',
          },
        ],
        model: DEFAULT_OPENAI_MODEL,
        temperature: 0.8,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const payload = (await response.json().catch(() => null)) as OpenAIChatCompletionResponse | null;

    if (!response.ok) {
      const message =
        payload?.error?.message?.trim() ||
        `Model request failed with status ${response.status}`;
      throw new AssistantUnavailableError(message, response.status, 'MODEL_REQUEST_FAILED');
    }

    const text = extractAssistantText(payload ?? {});
    if (!text) {
      throw new AssistantUnavailableError(
        'Model returned an empty response.',
        502,
        'EMPTY_MODEL_RESPONSE',
      );
    }

    return {
      model: DEFAULT_OPENAI_MODEL,
      text,
    };
  } catch (error) {
    if (error instanceof AssistantUnavailableError) {
      throw error;
    }

    throw new AssistantUnavailableError(
      'Could not reach the configured model provider.',
      503,
      'MODEL_NETWORK_ERROR',
    );
  }
}

export async function transcribeAudio({
  audioBase64,
  filename,
  mimeType,
  prompt,
}: {
  audioBase64: string;
  filename: string;
  mimeType: string;
  prompt?: string | null;
}) {
  const apiKey = getOpenAIApiKey('voice transcription');
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  if (audioBuffer.byteLength === 0) {
    throw new AssistantUnavailableError('Voice upload was empty.', 400, 'EMPTY_AUDIO_UPLOAD');
  }

  try {
    const form = new FormData();
    form.set('model', DEFAULT_OPENAI_TRANSCRIPTION_MODEL);
    if (prompt?.trim()) {
      form.set('prompt', prompt.trim());
    }
    form.set('file', new Blob([audioBuffer], { type: mimeType }), filename);

    const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
      body: form,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      method: 'POST',
    });

    const payload = (await response.json().catch(() => null)) as OpenAITranscriptionResponse | null;
    if (!response.ok) {
      const message =
        payload?.error?.message?.trim() ||
        `Voice transcription failed with status ${response.status}`;
      throw new AssistantUnavailableError(message, response.status, 'TRANSCRIPTION_REQUEST_FAILED');
    }

    const text = payload?.text?.trim() ?? '';
    if (!text) {
      throw new AssistantUnavailableError(
        'Voice transcription returned empty text.',
        502,
        'EMPTY_TRANSCRIPTION',
      );
    }

    return {
      model: DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
      text,
    };
  } catch (error) {
    if (error instanceof AssistantUnavailableError) {
      throw error;
    }

    throw new AssistantUnavailableError(
      'Could not reach the configured transcription provider.',
      503,
      'TRANSCRIPTION_NETWORK_ERROR',
    );
  }
}
