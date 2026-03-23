import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
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
  SceneOption,
} from '@/lib/scene-config';
import { navigateWithinWebApp } from '@/lib/web-navigation';

const E2E_DEBUG_ENABLED = process.env.EXPO_PUBLIC_E2E_DEBUG === '1';
type ScenePreview = SceneOption & { previewUri: string };

function HomeScreenContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const listRef = useRef<FlatList<ScenePreview>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [version, setVersion] = useState(() => Date.now());
  const stageHeight = Math.min(
    Math.max(height - insets.top - insets.bottom - 24, 520),
    width >= 960 ? 920 : 840,
  );
  const contentWidth = Math.min(width - 24, 980);

  const handleRetry = useCallback(() => {
    setVersion(Date.now());
  }, []);

  const scenes = useMemo(
    () =>
      MODE_OPTIONS.map(scene => ({
        ...scene,
        previewUri: buildSceneUrl(DEFAULT_SCENE_BASE_URL, scene.id, version, {
          embedded: true,
          variant: 'preview',
        }),
      })),
    [version],
  );

  const handlePlay = useCallback(
    (mode: Mode) => {
      if (navigateWithinWebApp('game', { mode })) {
        return;
      }

      router.push({
        pathname: '/game',
        params: { mode },
      });
    },
    [router],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.y / Math.max(stageHeight, 1));
      setActiveIndex(Math.max(0, Math.min(nextIndex, scenes.length - 1)));
    },
    [scenes.length, stageHeight],
  );

  return (
    <View style={styles.container} testID="scene-feed-screen">
      <StatusBar style="light" />
      <View
        style={[
          styles.screen,
          {
            paddingBottom: insets.bottom + 12,
            paddingTop: insets.top + 12,
          },
        ]}>
        <View style={styles.stageSection}>
          <View style={[styles.stageShell, { height: stageHeight, maxWidth: contentWidth }]}>
            <FlatList
              bounces={false}
              contentInsetAdjustmentBehavior="never"
              data={scenes}
              decelerationRate="fast"
              keyExtractor={item => item.id}
              onMomentumScrollEnd={handleMomentumEnd}
              pagingEnabled
              renderItem={({ item, index }) => (
                <SceneFeedCard
                  active={index === activeIndex}
                  height={stageHeight}
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

            <View pointerEvents="none" style={styles.pager} testID="scene-feed-pager">
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
          </View>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  return <HomeScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050608',
  },
  screen: {
    flex: 1,
    gap: 16,
  },
  stageSection: {
    alignItems: 'center',
    flex: 1,
  },
  stageShell: {
    overflow: 'hidden',
    width: '100%',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#090b0e',
  },
  pager: {
    bottom: 16,
    position: 'absolute',
    right: 16,
    top: 16,
    justifyContent: 'center',
  },
  pagerSurface: {
    borderRadius: 999,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  pagerDot: {
    width: 6,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  pagerDotActive: {
    backgroundColor: '#fff6ef',
  },
});
