import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SlotHint } from '@/types/editor';
import AvatarStack from './avatar-stack';
import HistoryDropdown from './history-dropdown';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useSceneEditor } from '@/context/scene-editor-context';

type AppHeaderProps = {
  sceneTitle: string;
};

const SLOT_HINTS: SlotHint[] = ['walk', 'kill', 'seed', 'idle'];

export default function AppHeader({ sceneTitle, onVoiceCaptured }: AppHeaderProps) {
  const { slotHint, setSlotHint, history, collaborators, addHistory } = useSceneEditor();
  const { status, audioUri, startRecording, stopRecording, reset } = useVoiceRecorder();

  const buttonLabel = useMemo(() => {
    if (status === 'recording') {
      return 'Recording...';
    }
    if (status === 'processing') {
      return 'Processing';
    }
    if (status === 'ready') {
      return 'Send voice';
    }
    return 'Push to talk';
  }, [status]);

  const handleVoiceEnd = async () => {
    await stopRecording();
    if (audioUri) {
    addHistory({
      label: 'Voice prompt recorded',
      timestamp: new Date().toISOString(),
      slot: slotHint,
      type: 'voice',
    });
      reset();
    }
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
      <View>
        <Text style={styles.sceneLabel}>Scene</Text>
        <Text style={styles.sceneTitle}>{sceneTitle}</Text>
      </View>

      <View style={styles.centerBlock}>
        <Pressable style={styles.voiceButton} onPress={handleRecord}>
          <Text style={styles.voiceText}>{buttonLabel}</Text>
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

      <View style={styles.rightBlock}>
        <HistoryDropdown entries={history} />
        <AvatarStack users={collaborators} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#120c10',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sceneLabel: {
    color: '#b1b1b1',
    fontSize: 11,
    letterSpacing: 1,
  },
  sceneTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
  },
  voiceButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ff7fe5',
  },
  voiceText: {
    color: '#130409',
    fontWeight: '700',
  },
  slotRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
  },
  slotChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  slotChipActive: {
    backgroundColor: 'rgba(61,255,184,0.18)',
  },
  slotLabel: {
    color: '#fff',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotLabelActive: {
    color: '#3dffb8',
  },
  rightBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
