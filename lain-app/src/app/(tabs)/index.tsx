import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FLOATING_HOME_TAB_BAR_HEIGHT,
  FLOATING_HOME_TAB_BAR_OFFSET,
} from '@/components/floating-home-tab-bar';
import GlassSurface from '@/components/glass-surface';
import SceneFeedCard from '@/components/scene-feed-card';
import { useHomeFeedMode } from '@/context/home-feed-context';
import { useWebKeyboardControls } from '@/hooks/use-web-keyboard-controls';
import {
  buildSceneUrl,
  DEFAULT_SCENE_BASE_URL,
  MODE_OPTIONS,
  Mode,
  SceneOption,
} from '@/lib/scene-config';

type ScenePreview = SceneOption & { previewUri: string };
const FEATURED_HOME_SCENE_ORDER: Mode[] = ['tomato-grid', 'tomato-guard', 'slasher', 'awp'];
const FEATURED_HOME_SCENE_IDS = new Set<Mode>(FEATURED_HOME_SCENE_ORDER);

function isE2EDebugEnabled() {
  return process.env.EXPO_PUBLIC_E2E_DEBUG === '1';
}

function buildBrokenPreviewUrl(mode: Mode, version: number) {
  const url = new URL('https://example.invalid/');
  url.searchParams.set('mode', mode);
  url.searchParams.set('preview', '1');
  url.searchParams.set('v', String(version));
  return url.toString();
}

function orderScenesForHomeFeed() {
  const scenesById = new Map(MODE_OPTIONS.map(scene => [scene.id, scene] as const));

  return [
    ...FEATURED_HOME_SCENE_ORDER.flatMap(mode => {
      const scene = scenesById.get(mode);
      return scene ? [scene] : [];
    }),
    ...MODE_OPTIONS.filter(scene => !FEATURED_HOME_SCENE_IDS.has(scene.id)),
  ];
}

function HomeScreenContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { setActiveMode } = useHomeFeedMode();
  const listRef = useRef<FlatList<ScenePreview>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [version, setVersion] = useState(() => Date.now());
  const [brokenMode, setBrokenMode] = useState<Mode | null>(null);
  const pageHeight = Math.max(height, 1);
  const isTvDevice = Platform.isTV;
  const e2eDebugEnabled = isE2EDebugEnabled();
  const topSafeOffset = insets.top + 18;
  const pagerBottomInset = insets.bottom + FLOATING_HOME_TAB_BAR_HEIGHT + FLOATING_HOME_TAB_BAR_OFFSET + 26;

  const handleRetry = useCallback(() => {
    setBrokenMode(null);
    setVersion(Date.now());
  }, []);

  const scenes = useMemo(
    () =>
      orderScenesForHomeFeed().map(scene => ({
        ...scene,
        previewUri:
          brokenMode === scene.id
            ? buildBrokenPreviewUrl(scene.id, version)
            : buildSceneUrl(DEFAULT_SCENE_BASE_URL, scene.id, version, {
                embedded: true,
                variant: 'preview',
              }),
      })),
    [brokenMode, version],
  );
  const activeScene = scenes[activeIndex] ?? scenes[0];

  useEffect(() => {
    setActiveMode(activeScene.id);
  }, [activeScene.id, setActiveMode]);

  const handleOpenScene = useCallback(
    (mode: Mode) => {
      router.push({
        pathname: '/game',
        params: { mode },
      });
    },
    [router],
  );

  const handleBreakPreview = useCallback(() => {
    setBrokenMode(activeScene.id);
  }, [activeScene.id]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextPageHeight = Math.max(event.nativeEvent.layoutMeasurement.height, 1);
      const nextIndex = Math.round(event.nativeEvent.contentOffset.y / nextPageHeight);
      setActiveIndex(Math.max(0, Math.min(nextIndex, scenes.length - 1)));
    },
    [scenes.length],
  );

  const scrollToScene = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, scenes.length - 1));
      setActiveIndex(nextIndex);
      listRef.current?.scrollToOffset({
        animated: true,
        offset: nextIndex * pageHeight,
      });
    },
    [pageHeight, scenes.length],
  );

  useWebKeyboardControls([
    {
      handler: () => scrollToScene(activeIndex - 1),
      keys: ['ArrowLeft', 'ArrowUp'],
    },
    {
      handler: () => scrollToScene(activeIndex + 1),
      keys: ['ArrowDown', 'ArrowRight'],
    },
    {
      handler: () => handleOpenScene(activeScene.id),
      keys: [' ', 'Enter'],
    },
  ]);

  return (
    <View style={styles.container} testID="scene-feed-screen">
      <StatusBar style="light" />

      <FlatList
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        data={scenes}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          index,
          length: pageHeight,
          offset: pageHeight * index,
        })}
        keyExtractor={item => item.id}
        onMomentumScrollEnd={handleMomentumEnd}
        pagingEnabled
        ref={listRef}
        renderItem={({ item, index }) => (
          <SceneFeedCard
            active={index === activeIndex}
            height={pageHeight}
            onOpenScene={handleOpenScene}
            onRetry={index === activeIndex ? handleRetry : undefined}
            retryTestID={
              e2eDebugEnabled && index === activeIndex
                ? `scene-preview-${item.id}-retry-button`
                : undefined
            }
            safeAreaTop={topSafeOffset}
            scene={item}
            statusTestID={
              e2eDebugEnabled && index === activeIndex
                ? `scene-preview-${item.id}-status`
                : undefined
            }
            tvPreferredFocus={isTvDevice && index === activeIndex}
            uri={item.previewUri}
          />
        )}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        style={styles.list}
        testID="scene-feed-list"
        windowSize={3}
      />

      {e2eDebugEnabled ? (
        <View style={[styles.debugRail, { top: topSafeOffset }]} pointerEvents="box-none">
          <GlassSurface style={styles.debugPanel}>
            <Text style={styles.debugVersionLabel} testID="scene-version-label">
              v {version}
            </Text>

            <Pressable
              accessibilityLabel="reload scene preview"
              accessibilityRole="button"
              accessible
              onPress={handleRetry}
              testID="scene-reload-button">
              {({ pressed }) => (
                <GlassSurface interactive style={[styles.debugButton, pressed && styles.buttonPressed]}>
                  <Text style={styles.debugButtonText}>Reload</Text>
                </GlassSurface>
              )}
            </Pressable>

            <Pressable
              accessibilityLabel="break scene preview"
              accessibilityRole="button"
              accessible
              onPress={handleBreakPreview}
              testID="scene-break-button">
              {({ pressed }) => (
                <GlassSurface interactive style={[styles.debugButton, pressed && styles.buttonPressed]}>
                  <Text style={styles.debugButtonText}>Break</Text>
                </GlassSurface>
              )}
            </Pressable>
          </GlassSurface>
        </View>
      ) : null}

      <View
        style={[styles.pager, { bottom: pagerBottomInset, top: topSafeOffset }]}
        testID="scene-feed-pager">
        <GlassSurface style={styles.pagerSurface}>
          {scenes.map((scene, index) => (
            <Pressable
              key={scene.id}
              accessibilityLabel={`Jump to ${scene.label}`}
              accessibilityRole="button"
              accessible
              onPress={() => scrollToScene(index)}
              testID={`scene-feed-dot-${scene.id}`}>
              {({ pressed }) => (
                <View
                  style={[
                    styles.pagerDot,
                    index === activeIndex && styles.pagerDotActive,
                    pressed && styles.pagerDotPressed,
                  ]}
                />
              )}
            </Pressable>
          ))}
        </GlassSurface>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  return <HomeScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#050608',
    flex: 1,
  },
  list: {
    flex: 1,
  },
  debugRail: {
    left: 16,
    position: 'absolute',
    zIndex: 3,
  },
  debugPanel: {
    borderRadius: 20,
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  debugButton: {
    borderRadius: 999,
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  debugButtonText: {
    color: '#fff7f1',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  debugVersionLabel: {
    color: '#fff3ea',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    minWidth: 52,
    paddingHorizontal: 4,
    paddingVertical: 10,
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  pager: {
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
  },
  pagerSurface: {
    borderRadius: 999,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  pagerDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 999,
    height: 34,
    width: 8,
  },
  pagerDotActive: {
    backgroundColor: '#fff6ef',
    height: 44,
  },
  pagerDotPressed: {
    opacity: 0.72,
  },
});
