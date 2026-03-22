import { PromptMessage, PromptSession } from './types.js';

export const promptSessions = new Map<string, PromptSession>();
export const messageStore = new Map<string, PromptMessage[]>();

export function createInitialDraft(session: PromptSession) {
  return {
    sessionId: session.id,
    title: session.title,
    slotHint: 'walk',
    assets: [],
    history: [],
  };
}
