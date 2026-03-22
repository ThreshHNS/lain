import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useSceneEditor } from '@/context/scene-editor-context';
import { exportSceneBundle } from '@/lib/scene-export';

export default function ExportBundleButton() {
  const { slotHint, assets, history } = useSceneEditor();

  const handleExport = async () => {
    try {
      const { uri } = await exportSceneBundle({
        title: 'Scene selector draft',
        slotHint,
        assets,
        history,
      });
      Alert.alert('Bundle ready', `Manifest saved to:\n${uri}`);
    } catch (error) {
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
