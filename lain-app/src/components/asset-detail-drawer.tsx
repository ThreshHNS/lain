import { Modal, Pressable, StyleSheet, Text, View, Linking } from 'react-native';
import type { AssetReference } from '@/types/editor';

type AssetDetailDrawerProps = {
  visible: boolean;
  asset?: AssetReference | null;
  onClose: () => void;
};

export default function AssetDetailDrawer({ visible, asset, onClose }: AssetDetailDrawerProps) {
  if (!asset) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.drawer}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <Text style={styles.heading}>{asset.name}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.metaLabel}>Source</Text>
          <Text style={styles.metaText}>{asset.source}</Text>
          <Text style={styles.metaLabel}>License</Text>
          <Text style={styles.metaText}>{asset.license}</Text>
          <Text style={styles.metaLabel}>Last updated</Text>
          <Text style={styles.metaText}>{new Date(asset.updatedAt).toLocaleString()}</Text>
          {asset.slot ? (
            <>
              <Text style={styles.metaLabel}>Assigned slot</Text>
              <Text style={styles.slotLabel}>{asset.slot}</Text>
            </>
          ) : null}
          {asset.metadata ? (
            <>
              <Text style={styles.metaLabel}>Metadata</Text>
              {Object.entries(asset.metadata).map(([key, value]) => (
                <Text key={key} style={styles.metaText}>
                  {key}: {String(value)}
                </Text>
              ))}
            </>
          ) : null}
          <Pressable style={styles.linkButton} onPress={() => Linking.openURL(asset.url)}>
            <Text style={styles.linkText}>Open asset</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  drawer: {
    backgroundColor: '#0c0a0f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    color: '#fff7f1',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    color: '#fff7f1',
    fontSize: 12,
  },
  metaLabel: {
    color: '#f3c6b6',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  metaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  slotLabel: {
    color: '#3dffb8',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#3dffb8',
    alignItems: 'center',
  },
  linkText: {
    color: '#0c0a0f',
    fontWeight: '700',
  },
});
