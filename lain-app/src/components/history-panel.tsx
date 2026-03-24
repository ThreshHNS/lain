import { StyleSheet, Text, View } from 'react-native';
import type { HistoryEntry } from '@/types/editor';
import GlassSurface from './glass-surface';

type HistoryPanelProps = {
  entries: HistoryEntry[];
  variant?: 'solid' | 'glass';
};

export default function HistoryPanel({ entries, variant = 'solid' }: HistoryPanelProps) {
  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3);

  if (!recentEntries.length) {
    return null;
  }

  const content = (
    <>
      <View style={styles.header}>
        <Text style={styles.heading}>Recent activity</Text>
        <Text style={styles.count}>{recentEntries.length} latest</Text>
      </View>
      <View style={styles.list}>
        {recentEntries.map((item, index) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.copy}>
              <Text numberOfLines={1} style={styles.detail}>
                {item.label}
              </Text>
              <Text numberOfLines={1} style={styles.label}>
                {item.actor.name} · {item.type}
                {item.slot ? ` · ${item.slot}` : ''}
                {item.audioUri ? ' · voice clip' : ''}
              </Text>
            </View>
            <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
            {index < recentEntries.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </View>
    </>
  );

  if (variant === 'glass') {
    return <GlassSurface style={[styles.panel, styles.panelGlass]}>{content}</GlassSurface>;
  }

  return <View style={styles.panel}>{content}</View>;
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0b0d10',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  panelGlass: {
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: {
    color: '#f2eee8',
    fontSize: 14,
    fontWeight: '700',
  },
  count: {
    color: '#8a929a',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  row: {
    alignItems: 'flex-start',
    gap: 8,
  },
  copy: {
    gap: 4,
    paddingRight: 72,
  },
  label: {
    color: '#8a929a',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  detail: {
    color: '#f6f1eb',
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    color: '#8a929a',
    fontSize: 11,
    position: 'absolute',
    right: 0,
    top: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
});
