export type Mode =
  | 'awp'
  | 'slasher'
  | 'default-scene'
  | 'dust2'
  | 'meow-3'
  | 'meowww'
  | 'psx-babylon-scene'
  | 'tomato-grid'
  | 'tomato-guard';

export type SceneVariant = 'game' | 'preview';

export type SceneOption = {
  id: Mode;
  label: string;
  subtitle: string;
  touchHint: string;
};

export const DEFAULT_SCENE_BASE_URL =
  process.env.EXPO_PUBLIC_SCENE_BASE_URL ?? './scenes/';

export const MODE_OPTIONS: SceneOption[] = [
  { id: 'awp', label: 'AWP', subtitle: 'one shot fantasy', touchHint: 'tap to shoot' },
  { id: 'slasher', label: 'Slasher', subtitle: 'close range pressure', touchHint: 'touch + hold move' },
  { id: 'default-scene', label: 'Penguin Tunnel', subtitle: 'dark void', touchHint: 'just watch' },
  { id: 'dust2', label: 'Dust2', subtitle: 'arena brawler', touchHint: 'drag move, tap attack' },
  { id: 'meow-3', label: 'Meow Arena', subtitle: 'surreal orbit', touchHint: 'drag rotate, tap cycle' },
  { id: 'meowww', label: 'Dark Labyrinth', subtitle: 'endless waves', touchHint: 'wasd + space' },
  { id: 'psx-babylon-scene', label: 'PSX Showcase', subtitle: 'reference demo', touchHint: 'wasd to move' },
  { id: 'tomato-grid', label: 'Tomato Grid', subtitle: 'tower defense', touchHint: 'wasd + space' },
  { id: 'tomato-guard', label: 'Tomato Guard', subtitle: 'farm defense', touchHint: 'drag move, tap attack' },
];

const VALID_MODES = new Set<Mode>(MODE_OPTIONS.map(o => o.id));

export function resolveMode(input?: string | null): Mode {
  if (input && VALID_MODES.has(input as Mode)) return input as Mode;
  return 'awp';
}

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function normalizeBaseUrl(baseUrl: string) {
  if (!isAbsoluteUrl(baseUrl)) {
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }
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
  const base = normalizeBaseUrl(baseUrl);
  const { embedded = false, variant = 'game' } = options;

  const params = new URLSearchParams();
  params.set('v', String(version));

  if (embedded) {
    params.set('embedded', '1');
  }
  if (variant === 'preview') {
    params.set('preview', '1');
    params.set('still', '1');
  }

  const targetImage = process.env.EXPO_PUBLIC_TARGET_IMAGE_URL;
  const awpMusic = process.env.EXPO_PUBLIC_AWP_MUSIC_URL;
  const slasherMusic = process.env.EXPO_PUBLIC_SLASHER_MUSIC_URL;

  if (targetImage) {
    params.set('targetImage', targetImage);
  }
  if (awpMusic) {
    params.set('awpMusic', awpMusic);
  }
  if (slasherMusic) {
    params.set('slasherMusic', slasherMusic);
  }

  const query = params.toString();
  return `${base}${mode}/${query ? `?${query}` : ''}`;
}
