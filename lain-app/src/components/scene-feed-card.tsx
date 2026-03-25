import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Mode, SceneOption } from '@/lib/scene-config';

import GlassSurface from './glass-surface';
import SceneFrame from './scene-frame';

type SceneFeedCardProps = {
  active: boolean;
  height: number;
  onOpenScene: (mode: Mode) => void;
  onRetry?: () => void;
  safeAreaTop?: number;
  scene: SceneOption;
  statusTestID?: string;
  retryTestID?: string;
  tvPreferredFocus?: boolean;
  uri: string;
};

export default function SceneFeedCard({
  active,
  height,
  onOpenScene,
  onRetry,
  safeAreaTop = 18,
  scene,
  statusTestID,
  retryTestID,
  tvPreferredFocus = false,
  uri,
}: SceneFeedCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Open ${scene.label}`}
      accessibilityRole="button"
      accessible
      hasTVPreferredFocus={tvPreferredFocus}
      onPress={() => onOpenScene(scene.id)}
      style={({ pressed }) => [styles.page, { height }, pressed && styles.pagePressed]}
      testID={`scene-open-${scene.id}`}>
      <SceneFrame
        hideSceneChrome={Platform.OS !== 'web'}
        interactive={false}
        onRetry={onRetry}
        retryTestID={retryTestID}
        statusTestID={statusTestID}
        testID={`scene-preview-${scene.id}`}
        uri={uri}
      />

      <View pointerEvents="none" style={styles.scrim} />

      <View pointerEvents="none" style={[styles.overlay, { paddingTop: safeAreaTop }]}>
        <GlassSurface style={[styles.sceneChip, active && styles.sceneChipActive]}>
          <Text style={styles.sceneChipText}>{scene.label}</Text>
        </GlassSurface>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#050608',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  pagePressed: {
    opacity: 0.92,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 4, 6, 0.08)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
});
