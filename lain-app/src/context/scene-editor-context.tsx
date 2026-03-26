import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  appendPromptMessage,
  createPromptSession,
  fetchPromptMessages,
  PromptSessionApiError,
  type PromptMessageRecord,
  type PromptMessageSource,
} from '@/lib/api/prompt-session';
import type { ActiveUser, AssetReference, HistoryEntry, SlotHint } from '@/types/editor';

const SESSION_RETRY_DELAY_MS = 4000;

export type SceneEditorSessionSyncState = 'connecting' | 'connected' | 'offline';

type SceneEditorSessionStatus = 'offline' | 'ready' | 'syncing';

type AddHistoryResult = {
  entryId: string;
  persisted: boolean;
  sessionId: string | null;
};

type SceneEditorContextValue = {
  slotHint: SlotHint;
  setSlotHint: (hint: SlotHint) => void;
  history: HistoryEntry[];
  assets: AssetReference[];
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'actor'>) => Promise<AddHistoryResult>;
  addAsset: (asset: AssetReference) => void;
  removeAsset: (assetId: string) => void;
  collaborators: ActiveUser[];
  sessionId: string | null;
  sessionSyncError: string | null;
  sessionSyncState: SceneEditorSessionSyncState;
  sessionError: string | null;
  sessionStatus: SceneEditorSessionStatus;
  pendingHistoryCount: number;
  retrySession: () => void;
  retrySessionSync: () => void;
};

type SceneEditorProviderProps = {
  children: ReactNode;
  initialSessionId?: string | null;
  initialSessionTitle?: string;
};

type PendingHistorySync = {
  audioUri?: string;
  label: string;
  optimisticId: string;
  slot?: SlotHint;
  timestamp: string;
  type: HistoryEntry['type'];
};

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

const SceneEditorContext = createContext<SceneEditorContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function normalizeSlot(slot: string | null | undefined): SlotHint | undefined {
  if (slot === 'walk' || slot === 'kill' || slot === 'seed' || slot === 'idle') {
    return slot;
  }

  return undefined;
}

function mapHistoryTypeToMessageSource(type: HistoryEntry['type']): PromptMessageSource {
  if (type === 'asset') {
    return 'asset';
  }
  if (type === 'photo') {
    return 'photo';
  }
  if (type === 'text') {
    return 'text';
  }

  return 'voice';
}

function mapMessageSourceToHistoryType(source: string | null | undefined): HistoryEntry['type'] {
  if (source === 'asset') {
    return 'asset';
  }
  if (source === 'photo') {
    return 'photo';
  }
  if (source === 'voice' || source === 'transcript') {
    return 'voice';
  }

  return 'text';
}

function toHistoryEntry(
  message: PromptMessageRecord,
  overrides: Partial<Pick<HistoryEntry, 'audioUri'>> = {},
): HistoryEntry {
  return {
    id: message.id,
    actor: LOCAL_USER,
    audioUri: overrides.audioUri,
    label: message.text,
    slot: normalizeSlot(message.slot),
    timestamp: message.createdAt,
    type: mapMessageSourceToHistoryType(message.source),
  };
}

