import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { SceneOption } from '@/lib/scene-config';

import GlassSurface from './glass-surface';

const INTRO_IN_DURATION = 320;
const INTRO_HOLD_DURATION = 1800;
const INTRO_OUT_DURATION = 540;

type SceneOpeningIntroProps = {
  bottomInset?: number;
  scene: SceneOption;
  topInset?: number;
};

export default function SceneOpeningIntro({
  bottomInset = 0,
  scene,
}: SceneOpeningIntroProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    progress.stopAnimation();
    progress.setValue(0);

    const animation = Animated.sequence([
      Animated.timing(progress, {
        duration: INTRO_IN_DURATION,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(INTRO_HOLD_DURATION),
      Animated.timing(progress, {
        duration: INTRO_OUT_DURATION,
        easing: Easing.inOut(Easing.cubic),
        toValue: 2,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        setVisible(false);
      }
    });

    return () => {
      animation.stop();
    };
  }, [progress, scene.id]);

  if (!visible) {
    return null;
  }

  const trackCardAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.12, 1, 2],
      outputRange: [0, 0.88, 1, 0],
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [24, 0, -18],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [0.94, 1, 1.04],
        }),
      },
    ],
  };

  const coverGlowAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.3, 1, 2],
      outputRange: [0, 0.28, 0.5, 0],
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [0.82, 1, 1.12],
        }),
      },
    ],
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="scene-opening-intro">
      <Animated.View
        style={[styles.trackDock, { bottom: bottomInset + 28, top: undefined }, trackCardAnimatedStyle]}
        testID="scene-opening-track-card">
        <GlassSurface style={styles.trackCard}>
          <View style={[styles.cover, { backgroundColor: scene.intro.coverBase }]}>
            <Animated.View
              style={[
                styles.coverGlowLarge,
                coverGlowAnimatedStyle,
                { backgroundColor: scene.intro.coverGlow },
              ]}
            />
            <View style={[styles.coverGlowSmall, { backgroundColor: scene.intro.accent }]} />
            <Text selectable style={[styles.coverTag, { color: scene.intro.coverInk }]}>
              {scene.intro.coverTag}
            </Text>
            <Text selectable style={[styles.coverCaption, { color: scene.intro.coverInk }]}>
              {scene.intro.coverTag}
            </Text>
          </View>

          <View style={styles.trackCopy}>
            <View style={styles.trackHeaderRow}>
              <Text selectable style={styles.kickerLabel}>
                Track preview
              </Text>
              <View style={styles.sceneBadge}>
                <View style={[styles.sceneAccentDot, { backgroundColor: scene.intro.accent }]} />
                <Text selectable style={styles.sceneBadgeText}>
                  {scene.label}
                </Text>
              </View>
            </View>
            <Text minimumFontScale={0.84} numberOfLines={1} selectable style={styles.trackTitle}>
              {scene.intro.title}
            </Text>
            <Text minimumFontScale={0.88} numberOfLines={1} selectable style={styles.trackMeta}>
              {scene.intro.artist} · {scene.touchHint}
            </Text>
          </View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackDock: {
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 3,
  },
  trackCard: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 12,
    maxWidth: 360,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: '100%',
  },
  cover: {
    alignItems: 'flex-start',
    borderRadius: 16,
    height: 56,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: 56,
  },
  coverGlowLarge: {
    borderRadius: 999,
    height: 44,
    position: 'absolute',
    right: -8,
    top: -8,
    width: 44,
  },
  coverGlowSmall: {
    borderRadius: 999,
    height: 24,
    left: -4,
    opacity: 0.3,
    position: 'absolute',
    top: 34,
    width: 24,
  },
  coverTag: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  coverCaption: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  trackCopy: {
    flex: 1,
    gap: 2,
  },
  trackHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  kickerLabel: {
    color: 'rgba(255,247,241,0.64)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  sceneBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,247,241,0.08)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sceneBadgeText: {
    color: '#f7ede6',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  trackTitle: {
    color: '#fff8f3',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  trackMeta: {
    color: 'rgba(255,247,241,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
  sceneAccentDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
});
