import type { ColorSchemeName } from 'react-native';

export type EditorPalette = {
  accent: string;
  accentMuted: string;
  accentText: string;
  border: string;
  card: string;
  chip: string;
  mutedText: string;
  screen: string;
  strongText: string;
};

const DARK_PALETTE: EditorPalette = {
  accent: '#d8f7e8',
  accentMuted: 'rgba(216,247,232,0.14)',
  accentText: '#08110d',
  border: 'rgba(255,255,255,0.12)',
  card: 'rgba(14,16,19,0.84)',
  chip: 'rgba(255,255,255,0.08)',
  mutedText: 'rgba(255,244,235,0.66)',
  screen: '#050608',
  strongText: '#fff7f1',
};

const LIGHT_PALETTE: EditorPalette = {
  accent: '#1d7f5b',
  accentMuted: 'rgba(29,127,91,0.12)',
  accentText: '#ffffff',
  border: 'rgba(19,24,28,0.1)',
  card: 'rgba(255,255,255,0.86)',
  chip: 'rgba(19,24,28,0.06)',
  mutedText: 'rgba(27,32,36,0.62)',
  screen: '#f3f5f7',
  strongText: '#151a1e',
};

export function getEditorPalette(colorScheme: ColorSchemeName) {
  return colorScheme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}
