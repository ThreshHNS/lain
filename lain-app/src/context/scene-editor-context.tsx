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

function mapMessageSourceToHistoryType(source: string | null | undefined): HistoryEntry['type'] {
  if (source === 'asset') {
    return 'asset';
  }
  if (source === 'photo') {
    return 'photo';
  }
  if (source === 'text') {
    return 'text';
  }
  return 'voice';
}

type SceneEditorContextValue = {
  slotHint: SlotHint;
  setSlotHint: (hint: SlotHint) => void;
  history: HistoryEntry[];
  assets: AssetReference[];
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'actor'>) => void;
  addAsset: (asset: AssetReference) => void;
  removeAsset: (assetId: string) => void;
  collaborators: ActiveUser[];
  sessionId: string | null;
};

type SceneEditorProviderProps = {
  children: ReactNode;
  initialSessionId?: string | null;
  initialSessionTitle?: string;
};

const SceneEditorContext = createContext<SceneEditorContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function SceneEditorProvider({
  children,
  initialSessionId = null,
  initialSessionTitle = 'Scene editor draft',
}: SceneEditorProviderProps) {
  const [slotHint, setSlotHint] = useState<SlotHint>('walk');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [assets, setAssets] = useState<AssetReference[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const nextSessionId =
          initialSessionId ??
          (
            await createPromptSession(initialSessionTitle, 'local-creator')
          ).id;
        if (!active) {
          return;
        }

        setSessionId(nextSessionId);

        const messages = await fetchPromptMessages(nextSessionId);
        if (!active) {
          return;
        }

        setHistory(messages.map(msg => ({
          id: msg.id,
          actor: LOCAL_USER,
          label: msg.text,
          slot: msg.slot === 'walk' || msg.slot === 'kill' || msg.slot === 'seed' || msg.slot === 'idle'
            ? msg.slot
            : undefined,
          type: mapMessageSourceToHistoryType(msg.source),
          timestamp: msg.createdAt,
        })));
      } catch (error) {
        void error;
      }
    })();

    return () => {
      active = false;
    };
  }, [initialSessionId, initialSessionTitle]);

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'actor'>) => {
    const optimisticEntry: HistoryEntry = {
      id: createId('history'),
      actor: LOCAL_USER,
      label: entry.label,
      slot: entry.slot,
      timestamp: entry.timestamp,
      type: entry.type ?? 'voice',
      audioUri: entry.audioUri,
    };

    setHistory(prev => [optimisticEntry, ...prev]);

    if (!sessionId) {
      return;
    }

    appendPromptMessage(sessionId, entry.label, entry.slot ?? null, entry.type ?? 'voice')
      .then(message => {
        setHistory(prev =>
          prev.map(item =>
            item.id === optimisticEntry.id
              ? {
                  id: message.id,
                  actor: LOCAL_USER,
                  label: message.text,
                  slot:
                    message.slot === 'walk' ||
                    message.slot === 'kill' ||
                    message.slot === 'seed' ||
                    message.slot === 'idle'
                      ? message.slot
                      : undefined,
                  type: mapMessageSourceToHistoryType(message.source),
                  timestamp: message.createdAt,
                  audioUri: entry.audioUri,
                }
              : item,
          ),
        );
      })
      .catch(error => {
        void error;
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
        slot: asset.slot,
        timestamp: new Date().toISOString(),
        type: 'asset',
      });
    },
    [addHistory],
  );

  const removeAsset = useCallback((assetId: string) => {
    setAssets(prev => prev.filter(asset => asset.id !== assetId));
  }, []);

  const value = useMemo(
    () => ({
      slotHint,
      setSlotHint,
      history,
      assets,
      addHistory,
      addAsset,
      removeAsset,
      collaborators: COLLABORATORS,
      sessionId,
    }),
    [slotHint, history, assets, addHistory, addAsset, removeAsset, sessionId],
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
