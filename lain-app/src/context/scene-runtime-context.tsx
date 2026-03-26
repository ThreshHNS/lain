import { createContext, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import type { Mode } from '@/lib/scene-config';
import type { SceneBridgeState } from '@/lib/runtime/scene-bridge';

export type SceneRuntimeFrameStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SceneRuntimeSnapshot = {
  frameStatus: SceneRuntimeFrameStatus;
  lastState: SceneBridgeState | null;
  lastUpdatedAt: string | null;
};

type SceneRuntimeUpdate = Partial<
  Pick<SceneRuntimeSnapshot, 'frameStatus' | 'lastState' | 'lastUpdatedAt'>
>;

type SceneRuntimeContextValue = {
  clearSceneRuntime: (mode: Mode) => void;
  runtimeByMode: Partial<Record<Mode, SceneRuntimeSnapshot>>;
  upsertSceneRuntime: (mode: Mode, update: SceneRuntimeUpdate) => void;
};

const DEFAULT_SCENE_RUNTIME_SNAPSHOT: SceneRuntimeSnapshot = {
  frameStatus: 'idle',
  lastState: null,
  lastUpdatedAt: null,
};

const SceneRuntimeContext = createContext<SceneRuntimeContextValue | null>(null);

function createSceneRuntimeSnapshot(snapshot?: Partial<SceneRuntimeSnapshot> | null): SceneRuntimeSnapshot {
  return {
    ...DEFAULT_SCENE_RUNTIME_SNAPSHOT,
    ...snapshot,
  };
}

export function SceneRuntimeProvider({ children }: PropsWithChildren) {
  const [runtimeByMode, setRuntimeByMode] = useState<Partial<Record<Mode, SceneRuntimeSnapshot>>>({});

  const value = useMemo<SceneRuntimeContextValue>(
    () => ({
      clearSceneRuntime: (mode: Mode) => {
        setRuntimeByMode(previous => {
          if (!previous[mode]) {
            return previous;
          }

          const next = { ...previous };
          delete next[mode];
          return next;
        });
      },
      runtimeByMode,
      upsertSceneRuntime: (mode: Mode, update: SceneRuntimeUpdate) => {
        setRuntimeByMode(previous => ({
          ...previous,
          [mode]: createSceneRuntimeSnapshot({
            ...previous[mode],
            ...update,
          }),
        }));
      },
    }),
    [runtimeByMode],
  );

  return <SceneRuntimeContext.Provider value={value}>{children}</SceneRuntimeContext.Provider>;
}

export function useSceneRuntime(mode: Mode) {
  const context = useContext(SceneRuntimeContext);
  if (!context) {
    throw new Error('useSceneRuntime must be used within SceneRuntimeProvider');
  }

  return {
    clearSceneRuntime: context.clearSceneRuntime,
    runtime: context.runtimeByMode[mode] ?? DEFAULT_SCENE_RUNTIME_SNAPSHOT,
    upsertSceneRuntime: context.upsertSceneRuntime,
  };
}
