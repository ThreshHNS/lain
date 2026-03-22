import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
        style={styles.overlay}>
        <GlassSurface style={[styles.sceneChip, active && styles.sceneChipActive]}>
          <Text style={styles.sceneChipText}>{scene.label}</Text>
        </GlassSurface>

        <View style={styles.bottomRail}>
          <GlassSurface style={styles.metaCard}>
            <Text style={styles.sceneSubtitle}>{scene.subtitle}</Text>
            <Text style={styles.sceneTitle}>{scene.label}</Text>
            <Text style={styles.sceneHint}>Swipe to switch scenes. {scene.touchHint}.</Text>
          </GlassSurface>

          <Pressable
            accessibilityLabel={`scene-play-${scene.id}`}
            accessibilityRole="button"
            accessible
            onPress={() => onPlay(scene.id)}
            testID={`scene-play-${scene.id}`}>
            {({ pressed }) => (
              <GlassSurface interactive style={[styles.playButton, pressed && styles.playButtonPressed]}>
                <SymbolView
                  name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                  size={20}
                  tintColor="#fff8f4"
                  weight="bold"
                />
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
    backgroundColor: 'rgba(3, 4, 6, 0.08)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  sceneChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sceneChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  sceneChipText: {
    color: '#fff6ef',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bottomRail: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
  },
  metaCard: {
    borderRadius: 24,
    flex: 1,
    gap: 6,
    maxWidth: 540,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sceneTitle: {
    color: '#fff7f1',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sceneSubtitle: {
    color: '#ffd5c0',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  sceneHint: {
    color: '#f4e1d7',
    fontSize: 13,
    lineHeight: 18,
  },
  playButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  playButtonPressed: {
    opacity: 0.85,
  },
});
