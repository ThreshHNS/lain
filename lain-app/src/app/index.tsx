import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassSurface from '@/components/glass-surface';
import SceneFeedCard from '@/components/scene-feed-card';
import {
  buildSceneUrl,
  DEFAULT_SCENE_BASE_URL,
  MODE_OPTIONS,
  Mode,
} from '@/lib/scene-config';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [version] = useState(() => Date.now());

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
            scene={item}
            uri={item.previewUri}
          />
        )}
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
