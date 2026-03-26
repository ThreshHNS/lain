export type SceneBridgeState = {
  assetState?: string;
  audioState?: string;
  invalidModeFallback?: boolean;
  lastAction?: string;
  mode?: string;
  targetState?: string;
};

type SceneBridgePayload = {
  state?: SceneBridgeState;
  type?: string;
};

export function parseSceneBridgeMessage(message: string): SceneBridgeState | null {
  try {
    const payload = JSON.parse(message) as SceneBridgePayload;
    if (payload.type !== 'scene-state' || !payload.state) {
      return null;
    }

    return payload.state;
  } catch {
    return null;
  }
}

export function formatSceneBridgeSummary(state: SceneBridgeState | null) {
  if (!state) {
    return null;
  }

  const parts = [
    state.lastAction ? `action ${state.lastAction}` : null,
    state.targetState ? `target ${state.targetState}` : null,
    state.assetState ? `asset ${state.assetState}` : null,
    state.audioState ? `audio ${state.audioState}` : null,
    state.invalidModeFallback ? 'fallback active' : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(' · ') : null;
}
