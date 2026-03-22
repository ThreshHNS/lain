import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AssetReference, HistoryEntry, SlotHint, ActiveUser } from '@/types/editor';
import {
  appendPromptMessage,
  createPromptSession,
  fetchPromptMessages,
} from '@/lib/api/prompt-session';

const LOCAL_USER: ActiveUser = {
  id: 'local-creator',
  name: 'You',
  avatarUrl: undefined,
  isOnline: true,
};

const COLLABORATORS: ActiveUser[] = [
  LOCAL_USER,
  { id: 'u2', name: 'Ava', isOnline: false },
  { id: 'u3', name: 'Codex', isOnline: true },
];

type SceneEditorContextValue = {
  slotHint: SlotHint;
  setSlotHint: (hint: SlotHint) => void;
  history: HistoryEntry[];
  assets: AssetReference[];
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'actor'>) => void;
  addAsset: (asset: AssetReference) => void;
  collaborators: ActiveUser[];
  sessionId: string | null;
};

const SceneEditorContext = createContext<SceneEditorContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function SceneEditorProvider({ children }: { children: ReactNode }) {
  const [slotHint, setSlotHint] = useState<SlotHint>('walk');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [assets, setAssets] = useState<AssetReference[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const session = await createPromptSession('Scene editor draft', 'local-creator');
      if (!active) {
        return;
      }
      setSessionId(session.id);
      const messages = await fetchPromptMessages(session.id);
      setHistory(messages.map(msg => ({
        id: msg.id,
        actor: LOCAL_USER,
        label: msg.text,
        slot: msg.slot ?? null,
        type: 'voice',
        timestamp: msg.createdAt,
      })));
    })();

    return () => {
      active = false;
    };
  }, []);

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'actor'>) => {
    if (!sessionId) {
      return;
    }

    appendPromptMessage(sessionId, entry.label, entry.slot ?? null).then(message => {
      setHistory(prev => [
        {
          id: message.id,
          actor: LOCAL_USER,
          label: message.text,
          slot: message.slot ?? null,
          type: entry.type ?? 'voice',
          timestamp: message.createdAt,
        },
        ...prev,
      ]);
    });
  }, [sessionId]);

  const addAsset = useCallback(
    (asset: AssetReference) => {
      setAssets(prev => {
        if (prev.some(existing => existing.id === asset.id)) {
          return prev;
        }
        return [...prev, { ...asset, updatedAt: new Date().toISOString() }];
      });

      addHistory({
        label: `Added ${asset.name}`,
        timestamp: new Date().toISOString(),
        type: 'asset',
      });
    },
    [addHistory],
  );

  const value = useMemo(
    () => ({
    slotHint,
    setSlotHint,
    history,
    assets,
    addHistory,
    addAsset,
    collaborators: COLLABORATORS,
    sessionId,
  }),
  [slotHint, history, assets, addHistory, addAsset, sessionId],
);

  return <SceneEditorContext.Provider value={value}>{children}</SceneEditorContext.Provider>;
}

export function useSceneEditor() {
  const context = useContext(SceneEditorContext);
  if (!context) {
    throw new Error('useSceneEditor must be used within SceneEditorProvider');
  }
  return context;
}
