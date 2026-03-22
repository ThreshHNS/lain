import { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  FlatList,
  Modal,
} from 'react-native';
import type { HistoryEntry } from '@/types/editor';

type HistoryDropdownProps = {
  entries: HistoryEntry[];
};

export default function HistoryDropdown({ entries }: HistoryDropdownProps) {
  const [visible, setVisible] = useState(false);

  const sorted = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [entries]);

  return (
    <>
      <Pressable style={styles.button} onPress={() => setVisible(true)}>
        <Text style={styles.buttonText}>History {entries.length ? `· ${entries.length}` : ''}</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <Text style={styles.title}>History feed</Text>
            <FlatList
              data={sorted}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.entry}>
                  <Text style={styles.label}>
                    [{item.type.toUpperCase()}] {item.actor.name}
                    {item.slot ? ` · ${item.slot}` : ''}
                    {item.audioUri ? ' · voice clip' : ''}
                  </Text>
                  <Text style={styles.detail}>{item.label}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                    {item.slot ? ` · ${item.slot}` : ''}
                  </Text>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
            />
            <Pressable style={styles.closeButton} onPress={() => setVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#12161a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#cbd3da',
    fontSize: 12,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  title: {
    color: '#fff7f1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  entry: {
    paddingVertical: 8,
  },
  label: {
    color: '#f7d5c0',
    fontSize: 13,
    fontWeight: '600',
  },
  detail: {
    color: '#fff',
    fontSize: 14,
  },
  timestamp: {
    color: '#b1b1b1',
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 4,
  },
  closeButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  closeText: {
    color: '#3dffb8',
  },
});
