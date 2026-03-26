const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export type PromptMessageSource =
  | 'asset'
  | 'codex'
  | 'photo'
  | 'service-orchestrator'
  | 'system'
  | 'text'
  | 'transcript'
  | 'voice';

export type PromptSessionRecord = {
  id: string;
  title: string;
  creatorId: string;
  status: string;
  latestResponseId: string | null;
  createdAt: string;
};

export type PromptMessageRecord = {
  id: string;
  sessionId: string;
  text: string;
  role: string;
  source: PromptMessageSource;
  slot: string | null;
  createdAt: string;
};

type PromptSessionResponse = {
  session: PromptSessionRecord;
};

type PromptMessageResponse = {
  message: PromptMessageRecord;
};

type PromptMessageListResponse = {
  messages: PromptMessageRecord[];
};

type PromptRespondResponse = {
  message: PromptMessageRecord;
  model?: string;
};

type PromptTranscriptionResponse = {
  model?: string;
  text: string;
};

export type PromptSessionApiErrorKind = 'network' | 'http' | 'decode';

export class PromptSessionApiError extends Error {
  cause?: unknown;
  code: string | null;
  kind: PromptSessionApiErrorKind;
  responseBody: unknown;
  status: number | null;

  constructor(
    message: string,
    {
      cause,
      code = null,
      kind,
      responseBody = null,
      status = null,
    }: {
      cause?: unknown;
      code?: string | null;
      kind: PromptSessionApiErrorKind;
      responseBody?: unknown;
      status?: number | null;
    },
  ) {
    super(message);
    this.name = 'PromptSessionApiError';
    this.cause = cause;
    this.code = code;
    this.kind = kind;
    this.responseBody = responseBody;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractMessage(payload: unknown, fallback: string) {
  if (isRecord(payload)) {
    const error = payload.error;
    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }

    const message = payload.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch (cause) {
    if (!response.ok) {
      throw new PromptSessionApiError(
        `Request failed with status ${response.status}`,
        {
          cause,
          kind: 'decode',
          status: response.status,
        },
      );
    }

    throw new PromptSessionApiError('Unable to decode prompt session response', {
      cause,
      kind: 'decode',
      status: response.status,
    });
  }

  if (!response.ok) {
    const code =
      isRecord(payload) && typeof payload.code === 'string' && payload.code.trim().length > 0
        ? payload.code
        : null;
    throw new PromptSessionApiError(
      extractMessage(payload, `Request failed with status ${response.status}`),
      {
        code,
        kind: 'http',
        responseBody: payload,
        status: response.status,
      },
    );
  }

  return payload as T;
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    return await parseJsonResponse<T>(response);
  } catch (cause) {
    if (cause instanceof PromptSessionApiError) {
      throw cause;
    }

    throw new PromptSessionApiError('Prompt session backend is unreachable', {
      cause,
      kind: 'network',
    });
  }
}

function inferAudioUploadMetadata(audioUri: string) {
  const sanitizedPath = audioUri.split('?')[0] ?? audioUri;
  const rawFileName = sanitizedPath.split('/').pop()?.trim() || 'voice-note.m4a';
  const normalizedFileName = rawFileName.includes('.') ? rawFileName : `${rawFileName}.m4a`;
  const extension = normalizedFileName.split('.').pop()?.toLowerCase() ?? 'm4a';

  if (extension === 'wav') {
    return {
      filename: normalizedFileName,
      mimeType: 'audio/wav',
    };
  }
  if (extension === 'caf') {
    return {
      filename: normalizedFileName,
      mimeType: 'audio/x-caf',
    };
  }
  if (extension === 'mp3') {
    return {
      filename: normalizedFileName,
      mimeType: 'audio/mpeg',
    };
  }

  return {
    filename: normalizedFileName,
    mimeType: 'audio/m4a',
  };
}

async function readAudioBase64(audioUri: string) {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    return await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (cause) {
    throw new PromptSessionApiError('Voice upload could not be read on this device', {
      cause,
      kind: 'decode',
    });
  }
}

export async function createPromptSession(title: string, creatorId: string) {
  const payload = await requestJson<PromptSessionResponse>('/prompt-sessions', {
    body: JSON.stringify({ creatorId, title }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  return payload.session;
}

export async function appendPromptMessage(
  sessionId: string,
  text: string,
  slot?: string | null,
  source: PromptMessageSource = 'voice',
) {
  const payload = await requestJson<PromptMessageResponse>(`/prompt-sessions/${sessionId}/messages`, {
    body: JSON.stringify({ slot, source, text }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  return payload.message;
}

export async function fetchPromptMessages(sessionId: string) {
  const payload = await requestJson<PromptMessageListResponse>(`/prompt-sessions/${sessionId}/messages`, {
    method: 'GET',
  });

  return payload.messages;
}

export async function respondToPrompt(
  sessionId: string,
  input: {
    assistantId: string;
    assistantLabel: string;
    sceneStateSummary?: string | null;
    slot?: string | null;
    text: string;
  },
) {
  return requestJson<PromptRespondResponse>(`/prompt-sessions/${sessionId}/respond`, {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

export async function transcribeVoiceRecording(
  audioUri: string,
  input?: {
    prompt?: string | null;
  },
) {
  const audioBase64 = await readAudioBase64(audioUri);
  const { filename, mimeType } = inferAudioUploadMetadata(audioUri);

  return requestJson<PromptTranscriptionResponse>('/voice/transcriptions', {
    body: JSON.stringify({
      audioBase64,
      filename,
      mimeType,
      prompt: input?.prompt ?? null,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}
