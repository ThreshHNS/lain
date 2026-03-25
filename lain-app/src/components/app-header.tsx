import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SlotHint } from '@/types/editor';
import AvatarStack from './avatar-stack';
import HistoryDropdown from './history-dropdown';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useSceneEditor } from '@/context/scene-editor-context';

type AppHeaderProps = {
  sceneTitle: string;
  activeSceneLabel?: string;
  sceneCount?: number;
  onVoiceCaptured?: (uri: string) => void;
};

const SLOT_HINTS: SlotHint[] = ['walk', 'kill', 'seed', 'idle'];

export default function AppHeader({
  sceneTitle,
  activeSceneLabel,
  sceneCount,
  onVoiceCaptured,
}: AppHeaderProps) {
  const { slotHint, setSlotHint, history, collaborators, addHistory } = useSceneEditor();
  const { status, startRecording, stopRecording, reset } = useVoiceRecorder();

  const buttonLabel = useMemo(() => {
    if (status === 'recording') {
      return 'Recording';
    }
    if (status === 'processing') {
      return 'Processing';
    }
    if (status === 'ready') {
      return 'Send voice';
    }
    return 'Voice prompt';
  }, [status]);

  const metaLabel = useMemo(() => {
    const sceneCountLabel =
      sceneCount != null ? `${sceneCount} ${sceneCount === 1 ? 'scene' : 'scenes'}` : null;

    if (sceneCount != null && activeSceneLabel) {
      return `${sceneCountLabel} · ${activeSceneLabel}`;
    }
    if (activeSceneLabel) {
      return activeSceneLabel;
    }
    if (sceneCountLabel) {
      return `${sceneCountLabel} ready`;
    }
    return 'Scene tools';
  }, [activeSceneLabel, sceneCount]);

  const handleVoiceEnd = async () => {
    const nextAudioUri = await stopRecording();
    if (!nextAudioUri) {
      return;
    }

    addHistory({
      label: 'Voice prompt recorded',
      timestamp: new Date().toISOString(),
      slot: slotHint,
      type: 'voice',
      audioUri: nextAudioUri,
    });
    onVoiceCaptured?.(nextAudioUri);
    reset();
  };

  const handleRecord = () => {
    if (status === 'recording') {
      void handleVoiceEnd();
      return;
    }
    void startRecording();
  };

  return (
    <View style={styles.header}>
      <View style={styles.summaryRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.sceneLabel}>Live scene</Text>
          <Text style={styles.sceneTitle}>{sceneTitle}</Text>
          <Text style={styles.sceneMeta}>{metaLabel}</Text>
        </View>

        <View style={styles.utilityRow}>
          <HistoryDropdown entries={history} />
          <AvatarStack users={collaborators} />
        </View>
      </View>

      <View style={styles.controlRow}>
        <Pressable onPress={handleRecord}>
          {({ pressed }) => (
            <View style={[styles.voiceButton, pressed && styles.voiceButtonPressed]}>
              <Text style={styles.voiceText}>{buttonLabel}</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.slotRow}>
          {SLOT_HINTS.map(hint => (
            <Pressable
              key={hint}
              style={[
                styles.slotChip,
                hint === slotHint && styles.slotChipActive,
              ]}
              onPress={() => setSlotHint(hint)}>
              <Text
                style={[
                  styles.slotLabel,
                  hint === slotHint && styles.slotLabelActive,
                ]}>
                {hint}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0b0d10',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  summaryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: 4,
    minWidth: 180,
  },
  sceneLabel: {
    color: '#7f878f',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sceneTitle: {
    color: '#f5f1eb',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sceneMeta: {
    color: '#9ba2aa',
    fontSize: 13,
    lineHeight: 18,
  },
  utilityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  voiceButton: {
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#d8f7e8',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  voiceButtonPressed: {
    opacity: 0.82,
  },
  voiceText: {
    color: '#07110c',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#12161a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotChipActive: {
    borderColor: 'rgba(170, 248, 214, 0.34)',
    backgroundColor: 'rgba(61,255,184,0.12)',
  },
  slotLabel: {
    color: '#c2cad2',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  slotLabelActive: {
    color: '#d8f7e8',
  },
});
