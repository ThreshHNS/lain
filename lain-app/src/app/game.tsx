import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import GlassSurface from '@/components/glass-surface';
import SceneFrame from '@/components/scene-frame';
import {
  buildSceneUrl,
  DEFAULT_SCENE_BASE_URL,
  getSceneOption,
  Mode,
  resolveMode,
} from '@/lib/scene-config';

type SceneBridgeState = {
  assetState?: string;
  audioState?: string;
  invalidModeFallback?: boolean;
  lastAction?: string;
  mode?: string;
  targetState?: string;
};

const E2E_DEBUG_ENABLED = process.env.EXPO_PUBLIC_E2E_DEBUG === '1';

function sanitizeDebugToken(value: unknown, fallback: string) {
  const normalized = String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function parseSceneBridgeMessage(message: string): SceneBridgeState | null {
  try {
    const payload = JSON.parse(message) as { state?: SceneBridgeState; type?: string };
    if (payload.type !== 'scene-state' || !payload.state) {
      return null;
    }
    return payload.state;
  } catch {
    return null;
  }
}

function buildDebugTokens(mode: Mode, sceneState: SceneBridgeState | null) {
  return {
    action: sanitizeDebugToken(sceneState?.lastAction, 'boot'),
    asset: sanitizeDebugToken(sceneState?.assetState, 'unknown'),
    audio: sanitizeDebugToken(sceneState?.audioState, 'idle'),
    invalidModeFallback: sceneState?.invalidModeFallback ? 'true' : 'false',
    mode: sanitizeDebugToken(sceneState?.mode ?? mode, mode),
    target: sanitizeDebugToken(sceneState?.targetState, 'unknown'),
  };
}

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const [version] = useState(() => Date.now());
  const [sceneState, setSceneState] = useState<SceneBridgeState | null>(null);
  const mode = resolveMode(Array.isArray(params.mode) ? params.mode[0] : params.mode);
  const scene = getSceneOption(mode);
  const uri = useMemo(
    () =>
      buildSceneUrl(DEFAULT_SCENE_BASE_URL, mode, version, {
        embedded: true,
      }),
    [mode, version],
  );
  const debugTokens = useMemo(() => buildDebugTokens(mode, sceneState), [mode, sceneState]);
  const handleFrameMessage = useCallback((message: string) => {
    const nextState = parseSceneBridgeMessage(message);
    if (nextState) {
      setSceneState(nextState);
    }
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: scene.label,
          headerBackVisible: false,
          headerShadowVisible: false,
          headerTransparent: true,
          headerRight: () => (
            <Pressable onPress={() => router.back()} testID="game-close-button">
              <GlassSurface interactive style={styles.closeButton}>
                <Text style={styles.closeLabel}>Close</Text>
              </GlassSurface>
            </Pressable>
          ),
        }}
      />
      <View style={styles.container} testID="game-screen">
        <StatusBar style="light" />
        <SceneFrame
          interactive
          onFrameMessage={handleFrameMessage}
          testID="scene-game-frame"
          uri={uri}
        />
        {E2E_DEBUG_ENABLED ? (
          <View pointerEvents="none" style={styles.debugRail}>
            <GlassSurface style={styles.debugPanel}>
              <Text style={styles.debugLabel} testID={`scene-debug-mode-${debugTokens.mode}`}>
                mode {debugTokens.mode}
              </Text>
              <Text style={styles.debugLabel} testID={`scene-debug-audio-${debugTokens.audio}`}>
                audio {debugTokens.audio}
              </Text>
              <Text style={styles.debugLabel} testID={`scene-debug-asset-${debugTokens.asset}`}>
                asset {debugTokens.asset}
              </Text>
              <Text
                style={styles.debugLabel}
                testID={`scene-debug-target-${debugTokens.target}`}>
                target {debugTokens.target}
              </Text>
              <Text
                style={styles.debugLabel}
                testID={`scene-debug-action-${debugTokens.action}`}>
                action {debugTokens.action}
              </Text>
              <Text
                style={styles.debugLabel}
                testID={`scene-debug-invalid-mode-${debugTokens.invalidModeFallback}`}>
                invalid {debugTokens.invalidModeFallback}
              </Text>
            </GlassSurface>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050608',
  },
  closeButton: {
    borderRadius: 999,
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeLabel: {
    color: '#fff7f1',
    fontSize: 15,
    fontWeight: '700',
  },
  debugRail: {
    bottom: 20,
    left: 16,
    position: 'absolute',
  },
  debugPanel: {
    borderRadius: 18,
    gap: 4,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  debugLabel: {
    color: 'rgba(255, 247, 241, 0.78)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
