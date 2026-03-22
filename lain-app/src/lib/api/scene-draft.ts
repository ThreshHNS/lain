const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export async function exportDraft(sessionId: string, assets: { id: string }[]) {
  const response = await fetch(`${API_BASE_URL}/scene-drafts/${sessionId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets }),
  });
  if (!response.ok) {
    throw new Error('Export failed');
  }
  return response.json();
}
