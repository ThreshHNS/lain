import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { HistoryEntry } from '@/types/editor';

type HistoryPanelProps = {
  entries: HistoryEntry[];
};

export default function HistoryPanel({ entries }: HistoryPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Recent prompts</Text>
      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.label}>
              {item.actor.name} · {item.type}
              {item.slot ? ` · ${item.slot}` : ''}
            </Text>
            <Text style={styles.detail}>{item.label}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0c0a0f',
    marginBottom: 12,
  },
  heading: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    paddingVertical: 8,
  },
  label: {
    color: '#f7c7bd',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  detail: {
    color: '#fff6ef',
    fontSize: 14,
  },
  timestamp: {
    color: '#b1b1b1',
    fontSize: 10,
  },
});
