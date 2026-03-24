import { useIsFocused } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassSurface from '@/components/glass-surface';
import SceneFrame from '@/components/scene-frame';
import { useWebKeyboardControls } from '@/hooks/use-web-keyboard-controls';
import {
  buildSceneUrl,
  DEFAULT_SCENE_BASE_URL,
  getSceneOption,
  Mode,
  resolveMode,
} from '@/lib/scene-config';
import { navigateToWebAppHome, navigateWithinWebApp } from '@/lib/web-navigation';

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
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [isMuted, setIsMuted] = useState(false);
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
  const handleOpenEditor = useCallback(() => {
    if (navigateWithinWebApp('editor', { mode })) {
      return;
    }

    router.push({
      pathname: '/editor',
      params: { mode },
    });
  }, [mode, router]);
  const handleClose = useCallback(() => {
    if (navigateToWebAppHome()) {
      return;
    }

    router.back();
  }, [router]);
  const handleToggleMuted = useCallback(() => {
    setIsMuted(currentValue => !currentValue);
  }, []);

  useWebKeyboardControls([
    {
      handler: handleClose,
      keys: ['Escape'],
    },
    {
      handler: handleOpenEditor,
      keys: ['e', 'E'],
    },
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          animation: 'none',
          headerShown: false,
        }}
      />
      <View style={styles.container} testID="game-screen">
        <StatusBar hidden style="light" />
        <SceneFrame
          editorBackdropActive={!isFocused}
          interactive
          muted={isMuted}
          onFrameMessage={handleFrameMessage}
          testID="scene-game-frame"
          uri={uri}
        />

        <View pointerEvents="box-none" style={[styles.overlayActions, { top: insets.top + 12 }]}>
          <Pressable
            accessibilityLabel={isMuted ? 'unmute scene audio' : 'mute scene audio'}
            accessibilityRole="button"
            accessible
            hitSlop={8}
            onPress={handleToggleMuted}
            testID="game-mute-button">
            {({ pressed }) => (
              <GlassSurface interactive style={[styles.overlayButton, pressed && styles.overlayButtonPressed]}>
                <SymbolView
                  name={
                    isMuted
                      ? { ios: 'speaker.slash.fill', android: 'volume_off', web: 'volume_off' }
                      : { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }
                  }
                  size={18}
                  tintColor="#fff7f1"
                  weight="semibold"
                />
              </GlassSurface>
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="edit scene"
            accessibilityRole="button"
            accessible
            hitSlop={8}
            onPress={handleOpenEditor}
            testID="game-edit-button">
            {({ pressed }) => (
              <GlassSurface interactive style={[styles.overlayButton, pressed && styles.overlayButtonPressed]}>
                <SymbolView
                  name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                  size={16}
                  tintColor="#fff7f1"
                  weight="semibold"
                />
              </GlassSurface>
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="close game"
            accessibilityRole="button"
            accessible
            hitSlop={8}
            onPress={handleClose}
            testID="game-close-button">
            {({ pressed }) => (
              <GlassSurface interactive style={[styles.overlayButton, pressed && styles.overlayButtonPressed]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={17}
                  tintColor="#fff7f1"
                  weight="bold"
                />
              </GlassSurface>
            )}
          </Pressable>
        </View>

        {E2E_DEBUG_ENABLED && isFocused ? (
          <View pointerEvents="none" style={styles.debugRail}>
            <GlassSurface style={styles.debugPanel}>
              <Text
                accessibilityLabel={`scene-debug-mode-${debugTokens.mode}`}
                accessible
                style={styles.debugLabel}
                testID={`scene-debug-mode-${debugTokens.mode}`}>
                mode {debugTokens.mode}
              </Text>
              <Text
                accessibilityLabel={`scene-debug-audio-${debugTokens.audio}`}
                accessible
                style={styles.debugLabel}
                testID={`scene-debug-audio-${debugTokens.audio}`}>
                audio {debugTokens.audio}
              </Text>
              <Text
                accessibilityLabel={`scene-debug-asset-${debugTokens.asset}`}
                accessible
                style={styles.debugLabel}
                testID={`scene-debug-asset-${debugTokens.asset}`}>
                asset {debugTokens.asset}
              </Text>
              <Text
                accessibilityLabel={`scene-debug-target-${debugTokens.target}`}
                accessible
                style={styles.debugLabel}
                testID={`scene-debug-target-${debugTokens.target}`}>
                target {debugTokens.target}
              </Text>
              <Text
                accessibilityLabel={`scene-debug-action-${debugTokens.action}`}
                accessible
                style={styles.debugLabel}
                testID={`scene-debug-action-${debugTokens.action}`}>
                action {debugTokens.action}
              </Text>
              <Text
                accessibilityLabel={`scene-debug-invalid-mode-${debugTokens.invalidModeFallback}`}
                accessible
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
  overlayActions: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    right: 16,
    zIndex: 4,
  },
  overlayButton: {
    alignItems: 'center',
    borderRadius: 999,
    boxShadow: '0 18px 42px rgba(0, 0, 0, 0.28)',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  overlayButtonPressed: {
    opacity: 0.72,
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
