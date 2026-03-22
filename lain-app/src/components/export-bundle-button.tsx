import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useSceneEditor } from '@/context/scene-editor-context';
import { exportDraft } from '@/lib/api/scene-draft';

export default function ExportBundleButton() {
  const { slotHint, assets, history, sessionId } = useSceneEditor();

  const handleExport = async () => {
    if (!sessionId) {
      Alert.alert('Export not ready', 'Session is still initializing');
      return;
    }

    try {
      const payload = await exportDraft(sessionId, assets);
      Alert.alert('Bundle ready', `Manifest exported with ${payload.manifest.assets.length} assets`);
    } catch (error: unknown) {
      Alert.alert('Export failed', `${error}`);
    }
  };

  return (
    <Pressable style={styles.button} onPress={handleExport}>
      <Text style={styles.label}>Export manifest for Codex</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#3dffb8',
    alignItems: 'center',
  },
  label: {
    color: '#050608',
    fontWeight: '700',
  },
});
