import type { CreateSceneDraftInput, SceneDraft } from '@/types/scene-draft';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

type SceneDraftListResponse = {
  sceneDrafts: SceneDraft[];
};

type CreateSceneDraftResponse = {
  sceneDraft: SceneDraft;
};

async function parseJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && payload.error
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchSceneDrafts(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/scene-drafts`, {
    method: 'GET',
    signal,
  });
  const payload = await parseJson<SceneDraftListResponse>(response);
  return payload.sceneDrafts;
}

export async function createSceneDraft(input: CreateSceneDraftInput, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/scene-drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const payload = await parseJson<CreateSceneDraftResponse>(response);
  return payload.sceneDraft;
}
