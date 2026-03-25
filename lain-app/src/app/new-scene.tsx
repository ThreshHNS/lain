import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

import GlassSurface from '@/components/glass-surface';
import { createSceneDraft, fetchSceneDrafts } from '@/lib/api/scene-drafts';
import { getEditorPalette } from '@/lib/editor/editor-palette';
import type { SceneDraft, SceneInputModel } from '@/types/scene-draft';

const INPUT_MODE_OPTIONS: { id: SceneInputModel; label: string; note: string }[] = [
  { id: 'tap', label: 'Tap', note: 'quick one-shot input' },
  { id: 'hold', label: 'Hold', note: 'sustained pressure' },
  { id: 'drag', label: 'Drag', note: 'continuous movement' },
  { id: 'remote', label: 'Remote', note: 'tv-first focus flow' },
  { id: 'mixed', label: 'Mixed', note: 'combined interaction' },
];

function formatDraftTime(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

export default function NewSceneScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = getEditorPalette(colorScheme);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [inputModel, setInputModel] = useState<SceneInputModel>('tap');
  const [drafts, setDrafts] = useState<SceneDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = title.trim().length > 0 && brief.trim().length > 0 && !submitting;
  const helperCopy = useMemo(
    () =>
      inputModel === 'remote'
        ? 'TV-first scenes stay lean: short command input, clear focus order, no heavy off-device tools on the shell itself.'
        : 'Creating a scene draft also opens a prompt thread so routing and history can attach immediately.',
    [inputModel],
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchSceneDrafts(controller.signal)
      .then(setDrafts)
      .catch(fetchError => {
        if ((fetchError as Error).name !== 'AbortError') {
          setError((fetchError as Error).message);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const handleCreate = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const sceneDraft = await createSceneDraft({
        brief: brief.trim(),
        creatorId: 'local-creator',
        initialPrompt: brief.trim(),
        inputModel,
        title: title.trim(),
      });

      setDrafts(currentDrafts => [sceneDraft, ...currentDrafts]);
      setTitle('');
      setBrief('');
      setInputModel('tap');
      router.push({
        pathname: '/editor',
        params: {
          inputModel: sceneDraft.inputModel,
          promptSessionId: sceneDraft.promptSessionId,
          sceneDraftId: sceneDraft.id,
          title: sceneDraft.title,
        },
      });
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDraft = (sceneDraft: SceneDraft) => {
    router.push({
      pathname: '/editor',
      params: {
        inputModel: sceneDraft.inputModel,
        promptSessionId: sceneDraft.promptSessionId,
        sceneDraftId: sceneDraft.id,
        title: sceneDraft.title,
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShadowVisible: false,
          title: 'Scene lab',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: palette.screen }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        testID="new-scene-screen">
        <GlassSurface style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text selectable style={[styles.eyebrow, { color: palette.mutedText }]}>
            Minimal scene draft
          </Text>
          <Text selectable style={[styles.title, { color: palette.strongText }]}>
            Start a new scene
          </Text>
          <Text selectable style={[styles.subtitle, { color: palette.mutedText }]}>
            Keep it lean: title, interaction model, and one compact brief. Backend creates the draft
            plus its initial prompt thread immediately.
          </Text>
        </GlassSurface>

        <GlassSurface style={[styles.formCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.fieldGroup}>
            <Text selectable style={[styles.fieldLabel, { color: palette.mutedText }]}>
              Scene title
            </Text>
            <TextInput
              onChangeText={setTitle}
              placeholder="Neon stairwell"
              placeholderTextColor={palette.mutedText}
              style={[styles.input, { color: palette.strongText, borderColor: palette.border }]}
              testID="new-scene-title-input"
              value={title}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text selectable style={[styles.fieldLabel, { color: palette.mutedText }]}>
              Input model
            </Text>
            <View style={styles.chipRow}>
              {INPUT_MODE_OPTIONS.map(option => {
                const selected = option.id === inputModel;

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setInputModel(option.id)}
                    testID={`new-scene-input-${option.id}`}>
                    {({ pressed }) => (
                      <GlassSurface
                        interactive
                        style={[
                          styles.inputChip,
                          {
                            backgroundColor: selected ? palette.accentMuted : palette.chip,
                            borderColor: selected ? palette.accent : palette.border,
                          },
                          pressed && styles.buttonPressed,
                        ]}>
                        <Text selectable style={[styles.inputChipLabel, { color: palette.strongText }]}>
                          {option.label}
                        </Text>
                        <Text selectable style={[styles.inputChipNote, { color: palette.mutedText }]}>
                          {option.note}
                        </Text>
                      </GlassSurface>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text selectable style={[styles.fieldLabel, { color: palette.mutedText }]}>
              Brief
            </Text>
            <TextInput
              multiline
              onChangeText={setBrief}
              placeholder="One sentence on the fantasy, space, and player action."
              placeholderTextColor={palette.mutedText}
              style={[styles.textarea, { color: palette.strongText, borderColor: palette.border }]}
              testID="new-scene-brief-input"
              value={brief}
            />
          </View>

          <Text selectable style={[styles.helperCopy, { color: palette.mutedText }]}>
            {helperCopy}
          </Text>

          {error ? (
            <Text selectable style={[styles.errorText, { color: '#ffb8a1' }]} testID="new-scene-error">
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityLabel="create scene draft"
            accessibilityRole="button"
            accessible
            disabled={!canSubmit}
            onPress={() => {
              void handleCreate();
            }}
            testID="new-scene-submit-button">
            {({ pressed }) => (
              <GlassSurface
                interactive
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: canSubmit ? '#d8f7e8' : palette.chip,
                    borderColor: canSubmit ? '#d8f7e8' : palette.border,
                  },
                  pressed && canSubmit && styles.buttonPressed,
                ]}>
                <Text
                  selectable
                  style={[
                    styles.submitLabel,
                    { color: canSubmit ? '#08110d' : palette.mutedText },
                  ]}>
                  {submitting ? 'Creating…' : 'Create scene'}
                </Text>
              </GlassSurface>
            )}
          </Pressable>
        </GlassSurface>

        <View style={styles.sectionHeader}>
          <Text selectable style={[styles.sectionTitle, { color: palette.strongText }]}>
            Scene drafts
          </Text>
          <Text selectable style={[styles.sectionMeta, { color: palette.mutedText }]}>
            {loading ? 'syncing…' : `${drafts.length} total`}
          </Text>
        </View>

        {loading ? (
          <GlassSurface style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text selectable style={[styles.emptyTitle, { color: palette.strongText }]} testID="new-scene-loading">
              Loading drafts…
            </Text>
          </GlassSurface>
        ) : drafts.length ? (
          <View style={styles.draftList}>
            {drafts.map(sceneDraft => (
              <View key={sceneDraft.id} testID={`scene-draft-card-${sceneDraft.slug}`}>
                <GlassSurface
                  style={[styles.draftCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <View style={styles.draftHeader}>
                    <View style={styles.draftCopy}>
                      <Text selectable style={[styles.draftTitle, { color: palette.strongText }]}>
                        {sceneDraft.title}
                      </Text>
                      <Text selectable style={[styles.draftMeta, { color: palette.mutedText }]}>
                        {sceneDraft.slug} · {sceneDraft.inputModel} · {sceneDraft.status}
                      </Text>
                    </View>
                    <Text selectable style={[styles.draftDate, { color: palette.mutedText }]}>
                      {formatDraftTime(sceneDraft.createdAt)}
                    </Text>
                  </View>
                  <Text selectable style={[styles.draftBrief, { color: palette.strongText }]}>
                    {sceneDraft.brief}
                  </Text>
                  <Pressable
                    accessibilityLabel={`open ${sceneDraft.title} draft`}
                    accessibilityRole="button"
                    accessible
                    onPress={() => handleOpenDraft(sceneDraft)}
                    testID={`scene-draft-open-${sceneDraft.slug}`}>
                    {({ pressed }) => (
                      <GlassSurface
                        interactive
                        style={[styles.openDraftButton, pressed && styles.buttonPressed]}>
                        <Text selectable style={styles.openDraftLabel}>
                          Open prompt
                        </Text>
                      </GlassSurface>
                    )}
                  </Pressable>
                </GlassSurface>
              </View>
            ))}
          </View>
        ) : (
          <GlassSurface style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text selectable style={[styles.emptyTitle, { color: palette.strongText }]}>
              No user-created scenes yet.
            </Text>
            <Text selectable style={[styles.emptyCopy, { color: palette.mutedText }]}>
              The first created draft will appear here with its slug and prompt thread attached.
            </Text>
          </GlassSurface>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    minHeight: '100%',
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
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
  },
  formCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inputChip: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputChipNote: {
    fontSize: 11,
    lineHeight: 16,
  },
  helperCopy: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  submitLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  draftList: {
    gap: 10,
  },
  draftCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  draftHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  draftCopy: {
    flex: 1,
    gap: 4,
  },
  draftTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  draftMeta: {
    fontSize: 12,
  },
  draftDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  draftBrief: {
    fontSize: 14,
    lineHeight: 20,
  },
  openDraftButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  openDraftLabel: {
    color: '#fff7f1',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonPressed: {
    opacity: 0.84,
  },
});
