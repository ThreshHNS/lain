import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { AssetReference, HistoryEntry, SlotHint, ActiveUser } from '@/types/editor';

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
};

const SceneEditorContext = createContext<SceneEditorContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function SceneEditorProvider({ children }: { children: ReactNode }) {
  const [slotHint, setSlotHint] = useState<SlotHint>('walk');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [assets, setAssets] = useState<AssetReference[]>([]);

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'actor'>) => {
    setHistory(prev => [
      {
        ...entry,
        id: createId('hist'),
        actor: LOCAL_USER,
      },
      ...prev,
    ]);
  }, []);

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
    }),
    [slotHint, history, assets, addHistory, addAsset],
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