function sortHistoryDescending(entries: HistoryEntry[]) {
  return [...entries].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

function mergeRemoteHistory(
  currentHistory: HistoryEntry[],
  messages: PromptMessageRecord[],
  pendingEntries: PendingHistorySync[],
) {
  const pendingIds = new Set(pendingEntries.map(entry => entry.optimisticId));
  const remoteHistory = messages
    .filter(message => message.role === 'user')
    .map(message => toHistoryEntry(message));
  const pendingLocalHistory = currentHistory.filter(entry => pendingIds.has(entry.id));

  return sortHistoryDescending([...remoteHistory, ...pendingLocalHistory]);
}

function extractSessionSyncError(error: unknown) {
  if (error instanceof PromptSessionApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Prompt session sync is unavailable right now.';
}

function toSessionStatus(syncState: SceneEditorSessionSyncState): SceneEditorSessionStatus {
  if (syncState === 'connected') {
    return 'ready';
  }
  if (syncState === 'connecting') {
    return 'syncing';
  }

  return 'offline';
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
  const [sessionSyncState, setSessionSyncState] =
    useState<SceneEditorSessionSyncState>('connecting');
  const [sessionSyncError, setSessionSyncError] = useState<string | null>(null);
  const [pendingHistoryCount, setPendingHistoryCount] = useState(0);
  const isMountedRef = useRef(true);
  const sessionIdRef = useRef<string | null>(initialSessionId);
  const historyHydratedRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const flushInFlightRef = useRef(false);
  const pendingHistoryRef = useRef<PendingHistorySync[]>([]);

  const flushPendingHistory = useCallback(
    async (activeSessionId: string, targetOptimisticId?: string | null) => {
      if (flushInFlightRef.current || pendingHistoryRef.current.length === 0) {
        return {
          persistedEntryId: null,
          flushedAllEntries: true,
        };
      }

      flushInFlightRef.current = true;
      let persistedEntryId: string | null = null;

      try {
        while (pendingHistoryRef.current.length > 0) {
          const nextEntry = pendingHistoryRef.current[0];
          const message = await appendPromptMessage(
            activeSessionId,
            nextEntry.label,
            nextEntry.slot ?? null,
            mapHistoryTypeToMessageSource(nextEntry.type),
          );

          if (!isMountedRef.current) {
            return {
              persistedEntryId,
              flushedAllEntries: false,
            };
          }

          pendingHistoryRef.current = pendingHistoryRef.current.filter(
            entry => entry.optimisticId !== nextEntry.optimisticId,
          );
          setPendingHistoryCount(pendingHistoryRef.current.length);
          setHistory(previousHistory =>
            sortHistoryDescending(
              previousHistory.map(item =>
                item.id === nextEntry.optimisticId
                  ? toHistoryEntry(message, { audioUri: nextEntry.audioUri })
                  : item,
              ),
            ),
          );

          if (nextEntry.optimisticId === targetOptimisticId) {
            persistedEntryId = message.id;
          }
        }

        return {
          persistedEntryId,
          flushedAllEntries: true,
        };
      } catch (error) {
        if (isMountedRef.current) {
          setSessionSyncError(extractSessionSyncError(error));
          setSessionSyncState('offline');
        }

        return {
          persistedEntryId,
          flushedAllEntries: false,
        };
      } finally {
        flushInFlightRef.current = false;
      }
    },
    [],
  );

  const syncSession = useCallback(async () => {
    if (syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setSessionSyncState('connecting');
    setSessionSyncError(null);

    try {
      let activeSessionId = sessionIdRef.current;

      if (!activeSessionId) {
        const session = await createPromptSession(initialSessionTitle, LOCAL_USER.id);
        if (!isMountedRef.current) {
          return;
        }

        activeSessionId = session.id;
        sessionIdRef.current = session.id;
        setSessionId(session.id);
      }

      if (!historyHydratedRef.current) {
        const messages = await fetchPromptMessages(activeSessionId);
        if (!isMountedRef.current) {
          return;
        }

        historyHydratedRef.current = true;
        setHistory(previousHistory =>
          mergeRemoteHistory(previousHistory, messages, pendingHistoryRef.current),
        );
      }

      const { flushedAllEntries } = await flushPendingHistory(activeSessionId);
      if (!isMountedRef.current || !flushedAllEntries) {
        return;
      }

      setSessionSyncState('connected');
      setSessionSyncError(null);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setSessionSyncError(extractSessionSyncError(error));
      setSessionSyncState('offline');
    } finally {
      syncInFlightRef.current = false;
    }
  }, [flushPendingHistory, initialSessionTitle]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    isMountedRef.current = true;
    void syncSession();

    return () => {
      isMountedRef.current = false;
    };
  }, [syncSession]);

  useEffect(() => {
    if (sessionSyncState !== 'offline') {
      return;
    }

    const timeoutId = setTimeout(() => {
      void syncSession();
    }, SESSION_RETRY_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [sessionSyncState, syncSession]);

  const addHistory = useCallback(
    async (entry: Omit<HistoryEntry, 'id' | 'actor'>) => {
      const optimisticEntry: HistoryEntry = {
        id: createId('history'),
        actor: LOCAL_USER,
        audioUri: entry.audioUri,
        label: entry.label,
        slot: entry.slot,
        timestamp: entry.timestamp,
        type: entry.type ?? 'voice',
      };

      pendingHistoryRef.current = [
        ...pendingHistoryRef.current,
        {
          audioUri: entry.audioUri,
          label: entry.label,
          optimisticId: optimisticEntry.id,
          slot: entry.slot,
          timestamp: entry.timestamp,
          type: entry.type ?? 'voice',
        },
      ];

      setPendingHistoryCount(pendingHistoryRef.current.length);
      setHistory(previousHistory => [optimisticEntry, ...previousHistory]);

      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) {
        const { flushedAllEntries, persistedEntryId } = await flushPendingHistory(
          activeSessionId,
          optimisticEntry.id,
        );

        return {
          entryId: persistedEntryId ?? optimisticEntry.id,
          persisted:
            flushedAllEntries &&
            !pendingHistoryRef.current.some(
              pendingEntry => pendingEntry.optimisticId === optimisticEntry.id,
            ),
          sessionId: activeSessionId,
        };
      }

      void syncSession();
      return {
        entryId: optimisticEntry.id,
        persisted: false,
        sessionId: sessionIdRef.current,
      };
    },
    [flushPendingHistory, syncSession],
  );

  const addAsset = useCallback(
    (asset: AssetReference) => {
      setAssets(previousAssets => {
        if (previousAssets.some(existingAsset => existingAsset.id === asset.id)) {
          return previousAssets;
        }

        return [...previousAssets, { ...asset, updatedAt: new Date().toISOString() }];
      });

      void addHistory({
        label: `Added ${asset.name}`,
        slot: asset.slot,
        timestamp: new Date().toISOString(),
        type: 'asset',
      });
    },
    [addHistory],
  );

  const removeAsset = useCallback((assetId: string) => {
    setAssets(previousAssets => previousAssets.filter(asset => asset.id !== assetId));
  }, []);

  const retrySessionSync = useCallback(() => {
    void syncSession();
  }, [syncSession]);

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
      sessionError: sessionSyncError,
      sessionStatus: toSessionStatus(sessionSyncState),
      sessionSyncError,
      sessionSyncState,
      pendingHistoryCount,
      retrySession: retrySessionSync,
      retrySessionSync,
    }),
    [
      slotHint,
      history,
      assets,
      addHistory,
      addAsset,
      removeAsset,
      sessionId,
      sessionSyncError,
      sessionSyncState,
      pendingHistoryCount,
      retrySessionSync,
    ],
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
