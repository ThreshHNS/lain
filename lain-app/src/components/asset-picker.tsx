import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { AssetReference, SlotHint } from '@/types/editor';
import { useSceneEditor } from '@/context/scene-editor-context';
import GlassSurface from './glass-surface';
import AssetDetailDrawer from './asset-detail-drawer';

const SLOT_HINTS: SlotHint[] = ['walk', 'kill', 'seed', 'idle'];

const SAMPLE_ASSETS: AssetReference[] = [
  {
    id: 'asset-1',
    name: 'Neon corridor',
    source: 'poly_pizza',
    license: 'CC0',
    url: 'https://poly.pizza/m/fJsz9IVM8f',
    thumbnail:
      'https://cdn.poly.pizza/3a/8c/3a8c9c3b6/db08ea7c-5db8-4c27-b5b6-d4828debeeb5-320.png',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'asset-2',
    name: 'Horror slasher avatar',
    source: 'google_drive',
    license: 'Private',
    url: 'https://drive.google.com/file/d/1XWYhLypV7GI9vGNQw5MvCihjb0nptK6u/view',
    thumbnail: 'https://via.placeholder.com/120x120.png?text=drive',
    updatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: 'asset-3',
    name: 'Ghost effect loop',
    source: 'sketchfab',
    license: 'CC-BY',
    url: 'https://sketchfab.com/3d-models/ghost-2e9cf5c',
    thumbnail: 'https://cdn.pixabay.com/photo/2016/11/19/14/00/ghost-1836472_1280.png',
    updatedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
  },
];

type AssetPickerProps = {
  variant?: 'solid' | 'glass';
};

export default function AssetPicker({ variant = 'solid' }: AssetPickerProps) {
  const { assets, addAsset, setSlotHint, slotHint } = useSceneEditor();
  const [detailAsset, setDetailAsset] = useState<AssetReference | null>(null);
  const { width } = useWindowDimensions();

  const selectedIds = useMemo(() => new Set(assets.map(asset => asset.id)), [assets]);
  const cardWidth = Math.min(Math.max(width * 0.48, 188), 236);
  const content = (
    <>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.heading}>Asset browser</Text>
          <Text style={styles.subheading}>Attach scene references without leaving live playback.</Text>
        </View>
        <Text style={styles.counter}>{assets.length} selected</Text>
      </View>

      <View style={styles.slotRow}>
        {SLOT_HINTS.map(hint => (
          <Pressable
            key={hint}
            style={[
              styles.slotChip,
              slotHint === hint && styles.slotChipActive,
            ]}
            onPress={() => setSlotHint(hint)}>
            <Text style={[styles.slotLabel, slotHint === hint && styles.slotLabelActive]}>
              {hint}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={SAMPLE_ASSETS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, variant === 'glass' && styles.cardGlass, { width: cardWidth }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardCopy}>
                <Text numberOfLines={2} style={styles.name}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>
                  {item.source} · {item.license}
                </Text>
              </View>
              <Text style={styles.slotTag}>{slotHint}</Text>
            </View>
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(item.url)}>
              <Text style={styles.linkText}>Open asset</Text>
            </Pressable>
            <Pressable
              style={[
                styles.selectButton,
                selectedIds.has(item.id) && styles.selectButtonActive,
              ]}
              onPress={() => addAsset({ ...item, slot: slotHint })}>
              <Text style={[styles.selectText, selectedIds.has(item.id) && styles.selectTextActive]}>
                {selectedIds.has(item.id) ? 'Selected' : 'Attach asset'}
              </Text>
            </Pressable>
            <Pressable style={styles.detailButton} onPress={() => setDetailAsset(item)}>
              <Text style={styles.detailText}>Details</Text>
            </Pressable>
          </View>
        )}
      />
      <AssetDetailDrawer
        asset={detailAsset}
        visible={Boolean(detailAsset)}
        onClose={() => setDetailAsset(null)}
      />
    </>
  );

  if (variant === 'glass') {
    return <GlassSurface style={[styles.container, styles.containerGlass]}>{content}</GlassSurface>;
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0b0d10',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  containerGlass: {
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  heading: {
    color: '#f2eee8',
    fontSize: 14,
    fontWeight: '700',
  },
  subheading: {
    color: '#8b929a',
    fontSize: 12,
    lineHeight: 17,
  },
  counter: {
    color: '#d8f7e8',
    fontSize: 12,
    fontWeight: '700',
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
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  slotLabelActive: {
    color: '#d8f7e8',
  },
  listContent: {
    gap: 12,
    paddingRight: 2,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#111419',
    gap: 10,
    padding: 14,
  },
  cardGlass: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(13,16,20,0.36)',
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: '#f6f1eb',
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: '#8a929a',
    fontSize: 12,
  },
  slotTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    color: '#d8f7e8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(61,255,184,0.1)',
  },
  linkButton: {
    borderRadius: 12,
    backgroundColor: '#181d23',
    paddingVertical: 10,
  },
  linkText: {
    color: '#e7ebe8',
    textAlign: 'center',
    fontWeight: '600',
  },
  selectButton: {
    borderRadius: 12,
    backgroundColor: '#d8f7e8',
    paddingVertical: 11,
  },
  selectButtonActive: {
    borderRadius: 12,
    backgroundColor: 'rgba(61,255,184,0.18)',
  },
  selectText: {
    color: '#07110c',
    textAlign: 'center',
    fontWeight: '600',
  },
  selectTextActive: {
    color: '#d8f7e8',
  },
  detailButton: {
    borderRadius: 12,
    backgroundColor: '#181d23',
    paddingVertical: 10,
  },
  detailText: {
    color: '#cfd6de',
    textAlign: 'center',
    fontWeight: '600',
  },
});
