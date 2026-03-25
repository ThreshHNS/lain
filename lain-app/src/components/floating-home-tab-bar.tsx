import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHomeFeedMode } from '@/context/home-feed-context';

import GlassSurface from './glass-surface';

export const FLOATING_HOME_TAB_BAR_HEIGHT = 74;
export const FLOATING_HOME_TAB_BAR_OFFSET = 16;

export default function FloatingHomeTabBar({ navigation, state }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activeMode } = useHomeFeedMode();
  const homeRoute = state.routes[0];
  const railWidth = Math.min(Math.max(width - 132, 264), 332);
  const actionButtons = [
    {
      accessibilityLabel: 'Open active scene',
      icon: { ios: 'shippingbox', android: 'inbox', web: 'inbox' } as const,
      onPress: () =>
        router.push({
          pathname: '/game',
          params: { mode: activeMode },
        }),
      testID: 'active-scene-tab-button',
    },
    {
      accessibilityLabel: 'Open prompt history',
      icon: { ios: 'bell', android: 'notifications', web: 'notifications' } as const,
      onPress: () =>
        router.push({
          pathname: '/prompt-history',
          params: { mode: activeMode },
        }),
      testID: 'prompt-history-tab-button',
    },
    {
      accessibilityLabel: 'Open scene editor',
      icon: { ios: 'square.stack.3d.up', android: 'layers', web: 'layers' } as const,
      onPress: () =>
        router.push({
          pathname: '/editor',
          params: { mode: activeMode },
        }),
      testID: 'scene-editor-tab-button',
    },
  ];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.shell, { paddingBottom: insets.bottom + FLOATING_HOME_TAB_BAR_OFFSET }]}>
      <View style={styles.row}>
        <GlassSurface style={[styles.rail, { width: railWidth }]}>
          <Pressable
            accessibilityLabel="Open home feed"
            accessibilityRole="tab"
            accessibilityState={{ selected: true }}
            accessible
            hitSlop={8}
            onPress={() => {
              navigation.emit({
                canPreventDefault: true,
                target: homeRoute.key,
                type: 'tabPress',
              });
              navigation.navigate(homeRoute.name);
            }}
            style={({ pressed }) => [styles.tabButton, styles.tabButtonActive, pressed && styles.buttonPressed]}
            testID="home-tab-button">
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              size={24}
              tintColor="#fff7f1"
              weight="semibold"
            />
          </Pressable>

          {actionButtons.map(button => (
            <Pressable
              key={button.testID}
              accessibilityLabel={button.accessibilityLabel}
              accessibilityRole="button"
              accessible
              hitSlop={8}
              onPress={button.onPress}
              style={({ pressed }) => [styles.tabButton, pressed && styles.buttonPressed]}
              testID={button.testID}>
              <SymbolView
                name={button.icon}
                size={22}
                tintColor="rgba(255, 247, 241, 0.78)"
                weight="medium"
              />
            </Pressable>
          ))}
        </GlassSurface>

        <Pressable
          accessibilityLabel="Open scene lab"
          accessibilityRole="button"
          accessible
          hitSlop={10}
          onPress={() => router.push('/new-scene')}
          testID="new-scene-tab-button">
          {({ pressed }) => (
            <GlassSurface interactive style={[styles.fab, pressed && styles.buttonPressed]}>
              <SymbolView
                name={{ ios: 'plus', android: 'add', web: 'add' }}
                size={30}
                tintColor="#fff7f1"
                weight="bold"
              />
            </GlassSurface>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    bottom: 0,
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  rail: {
    alignItems: 'center',
    borderRadius: 999,
    boxShadow: '0 24px 50px rgba(0, 0, 0, 0.38)',
    flexDirection: 'row',
    gap: 6,
    height: FLOATING_HOME_TAB_BAR_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 999,
    boxShadow: '0 24px 50px rgba(0, 0, 0, 0.4)',
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  buttonPressed: {
    opacity: 0.82,
  },
});
