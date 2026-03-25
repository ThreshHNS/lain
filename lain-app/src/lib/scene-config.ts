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

export type SceneIntro = {
  accent: string;
  ambient: string;
  artist: string;
  coverBase: string;
  coverGlow: string;
  coverInk: string;
  coverTag: string;
  kicker: string;
  title: string;
};

export type SceneOption = {
  id: Mode;
  intro: SceneIntro;
  label: string;
  subtitle: string;
  touchHint: string;
};

export const DEFAULT_SCENE_BASE_URL =
  process.env.EXPO_PUBLIC_SCENE_BASE_URL ?? './scenes/';

export const MODE_OPTIONS: SceneOption[] = [
  {
    id: 'awp',
    intro: {
      accent: '#ff9e57',
      ambient: '#cddaf0',
      artist: 'Playboi Carti',
      coverBase: '#172030',
      coverGlow: 'rgba(255,158,87,0.42)',
      coverInk: '#fff5eb',
      coverTag: 'AWP',
      kicker: 'Long range lock. One clean hit.',
      title: 'Die4Guy',
    },
    label: 'AWP',
    subtitle: 'one shot fantasy',
    touchHint: 'tap to shoot',
  },
  {
    id: 'slasher',
    intro: {
      accent: '#ff5b61',
      ambient: '#16070a',
      artist: 'Xxxtentacion',
      coverBase: '#18060d',
      coverGlow: 'rgba(255,91,97,0.4)',
      coverInk: '#fff0f1',
      coverTag: 'SLSH',
      kicker: 'Push in. Cut fast. Keep moving.',
      title: '#ImSippinTeaInYoHood',
    },
    label: 'Slasher',
    subtitle: 'close range pressure',
    touchHint: 'touch + hold move',
  },
  {
    id: 'default-scene',
    intro: {
      accent: '#7db1ff',
      ambient: '#0e1625',
      artist: 'Scene Loader',
      coverBase: '#11192b',
      coverGlow: 'rgba(125,177,255,0.34)',
      coverInk: '#edf4ff',
      coverTag: 'VOID',
      kicker: 'A quiet tunnel before the drop.',
      title: 'Ghost Tunnel',
    },
    label: 'Penguin Tunnel',
    subtitle: 'dark void',
    touchHint: 'just watch',
  },
  {
    id: 'dust2',
    intro: {
      accent: '#f8ba6f',
      ambient: '#2d2417',
      artist: 'Arena Memory',
      coverBase: '#2c2115',
      coverGlow: 'rgba(248,186,111,0.3)',
      coverInk: '#fff5e9',
      coverTag: 'D2',
      kicker: 'Arena pressure with sand in the air.',
      title: 'Dust Echoes',
    },
    label: 'Dust2',
    subtitle: 'arena brawler',
    touchHint: 'drag move, tap attack',
  },
  {
    id: 'meow-3',
    intro: {
      accent: '#8fd1ff',
      ambient: '#0d1428',
      artist: 'Cathedral Drift',
      coverBase: '#151f3a',
      coverGlow: 'rgba(143,209,255,0.3)',
      coverInk: '#eef8ff',
      coverTag: 'ME3',
      kicker: 'Orbit loose. Break the rhythm gently.',
      title: 'Orbit Mews',
    },
    label: 'Meow Arena',
    subtitle: 'surreal orbit',
    touchHint: 'drag rotate, tap cycle',
  },
  {
    id: 'meowww',
    intro: {
      accent: '#b9a0ff',
      ambient: '#151024',
      artist: 'Maze Wakes',
      coverBase: '#1d1630',
      coverGlow: 'rgba(185,160,255,0.3)',
      coverInk: '#f5f0ff',
      coverTag: 'MWW',
      kicker: 'Stay mobile. Let the loop collapse.',
      title: 'Dark Lab',
    },
    label: 'Dark Labyrinth',
    subtitle: 'endless waves',
    touchHint: 'wasd + space',
  },
  {
    id: 'psx-babylon-scene',
    intro: {
      accent: '#7ff0cf',
      ambient: '#0b1716',
      artist: 'Bootleg Runner',
      coverBase: '#13211f',
      coverGlow: 'rgba(127,240,207,0.28)',
      coverInk: '#effff8',
      coverTag: 'PSX',
      kicker: 'Reference pass with sharp edges intact.',
      title: 'PSX Showcase',
    },
    label: 'PSX Showcase',
    subtitle: 'reference demo',
    touchHint: 'wasd to move',
  },
  {
    id: 'tomato-guard',
    intro: {
      accent: '#ff8a65',
      ambient: '#28140e',
      artist: '$uicideboy$',
      coverBase: '#24130f',
      coverGlow: 'rgba(255,138,101,0.3)',
      coverInk: '#fff2ec',
      coverTag: 'TGRD',
      kicker: 'Hold the lane. Don’t let the field fold.',
      title: '1000 Blunts',
    },
    label: 'Tomato Guard',
    subtitle: 'field defense',
    touchHint: 'drag move, tap hit',
  },
  {
    id: 'tomato-grid',
    intro: {
      accent: '#8ae4ff',
      ambient: '#0e1820',
      artist: 'C4FF31N3',
      coverBase: '#131f2b',
      coverGlow: 'rgba(138,228,255,0.28)',
      coverInk: '#eefbff',
      coverTag: 'GRID',
      kicker: 'Tile timing and nervous repetition.',
      title: 'lain - 01 lain',
    },
    label: 'Tomato Grid',
    subtitle: 'tile timing',
    touchHint: 'tap d-pad + hit',
  },
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
