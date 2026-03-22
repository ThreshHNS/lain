import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useSceneEditor } from '@/context/scene-editor-context';
import { exportDraft } from '@/lib/api/scene-draft';

export default function ExportBundleButton() {
  const { assets, sessionId } = useSceneEditor();

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
      <Text style={styles.label}>Export manifest</Text>
      <Text style={styles.caption}>Codex bundle · {assets.length} assets</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(170, 248, 214, 0.18)',
    backgroundColor: '#11161b',
    gap: 4,
    paddingVertical: 14,
  },
  label: {
    color: '#e9efe9',
    fontSize: 15,
    fontWeight: '700',
  },
  caption: {
    color: '#8a929a',
    fontSize: 12,
    fontWeight: '600',
  },
});
