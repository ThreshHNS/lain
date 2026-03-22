import type { ReactNode } from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type GlassSurfaceProps = {
  children: ReactNode;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function GlassSurface({
  children,
  interactive = false,
  style,
}: GlassSurfaceProps) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView isInteractive={interactive} style={[styles.base, style]}>
        {children}
      </GlassView>
    );
  }

  return <View style={[styles.base, styles.fallback, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  fallback: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(14, 16, 19, 0.78)',
  },
});
