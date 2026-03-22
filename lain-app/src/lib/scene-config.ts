export type Mode = 'awp' | 'slasher';
export type SceneVariant = 'game' | 'preview';

export type SceneOption = {
  id: Mode;
  label: string;
  subtitle: string;
  touchHint: string;
};

export const DEFAULT_SCENE_BASE_URL =
  process.env.EXPO_PUBLIC_SCENE_BASE_URL ?? 'https://threshhns.github.io/lain/';

export const MODE_OPTIONS: SceneOption[] = [
  { id: 'awp', label: 'AWP', subtitle: 'one shot fantasy', touchHint: 'tap to shoot' },
  { id: 'slasher', label: 'Slasher', subtitle: 'close range pressure', touchHint: 'touch + hold move' },
];

export function resolveMode(input?: string | null): Mode {
  return input === 'slasher' ? 'slasher' : 'awp';
}

function normalizeBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

export function getSceneOption(mode: Mode) {
  return MODE_OPTIONS.find(option => option.id === mode) ?? MODE_OPTIONS[0];
}

type BuildSceneUrlOptions = {
  embedded?: boolean;
  variant?: SceneVariant;
};

export function buildSceneUrl(
  baseUrl: string,
  mode: Mode,
  version: number,
  options: BuildSceneUrlOptions = {},
) {
  const url = new URL(normalizeBaseUrl(baseUrl));
  const { embedded = false, variant = 'game' } = options;

  url.searchParams.set('mode', mode);
  url.searchParams.set('v', String(version));

  if (embedded) {
    url.searchParams.set('embedded', '1');
  }
  if (variant === 'preview') {
    url.searchParams.set('preview', '1');
    url.searchParams.set('still', '1');
  } else {
    url.searchParams.delete('preview');
  }

  const targetImage = process.env.EXPO_PUBLIC_TARGET_IMAGE_URL;
  const awpMusic = process.env.EXPO_PUBLIC_AWP_MUSIC_URL;
  const slasherMusic = process.env.EXPO_PUBLIC_SLASHER_MUSIC_URL;

  if (targetImage) {
    url.searchParams.set('targetImage', targetImage);
  }
  if (awpMusic) {
    url.searchParams.set('awpMusic', awpMusic);
  }
  if (slasherMusic) {
    url.searchParams.set('slasherMusic', slasherMusic);
  }

  return url.toString();
}
