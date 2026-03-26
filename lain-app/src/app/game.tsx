import { useIsFocused } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassSurface from '@/components/glass-surface';
import SceneFrame from '@/components/scene-frame';
import SceneOpeningIntro from '@/components/scene-opening-intro';
import { useSceneRuntime } from '@/context/scene-runtime-context';
import { useWebKeyboardControls } from '@/hooks/use-web-keyboard-controls';
import {
  buildSceneUrl,
  DEFAULT_SCENE_BASE_URL,
  getSceneOption,
  Mode,
  resolveMode,
} from '@/lib/scene-config';
import { parseSceneBridgeMessage, type SceneBridgeState } from '@/lib/runtime/scene-bridge';
import { navigateToWebAppHome, navigateWithinWebApp } from '@/lib/web-navigation';

const E2E_DEBUG_ENABLED = process.env.EXPO_PUBLIC_E2E_DEBUG === '1';
const SCENE_REVEAL_DURATION = 1120;

function sanitizeDebugToken(value: unknown, fallback: string) {
  const normalized = String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
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
  const [isEditorTransitionActive, setIsEditorTransitionActive] = useState(false);
  const [version] = useState(() => Date.now());
  const [sceneState, setSceneState] = useState<SceneBridgeState | null>(null);
  const sceneReveal = useRef(new Animated.Value(0)).current;
  const mode = resolveMode(Array.isArray(params.mode) ? params.mode[0] : params.mode);
  const { upsertSceneRuntime } = useSceneRuntime(mode);
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
      upsertSceneRuntime(mode, {
        frameStatus: 'ready',
        lastState: nextState,
        lastUpdatedAt: new Date().toISOString(),
      });
    }
  }, [mode, upsertSceneRuntime]);
  useEffect(() => {
    upsertSceneRuntime(mode, {
      frameStatus: 'loading',
      lastUpdatedAt: new Date().toISOString(),
    });
  }, [mode, upsertSceneRuntime]);
  useEffect(() => {
    if (isFocused) {
      setIsEditorTransitionActive(false);
    }
  }, [isFocused]);
  useEffect(() => {
    sceneReveal.stopAnimation();
    sceneReveal.setValue(0);

    const animation = Animated.timing(sceneReveal, {
      duration: SCENE_REVEAL_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [scene.id, sceneReveal]);
  const handleOpenEditor = useCallback(() => {
    setIsEditorTransitionActive(true);

    if (navigateWithinWebApp('editor', { mode })) {
      return;
    }

    router.push({
      pathname: '/editor',
      params: {
        mode,
        overlayScene: '1',
      },
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

  const sceneStageAnimatedStyle = {
    opacity: sceneReveal.interpolate({
      inputRange: [0, 0.28, 1],
      outputRange: [0.24, 0.78, 1],
    }),
    transform: [
      {
        scale: sceneReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [1.045, 1],
        }),
      },
      {
        translateY: sceneReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [22, 0],
        }),
      },
    ],
  };

  const sceneRevealMaskAnimatedStyle = {
    opacity: sceneReveal.interpolate({
      inputRange: [0, 0.68, 1],
      outputRange: [0.46, 0.22, 0],
    }),
  };
  const showOverlayActions = isFocused && !isEditorTransitionActive;

  return (
    <>
      <Stack.Screen
        options={{
          animation: 'none',
          headerShown: false,
        }}
      />
      <View collapsable={false} style={styles.container} testID="game-screen">
        <StatusBar hidden style="light" />
        <Animated.View style={[styles.sceneStage, sceneStageAnimatedStyle]} testID="game-scene-stage">
          <SceneFrame
            editorBackdropActive={!isFocused || isEditorTransitionActive}
            hideSceneChrome={Platform.OS !== 'web'}
            interactive
            muted={isMuted}
            onFrameError={() => {
              upsertSceneRuntime(mode, {
                frameStatus: 'error',
                lastUpdatedAt: new Date().toISOString(),
              });
            }}
            onFrameLoadEnd={() => {
              upsertSceneRuntime(mode, {
                frameStatus: 'ready',
                lastUpdatedAt: new Date().toISOString(),
              });
            }}
            onFrameLoadStart={() => {
              upsertSceneRuntime(mode, {
                frameStatus: 'loading',
                lastUpdatedAt: new Date().toISOString(),
              });
            }}
            onFrameMessage={handleFrameMessage}
            testID="scene-game-frame"
            uri={uri}
          />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sceneRevealMask,
            { backgroundColor: scene.intro.ambient },
            sceneRevealMaskAnimatedStyle,
          ]}
          testID="game-scene-reveal-mask"
        />
        {!isEditorTransitionActive ? (
          <SceneOpeningIntro bottomInset={insets.bottom} scene={scene} topInset={insets.top} />
        ) : null}

        {showOverlayActions ? (
          <View
            collapsable={false}
            pointerEvents="box-none"
            style={[styles.overlayActions, { top: insets.top + 12 }]}>
            <Pressable
              accessibilityLabel={isMuted ? 'unmute scene audio' : 'mute scene audio'}
              accessibilityRole="button"
              accessible
              collapsable={false}
              hitSlop={8}
              importantForAccessibility="yes"
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
              collapsable={false}
              hitSlop={8}
              importantForAccessibility="yes"
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
              collapsable={false}
              hitSlop={8}
              importantForAccessibility="yes"
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
        ) : null}

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
  sceneStage: {
    flex: 1,
  },
  sceneRevealMask: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
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
    backgroundColor: 'rgba(8, 10, 14, 0.26)',
    borderColor: 'rgba(255, 247, 241, 0.16)',
    borderWidth: 1,
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
