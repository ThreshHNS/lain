import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '@/components/app-header';
import AssetPicker from '@/components/asset-picker';
import ExportBundleButton from '@/components/export-bundle-button';
import GlassSurface from '@/components/glass-surface';
import HistoryPanel from '@/components/history-panel';
import SceneFrame from '@/components/scene-frame';
import { SceneEditorProvider, useSceneEditor } from '@/context/scene-editor-context';
import {
  buildSceneUrl,
  DEFAULT_SCENE_BASE_URL,
  getSceneOption,
  resolveMode,
} from '@/lib/scene-config';

function EditorScreenContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [version, setVersion] = useState(() => Date.now());
  const { assets, history, slotHint } = useSceneEditor();
  const mode = resolveMode(Array.isArray(params.mode) ? params.mode[0] : params.mode);
  const scene = getSceneOption(mode);
  const stageHeight = Math.min(Math.max(height * 0.44, 320), width >= 960 ? 540 : 460);
  const contentWidth = Math.min(width - 24, 980);
  const previewUri = useMemo(
    () =>
      buildSceneUrl(DEFAULT_SCENE_BASE_URL, mode, version, {
        embedded: true,
        variant: 'preview',
      }),
    [mode, version],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Scene editor',
          headerBackVisible: false,
          headerShadowVisible: false,
          headerTransparent: true,
          headerRight: () => (
            <Pressable
              accessibilityLabel="close editor"
              accessibilityRole="button"
              accessible
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
              testID="editor-close-button">
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={16}
                tintColor="#fff7f1"
                weight="bold"
              />
            </Pressable>
          ),
        }}
      />

      <View style={styles.screen} testID="scene-editor-screen">
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              maxWidth: contentWidth,
              paddingBottom: insets.bottom + 28,
              paddingTop: insets.top + 56,
            },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.stageShell, { height: stageHeight }]}>
            <SceneFrame interactive={false} testID="scene-editor-frame" uri={previewUri} />
            <View pointerEvents="none" style={styles.stageScrim} />

            <View pointerEvents="box-none" style={styles.stageOverlay}>
              <View style={styles.stageTopRail}>
                <GlassSurface style={styles.sceneChip}>
                  <Text style={styles.sceneChipText}>{scene.label}</Text>
                </GlassSurface>

                <GlassSurface style={styles.statsCard}>
                  <Text style={styles.statsLabel}>slot {slotHint}</Text>
                  <Text style={styles.statsLabel}>{assets.length} assets</Text>
                </GlassSurface>
              </View>

              <View style={styles.bottomRail}>
                <GlassSurface style={styles.metaCard}>
                  <Text style={styles.sceneSubtitle}>{scene.subtitle}</Text>
                  <Text style={styles.sceneTitle}>{scene.label}</Text>
                  <Text style={styles.sceneHint}>
                    Edit prompts, assets and voice cues below. Preview stays centered.
                  </Text>
                </GlassSurface>

                <Pressable
                  accessibilityLabel="reload editor preview"
                  accessibilityRole="button"
                  accessible
                  onPress={() => setVersion(Date.now())}
                  testID="editor-reload-preview">
                  {({ pressed }) => (
                    <GlassSurface interactive style={[styles.reloadButton, pressed && styles.headerButtonPressed]}>
                      <SymbolView
                        name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
                        size={18}
                        tintColor="#fff8f4"
                        weight="bold"
                      />
                    </GlassSurface>
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          <AppHeader activeSceneLabel={scene.label} sceneCount={1} sceneTitle="Editor controls" />
          <HistoryPanel entries={history} />
          <AssetPicker />
          <ExportBundleButton />
        </ScrollView>
      </View>
    </>
  );
}

export default function EditorScreen() {
  return (
    <SceneEditorProvider>
      <EditorScreenContent />
    </SceneEditorProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050608',
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    width: '100%',
  },
  stageShell: {
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#090b0e',
  },
  stageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 4, 6, 0.1)',
  },
  stageOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  stageTopRail: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sceneChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sceneChipText: {
    color: '#fff6ef',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statsCard: {
    borderRadius: 20,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statsLabel: {
    color: '#fff1e9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sceneHint: {
    color: '#f4e1d7',
    fontSize: 13,
    lineHeight: 18,
  },
  reloadButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerButtonPressed: {
    opacity: 0.72,
  },
});
