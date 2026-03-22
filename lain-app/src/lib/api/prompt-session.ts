const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

type PromptSessionResponse = {
  session: {
    id: string;
    title: string;
    creatorId: string;
    status: string;
    latestResponseId: string | null;
    createdAt: string;
  };
};

type MessageResponse = {
  message: {
    id: string;
    sessionId: string;
    text: string;
    role: string;
    source: string;
    slot: string | null;
    createdAt: string;
  };
};

export async function createPromptSession(title: string, creatorId: string) {
  const response = await fetch(`${API_BASE_URL}/prompt-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, creatorId }),
  });
  const payload: PromptSessionResponse = await response.json();
  return payload.session;
}

export async function appendPromptMessage(sessionId: string, text: string, slot?: string | null) {
  const response = await fetch(`${API_BASE_URL}/prompt-sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, slot, source: 'voice' }),
  });
  const payload: MessageResponse = await response.json();
  return payload.message;
}

export async function fetchPromptMessages(sessionId: string) {
  const response = await fetch(`${API_BASE_URL}/prompt-sessions/${sessionId}/messages`);
  const payload = await response.json();
  return payload.messages as MessageResponse['message'][];
}
