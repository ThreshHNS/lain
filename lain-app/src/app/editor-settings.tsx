import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useColorScheme } from 'react-native';

import GlassSurface from '@/components/glass-surface';
import {
  DEFAULT_EDITOR_PREFERENCES,
  useEditorPreferences,
} from '@/context/editor-preferences-context';
import { useSceneRuntime } from '@/context/scene-runtime-context';
import { getEditorPalette } from '@/lib/editor/editor-palette';
import { getSceneOption, resolveMode } from '@/lib/scene-config';
import { formatSceneBridgeSummary } from '@/lib/runtime/scene-bridge';
import type { AssistantId, SlotHint } from '@/types/editor';

const ASSISTANT_OPTIONS: Array<{
  id: AssistantId;
  label: string;
  note: string;
}> = [
  { id: 'codex', label: 'Codex', note: 'tool-first scene edits' },
  { id: 'claude', label: 'Claude', note: 'long-form direction' },
  { id: 'gpt-5', label: 'GPT-5', note: 'balanced prompting' },
  { id: 'gemini', label: 'Gemini', note: 'fast visual passes' },
];

const SLOT_HINT_OPTIONS: SlotHint[] = ['walk', 'kill', 'seed', 'idle'];

function toSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function readPendingCount(value?: string | string[]) {
  const parsed = Number(toSingleParam(value) ?? '0');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatSessionStatus(status?: string) {
  if (status === 'ready') {
    return 'Backend linked';
  }
  if (status === 'offline') {
    return 'Local only';
  }
  return 'Syncing';
}

function formatFrameStatus(status: 'idle' | 'loading' | 'ready' | 'error') {
  if (status === 'ready') {
    return 'Scene linked';
  }
  if (status === 'loading') {
    return 'Loading preview';
  }
  if (status === 'error') {
    return 'Scene unavailable';
  }
  return 'Waiting for scene';
}

type SettingRowProps = {
  label: string;
  value: string;
  tone?: 'default' | 'accent';
};

type PreferenceChipProps = {
  helper?: string;
  label: string;
  onPress: () => void;
  selected: boolean;
  testID: string;
};

type ToggleRowProps = {
  description: string;
  label: string;
  onPress: () => void;
  selected: boolean;
  testID: string;
};

function SettingRow({ label, value, tone = 'default' }: SettingRowProps) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={[styles.settingValue, tone === 'accent' && styles.settingValueAccent]}>{value}</Text>
    </View>
  );
}

