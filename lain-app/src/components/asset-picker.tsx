import { useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AssetReference } from '@/types/editor';

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
  onSelect?: (asset: AssetReference) => void;
};

export default function AssetPicker({ onSelect }: AssetPickerProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const handleToggle = (asset: AssetReference) => {
    const next = !selected[asset.id];
    setSelected(prev => ({ ...prev, [asset.id]: next }));
    if (next) {
      onSelect?.(asset);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Remote asset browser</Text>
      <FlatList
        data={SAMPLE_ASSETS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.source}</Text>
            <Text style={styles.meta}>{item.license}</Text>
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(item.url)}>
              <Text style={styles.linkText}>View</Text>
            </Pressable>
            <Pressable
              style={[styles.selectButton, selected[item.id] && styles.selectButtonActive]}
              onPress={() => handleToggle(item)}>
              <Text style={styles.selectText}>
                {selected[item.id] ? 'Selected' : 'Select asset'}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  heading: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 16,
  },
  card: {
    width: 220,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#0f0c13',
    marginLeft: 16,
    gap: 4,
  },
  name: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  meta: {
    color: '#bdbdbd',
    fontSize: 12,
  },
  linkButton: {
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  linkText: {
    color: '#3dffb8',
    textAlign: 'center',
    fontWeight: '600',
  },
  selectButton: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  selectButtonActive: {
    backgroundColor: '#3dffb8',
  },
  selectText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
});
