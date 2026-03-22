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
} from '@/lib/scene-config';
import AppHeader from '@/components/app-header';
import AssetPicker from '@/components/asset-picker';
import HistoryPanel from '@/components/history-panel';
import type { HistoryEntry, SlotHint } from '@/types/editor';
import AppHeader from '@/components/app-header';

const E2E_DEBUG_ENABLED = process.env.EXPO_PUBLIC_E2E_DEBUG === '1';

const HISTORY_ENTRIES: HistoryEntry[] = [
  {
    id: 'history-1',
    actor: { id: 'u1', name: 'Lain', isOnline: true },
    timestamp: new Date().toISOString(),
    label: 'Voice prompt calibrated for walk slot',
    slot: 'walk',
    type: 'voice',
  },
  {
    id: 'history-2',
    actor: { id: 'u3', name: 'Codex', isOnline: true },
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    label: 'Added PolyPizza corridor asset',
    type: 'asset',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const listRef = useRef<FlatList<(typeof MODE_OPTIONS)[number]>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [version, setVersion] = useState(() => Date.now());

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

  const handleVoiceCaptured = useCallback((uri: string, slot?: SlotHint) => {
    console.log('voice captured', { uri, slot });
  }, []);

  return (
    <View style={styles.container} testID="scene-feed-screen">
      <StatusBar style="light" />
      <AppHeader sceneTitle="Scene selector" onVoiceCaptured={handleVoiceCaptured} />
      <HistoryPanel entries={HISTORY_ENTRIES} />
      <AssetPicker />

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
});
