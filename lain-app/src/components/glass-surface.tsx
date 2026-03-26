import type { ReactNode } from 'react';
import { GlassView, isLiquidGlassAvailable, type GlassViewProps } from 'expo-glass-effect';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type GlassSurfaceProps = {
  children?: ReactNode;
  colorScheme?: GlassViewProps['colorScheme'];
  glassEffectStyle?: GlassViewProps['glassEffectStyle'];
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  tintColor?: GlassViewProps['tintColor'];
};

export default function GlassSurface({
  children,
  colorScheme,
  glassEffectStyle,
  interactive = false,
  style,
  tintColor,
}: GlassSurfaceProps) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        colorScheme={colorScheme}
        glassEffectStyle={glassEffectStyle}
        isInteractive={interactive}
        style={[styles.base, style]}
        tintColor={tintColor}>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.base, styles.fallback, tintColor ? { backgroundColor: tintColor } : null, style]}>
      {children}
    </View>
  );
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
