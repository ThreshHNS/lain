import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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

import GlassSurface from '@/components/glass-surface';
import SceneFeedCard from '@/components/scene-feed-card';
import {
  buildSceneUrl,
  DEFAULT_SCENE_BASE_URL,
  MODE_OPTIONS,
  Mode,
} from '@/lib/scene-config';

const E2E_DEBUG_ENABLED = process.env.EXPO_PUBLIC_E2E_DEBUG === '1';
const TV_FEED_CONTROLS_ENABLED = E2E_DEBUG_ENABLED || Platform.isTV;
const BROKEN_SCENE_BASE_URL = 'https://example.invalid/lain/';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const listRef = useRef<FlatList<(typeof MODE_OPTIONS)[number]>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [version, setVersion] = useState(() => Date.now());
  const [brokenSceneMode, setBrokenSceneMode] = useState<Mode | null>(null);

  const activeScene = MODE_OPTIONS[activeIndex] ?? MODE_OPTIONS[0];

  const scrollToScene = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, MODE_OPTIONS.length - 1));
      setActiveIndex(nextIndex);
      listRef.current?.scrollToOffset({
        animated: true,
        offset: nextIndex * Math.max(height, 1),
      });
    },
    [height],
  );

  const handleReload = useCallback(() => {
    setBrokenSceneMode(null);
    setVersion(Date.now());
  }, []);

  const handleRetry = useCallback(() => {
    setBrokenSceneMode(null);
    setVersion(Date.now());
  }, []);

  const handleBreakActiveScene = useCallback(() => {
    setBrokenSceneMode(activeScene.id);
    setVersion(Date.now());
  }, [activeScene.id]);

  const scenes = useMemo(
    () =>
      MODE_OPTIONS.map(scene => ({
        ...scene,
        previewUri: buildSceneUrl(
          brokenSceneMode === scene.id ? BROKEN_SCENE_BASE_URL : DEFAULT_SCENE_BASE_URL,
          scene.id,
          version,
          {
          embedded: true,
          variant: 'preview',
          },
        ),
      })),
    [brokenSceneMode, version],
  );

  const handlePlay = useCallback(
    (mode: Mode) => {
      router.push({
        pathname: '/game',
        params: { mode },
      });
    },
    [router],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.y / Math.max(height, 1));
      setActiveIndex(Math.max(0, Math.min(nextIndex, scenes.length - 1)));
    },
    [height, scenes.length],
  );

  return (
    <View style={styles.container} testID="scene-feed-screen">
      <StatusBar style="light" />

      <FlatList
        contentInsetAdjustmentBehavior="never"
        data={scenes}
        decelerationRate="fast"
        keyExtractor={item => item.id}
        onMomentumScrollEnd={handleMomentumEnd}
        pagingEnabled
        renderItem={({ item, index }) => (
          <SceneFeedCard
            active={index === activeIndex}
            height={height}
            onPlay={handlePlay}
            onRetry={index === activeIndex ? handleRetry : undefined}
            retryTestID={
              E2E_DEBUG_ENABLED && index === activeIndex
                ? `scene-preview-${item.id}-retry-button`
                : undefined
            }
            scene={item}
            statusTestID={
              E2E_DEBUG_ENABLED && index === activeIndex
                ? `scene-preview-${item.id}-status`
                : undefined
            }
            uri={item.previewUri}
          />
        )}
        ref={listRef}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        testID="scene-feed-list"
        windowSize={3}
      />

      <View
        pointerEvents="none"
        style={[styles.pager, { paddingTop: insets.top + 16 }]}
        testID="scene-feed-pager">
        <GlassSurface style={styles.pagerSurface}>
          {scenes.map((scene, index) => (
            <View
              key={scene.id}
              style={[styles.pagerDot, index === activeIndex && styles.pagerDotActive]}
              testID={`scene-feed-dot-${scene.id}`}
            />
          ))}
        </GlassSurface>
      </View>

      {TV_FEED_CONTROLS_ENABLED ? (
        <View
          pointerEvents="box-none"
          style={[styles.controlRail, { bottom: insets.bottom + 18 }]}
          testID="scene-feed-controls">
          <GlassSurface style={styles.controlPanel}>
            <Text style={styles.controlLabel} testID={`scene-active-mode-${activeScene.id}`}>
              active {activeScene.id}
            </Text>

            <View style={styles.controlRow}>
              <Pressable
                accessibilityRole="button"
                focusable
                onPress={() => scrollToScene(activeIndex - 1)}
                testID="scene-tv-prev-button">
                {({ pressed }) => (
                  <GlassSurface interactive style={[styles.controlButton, pressed && styles.controlButtonPressed]}>
                    <Text style={styles.controlButtonText}>Prev</Text>
                  </GlassSurface>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                focusable
                hasTVPreferredFocus
                onPress={() => handlePlay(activeScene.id)}
                testID="scene-tv-play-button">
                {({ pressed }) => (
                  <GlassSurface interactive style={[styles.controlButton, pressed && styles.controlButtonPressed]}>
                    <Text style={styles.controlButtonText}>Play</Text>
                  </GlassSurface>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                focusable
                onPress={() => scrollToScene(activeIndex + 1)}
                testID="scene-tv-next-button">
                {({ pressed }) => (
                  <GlassSurface interactive style={[styles.controlButton, pressed && styles.controlButtonPressed]}>
                    <Text style={styles.controlButtonText}>Next</Text>
                  </GlassSurface>
                )}
              </Pressable>
            </View>

            {E2E_DEBUG_ENABLED ? (
              <View style={styles.controlRow}>
                <Text style={styles.controlMeta} testID="scene-version-label">
                  {String(version)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  focusable
                  onPress={handleReload}
                  testID="scene-reload-button">
                  {({ pressed }) => (
                    <GlassSurface interactive style={[styles.controlButton, pressed && styles.controlButtonPressed]}>
                      <Text style={styles.controlButtonText}>Reload</Text>
                    </GlassSurface>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  focusable
                  onPress={handleBreakActiveScene}
                  testID="scene-break-button">
                  {({ pressed }) => (
                    <GlassSurface interactive style={[styles.controlButton, pressed && styles.controlButtonPressed]}>
                      <Text style={styles.controlButtonText}>Break</Text>
                    </GlassSurface>
                  )}
                </Pressable>
              </View>
            ) : null}
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050608',
  },
  pager: {
    position: 'absolute',
    right: 16,
  },
  pagerSurface: {
    borderRadius: 999,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  pagerDot: {
    width: 6,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  pagerDotActive: {
    backgroundColor: '#fff6ef',
  },
  controlRail: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
  controlPanel: {
    alignItems: 'flex-start',
    borderRadius: 28,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  controlLabel: {
    color: '#fff7f1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  controlMeta: {
    color: '#f3d7ca',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 96,
    paddingVertical: 12,
  },
  controlButton: {
    borderRadius: 999,
    minWidth: 88,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlButtonPressed: {
    opacity: 0.84,
  },
  controlButtonText: {
    color: '#fff8f4',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
