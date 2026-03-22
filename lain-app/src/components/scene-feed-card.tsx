import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Mode, SceneOption } from '@/lib/scene-config';

import GlassSurface from './glass-surface';
import SceneFrame from './scene-frame';

type SceneFeedCardProps = {
  active: boolean;
  height: number;
  onPlay: (mode: Mode) => void;
  onRetry?: () => void;
  scene: SceneOption;
  statusTestID?: string;
  retryTestID?: string;
  uri: string;
};

export default function SceneFeedCard({
  active,
  height,
  onPlay,
  onRetry,
  scene,
  statusTestID,
  retryTestID,
  uri,
}: SceneFeedCardProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.page, { height }]} testID={`scene-card-${scene.id}`}>
      <SceneFrame
        interactive={false}
        onRetry={onRetry}
        retryTestID={retryTestID}
        statusTestID={statusTestID}
        testID={`scene-preview-${scene.id}`}
        uri={uri}
      />

      <View pointerEvents="none" style={styles.scrim} />

      <View
        pointerEvents="box-none"
        style={[
          styles.overlay,
          {
            paddingBottom: insets.bottom + 24,
            paddingTop: insets.top + 22,
          },
        ]}>
        <GlassSurface style={[styles.sceneChip, active && styles.sceneChipActive]}>
          <Text style={styles.sceneChipText}>{scene.label}</Text>
        </GlassSurface>

        <View style={styles.bottomRail}>
          <GlassSurface style={styles.metaCard}>
            <Text style={styles.sceneTitle}>{scene.label}</Text>
            <Text style={styles.sceneSubtitle}>{scene.subtitle}</Text>
            <Text style={styles.sceneHint}>Swipe to switch scenes. {scene.touchHint}.</Text>
          </GlassSurface>

          <Pressable onPress={() => onPlay(scene.id)} testID={`scene-play-${scene.id}`}>
            {({ pressed }) => (
              <GlassSurface interactive style={[styles.playButton, pressed && styles.playButtonPressed]}>
                <Text style={styles.playLabel}>Play</Text>
              </GlassSurface>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#050608',
    position: 'relative',
    width: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 4, 6, 0.14)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  sceneChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sceneChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  sceneChipText: {
    color: '#fff6ef',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  bottomRail: {
    gap: 14,
  },
  metaCard: {
    borderRadius: 28,
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  sceneTitle: {
    color: '#fff7f1',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  sceneSubtitle: {
    color: '#ffd5c0',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sceneHint: {
    color: '#f4e1d7',
    fontSize: 15,
    lineHeight: 21,
  },
  playButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    minWidth: 136,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  playButtonPressed: {
    opacity: 0.85,
  },
  playLabel: {
    color: '#fff8f4',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