function PreferenceChip({ helper, label, onPress, selected, testID }: PreferenceChipProps) {
  return (
    <Pressable onPress={onPress} testID={testID}>
      {({ pressed }) => (
        <View
          style={[
            styles.preferenceChip,
            selected && styles.preferenceChipSelected,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={[styles.preferenceChipLabel, selected && styles.preferenceChipLabelSelected]}>
            {label}
          </Text>
          {helper ? (
            <Text style={[styles.preferenceChipHelper, selected && styles.preferenceChipHelperSelected]}>
              {helper}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function ToggleRow({ description, label, onPress, selected, testID }: ToggleRowProps) {
  return (
    <Pressable onPress={onPress} testID={testID}>
      {({ pressed }) => (
        <View
          style={[
            styles.toggleRow,
            selected && styles.toggleRowSelected,
            pressed && styles.buttonPressed,
          ]}>
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, selected && styles.toggleTitleSelected]}>{label}</Text>
            <Text style={[styles.toggleDescription, selected && styles.toggleDescriptionSelected]}>
              {description}
            </Text>
          </View>
          <View style={[styles.toggleBadge, selected && styles.toggleBadgeSelected]}>
            <Text style={[styles.toggleBadgeText, selected && styles.toggleBadgeTextSelected]}>
              {selected ? 'On' : 'Off'}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function EditorSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    assistantLabel?: string | string[];
    assistantNote?: string | string[];
    mode?: string | string[];
    overlayScene?: string | string[];
    pendingHistoryCount?: string | string[];
    promptSessionId?: string | string[];
    sceneDraftId?: string | string[];
    sessionStatus?: string | string[];
    title?: string | string[];
  }>();
  const colorScheme = useColorScheme();
  const palette = getEditorPalette(colorScheme);
  const { preferences, preferencesHydrated, resetPreferences, updatePreferences } = useEditorPreferences();
  const mode = resolveMode(toSingleParam(params.mode));
  const scene = getSceneOption(mode);
  const displayTitle = toSingleParam(params.title)?.trim() || scene.label;
  const currentAssistantLabel = toSingleParam(params.assistantLabel) || 'Codex';
  const currentAssistantNote = toSingleParam(params.assistantNote) || 'tool-first scene edits';
  const promptSessionId = toSingleParam(params.promptSessionId);
  const sceneDraftId = toSingleParam(params.sceneDraftId);
  const sessionStatus = toSingleParam(params.sessionStatus) || 'syncing';
  const overlayScene = toSingleParam(params.overlayScene) === '1';
  const pendingHistoryCount = readPendingCount(params.pendingHistoryCount);
  const { runtime } = useSceneRuntime(mode);
  const runtimeSummary = formatSceneBridgeSummary(runtime.lastState);
  const preferredAssistantLabel =
    ASSISTANT_OPTIONS.find(option => option.id === preferences.preferredAssistantId)?.label ??
    preferences.preferredAssistantId;
  const surfaceLabel = overlayScene ? 'Overlay on live game scene' : 'Embedded preview frame';
  const shareTitle = `${displayTitle} editor settings`;
  const promptHistoryHref = {
    pathname: '/prompt-history' as const,
    params: {
      mode,
      promptSessionId,
      sceneDraftId,
      title: displayTitle,
    },
  };
  const hydrationLabel = preferencesHydrated ? 'Saved on this device' : 'Syncing local prefs';
  const handleShareSettings = () => {
    const shareMessage = [
      `${displayTitle} editor settings`,
      `Mode: ${mode}`,
      `Default assistant: ${preferredAssistantLabel}`,
      `Default slot: ${preferences.defaultSlotHint}`,
      `Prompt history preview: ${preferences.showPromptHistoryPreview ? 'On' : 'Off'}`,
      `Status pills: ${preferences.showStatusPills ? 'On' : 'Off'}`,
      `Surface: ${surfaceLabel}`,
      `Prompt backend: ${formatSessionStatus(sessionStatus)}`,
      `Scene link: ${formatFrameStatus(runtime.frameStatus)}`,
    ].join('\n');

    void Share.share({
      message: shareMessage,
      title: shareTitle,
    }).catch(() => null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShadowVisible: false,
          title: 'Editor settings',
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.View>
          <Pressable
            accessibilityLabel="share editor settings"
            accessibilityRole="button"
            accessible
            hitSlop={8}
            onPress={handleShareSettings}
            testID="editor-settings-share-button">
            {({ pressed }) => (
              <View style={[styles.navIconButton, pressed && styles.buttonPressed]}>
                <SymbolView
                  name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                  size={18}
                  tintColor="#fff7f1"
                  weight="semibold"
                />
              </View>
            )}
          </Pressable>
        </Stack.Toolbar.View>
      </Stack.Toolbar>

      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: palette.screen }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        testID="editor-settings-screen">
        <GlassSurface style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View pointerEvents="none" style={styles.heroGradient}>
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowSecondary} />
          </View>
          <Text style={[styles.eyebrow, { color: palette.mutedText }]}>Launch defaults</Text>
          <Text style={[styles.title, { color: palette.strongText }]}>{displayTitle}</Text>
          <Text style={[styles.subtitle, { color: palette.mutedText }]}>
            Tune the assistant, slot, and chrome this scene should open with. Prompt history stays
            one tap away for fast context checks.
          </Text>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel="open prompt history"
              accessibilityRole="button"
              accessible
              onPress={() => router.push(promptHistoryHref)}
              testID="editor-settings-history-button">
              {({ pressed }) => (
                <View
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: palette.accent,
                      borderColor: palette.accent,
                    },
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text style={[styles.actionLabel, { color: palette.accentText }]}>Prompt history</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              accessibilityLabel="close editor settings"
              accessibilityRole="button"
              accessible
              onPress={() => router.back()}
              testID="editor-settings-done-button">
              {({ pressed }) => (
                <View
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: palette.chip,
                      borderColor: palette.border,
                    },
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text style={[styles.actionLabel, { color: palette.strongText }]}>Done</Text>
                </View>
              )}
            </Pressable>
          </View>
        </GlassSurface>

        <GlassSurface style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: palette.mutedText }]}>Preferences</Text>
            <Text style={[styles.sectionStatus, { color: palette.mutedText }]}>{hydrationLabel}</Text>
          </View>

          <View style={styles.preferenceGroup}>
            <Text style={[styles.preferenceLabel, { color: palette.mutedText }]}>Default assistant</Text>
            <View style={styles.preferenceGrid}>
              {ASSISTANT_OPTIONS.map((option) => (
                <PreferenceChip
                  helper={option.note}
                  key={option.id}
                  label={option.label}
                  onPress={() => updatePreferences({ preferredAssistantId: option.id })}
                  selected={preferences.preferredAssistantId === option.id}
                  testID={`editor-settings-assistant-${option.id}`}
                />
              ))}
            </View>
          </View>

          <View style={styles.preferenceGroup}>
            <Text style={[styles.preferenceLabel, { color: palette.mutedText }]}>Default slot hint</Text>
            <View style={styles.preferenceGrid}>
              {SLOT_HINT_OPTIONS.map((slot) => (
                <PreferenceChip
                  key={slot}
                  label={slot}
                  onPress={() => updatePreferences({ defaultSlotHint: slot })}
                  selected={preferences.defaultSlotHint === slot}
                  testID={`editor-settings-slot-${slot}`}
                />
              ))}
            </View>
          </View>

          <View style={styles.preferenceGroup}>
            <Text style={[styles.preferenceLabel, { color: palette.mutedText }]}>Editor chrome</Text>
            <View style={styles.toggleList}>
              <ToggleRow
                description="Keep the iOS route preview card on the prompt history pill."
                label="Prompt history preview"
                onPress={() =>
                  updatePreferences({
                    showPromptHistoryPreview: !preferences.showPromptHistoryPreview,
                  })
                }
                selected={preferences.showPromptHistoryPreview}
                testID="editor-settings-toggle-prompt-history-preview"
              />
              <ToggleRow
                description="Show backend/runtime pills in the header while editing."
                label="Status pills"
                onPress={() =>
                  updatePreferences({
                    showStatusPills: !preferences.showStatusPills,
                  })
                }
                selected={preferences.showStatusPills}
                testID="editor-settings-toggle-status-pills"
              />
            </View>
          </View>

          <Pressable
            onPress={resetPreferences}
            testID="editor-settings-reset-button">
            {({ pressed }) => (
              <View
                style={[
                  styles.resetButton,
                  {
                    backgroundColor: palette.chip,
                    borderColor: palette.border,
                  },
                  pressed && styles.buttonPressed,
                ]}>
                <Text style={[styles.resetButtonLabel, { color: palette.strongText }]}>
                  Reset defaults
                </Text>
                <Text style={[styles.resetButtonCopy, { color: palette.mutedText }]}>
                  Restore {DEFAULT_EDITOR_PREFERENCES.preferredAssistantId} and the default editor chrome.
                </Text>
              </View>
            )}
          </Pressable>
        </GlassSurface>

        <GlassSurface style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionLabel, { color: palette.mutedText }]}>Prompt backend</Text>
          <SettingRow
            label="Session"
            tone={sessionStatus === 'offline' ? 'accent' : 'default'}
            value={formatSessionStatus(sessionStatus)}
          />
          <SettingRow label="Pending local notes" value={pendingHistoryCount > 0 ? String(pendingHistoryCount) : '0'} />
          <SettingRow label="Prompt session id" value={promptSessionId ?? 'Not linked yet'} />
        </GlassSurface>

        <GlassSurface style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionLabel, { color: palette.mutedText }]}>Scene link</Text>
          <SettingRow label="Surface" value={overlayScene ? 'Overlay on live game scene' : 'Embedded preview frame'} />
          <SettingRow
            label="Runtime"
            tone={runtime.frameStatus === 'error' ? 'accent' : 'default'}
            value={formatFrameStatus(runtime.frameStatus)}
          />
          <SettingRow label="Live scene summary" value={runtimeSummary ?? 'No scene bridge update yet'} />
          <SettingRow label="Draft link" value={sceneDraftId ? 'Connected' : 'Standalone editor draft'} />
        </GlassSurface>

        <GlassSurface style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionLabel, { color: palette.mutedText }]}>Live editor state</Text>
          <SettingRow label="Current assistant" value={currentAssistantLabel} />
          <SettingRow label="Current note" value={currentAssistantNote} />
          <SettingRow label="Mode" value={mode} />
          <Text style={[styles.helperCopy, { color: palette.mutedText }]}>
            Saved defaults affect the next editor launch. The active session can still drift if you
            change assistant or slot mid-prompt.
          </Text>
        </GlassSurface>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    minHeight: '100%',
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlowPrimary: {
    backgroundColor: 'rgba(216,247,232,0.14)',
    borderRadius: 220,
    height: 220,
    left: -56,
    position: 'absolute',
    top: -94,
    width: 220,
  },
  heroGlowSecondary: {
    backgroundColor: 'rgba(255,151,112,0.12)',
    borderRadius: 180,
    bottom: -104,
    height: 180,
    position: 'absolute',
    right: -48,
    width: 180,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 520,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  navIconButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  settingRow: {
    gap: 6,
  },
  settingLabel: {
    color: 'rgba(255,244,235,0.56)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  settingValue: {
    color: '#fff7f1',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  settingValueAccent: {
    color: '#ffb082',
  },
  preferenceGroup: {
    gap: 10,
  },
  preferenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  preferenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferenceChip: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: 108,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  preferenceChipSelected: {
    backgroundColor: 'rgba(216,247,232,0.14)',
    borderColor: 'rgba(216,247,232,0.3)',
  },
  preferenceChipLabel: {
    color: '#fff7f1',
    fontSize: 13,
    fontWeight: '700',
  },
  preferenceChipLabelSelected: {
    color: '#d8f7e8',
  },
  preferenceChipHelper: {
    color: 'rgba(255,244,235,0.68)',
    fontSize: 12,
    lineHeight: 16,
  },
  preferenceChipHelperSelected: {
    color: 'rgba(216,247,232,0.78)',
  },
  toggleList: {
    gap: 8,
  },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toggleRowSelected: {
    backgroundColor: 'rgba(216,247,232,0.12)',
    borderColor: 'rgba(216,247,232,0.26)',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: '#fff7f1',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleTitleSelected: {
    color: '#d8f7e8',
  },
  toggleDescription: {
    color: 'rgba(255,244,235,0.68)',
    fontSize: 12,
    lineHeight: 17,
  },
  toggleDescriptionSelected: {
    color: 'rgba(216,247,232,0.78)',
  },
  toggleBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleBadgeSelected: {
    backgroundColor: 'rgba(216,247,232,0.18)',
  },
  toggleBadgeText: {
    color: '#fff7f1',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  toggleBadgeTextSelected: {
    color: '#d8f7e8',
  },
  resetButton: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  resetButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  resetButtonCopy: {
    fontSize: 12,
    lineHeight: 17,
  },
  helperCopy: {
    fontSize: 13,
    lineHeight: 19,
  },
  buttonPressed: {
    opacity: 0.76,
  },
});
