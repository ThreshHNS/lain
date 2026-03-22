import * as FileSystem from 'expo-file-system';
import type { AssetReference, HistoryEntry, SlotHint } from '@/types/editor';

type ExportParams = {
  title: string;
  slotHint: SlotHint;
  assets: AssetReference[];
  history: HistoryEntry[];
};

export type SceneBundleManifest = {
  title: string;
  slotHint: SlotHint;
  assets: AssetReference[];
  history: HistoryEntry[];
  createdAt: string;
};

export async function exportSceneBundle(params: ExportParams) {
  const manifest: SceneBundleManifest = {
    title: params.title,
    slotHint: params.slotHint,
    assets: params.assets,
    history: params.history,
    createdAt: new Date().toISOString(),
  };

  const filename = `scene-manifest-${Date.now()}.json`;
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(manifest, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { manifest, uri };
}
