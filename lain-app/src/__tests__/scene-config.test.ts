import { buildSceneUrl, getSceneOption, resolveMode } from '@/lib/scene-config';

describe('scene-config', () => {
  const originalTargetImage = process.env.EXPO_PUBLIC_TARGET_IMAGE_URL;
  const originalAwpMusic = process.env.EXPO_PUBLIC_AWP_MUSIC_URL;
  const originalSlasherMusic = process.env.EXPO_PUBLIC_SLASHER_MUSIC_URL;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_TARGET_IMAGE_URL;
    delete process.env.EXPO_PUBLIC_AWP_MUSIC_URL;
    delete process.env.EXPO_PUBLIC_SLASHER_MUSIC_URL;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_TARGET_IMAGE_URL = originalTargetImage;
    process.env.EXPO_PUBLIC_AWP_MUSIC_URL = originalAwpMusic;
    process.env.EXPO_PUBLIC_SLASHER_MUSIC_URL = originalSlasherMusic;
  });

  it('falls back to awp for unknown modes', () => {
    expect(resolveMode('awp')).toBe('awp');
    expect(resolveMode('slasher')).toBe('slasher');
    expect(resolveMode('tomato-guard')).toBe('tomato-guard');
    expect(resolveMode('tomato-grid')).toBe('tomato-grid');
    expect(resolveMode('broken')).toBe('awp');
    expect(resolveMode(null)).toBe('awp');
  });

  it('resolves all valid modes', () => {
    expect(resolveMode('dust2')).toBe('dust2');
    expect(resolveMode('default-scene')).toBe('default-scene');
    expect(resolveMode('meow-3')).toBe('meow-3');
    expect(resolveMode('meowww')).toBe('meowww');
    expect(resolveMode('psx-babylon-scene')).toBe('psx-babylon-scene');
    expect(resolveMode('tomato-grid')).toBe('tomato-grid');
    expect(resolveMode('tomato-guard')).toBe('tomato-guard');
  });

  it('builds scene urls with path-based mode and optional asset overrides', () => {
    process.env.EXPO_PUBLIC_TARGET_IMAGE_URL = 'https://cdn.example.com/target.png';
    process.env.EXPO_PUBLIC_AWP_MUSIC_URL = 'https://drive.example.com/awp.mp3';
    process.env.EXPO_PUBLIC_SLASHER_MUSIC_URL = 'https://drive.example.com/slasher.mp3';

    const url = new URL(
      buildSceneUrl('https://example.com/lain/', 'slasher', 42, {
        embedded: true,
        variant: 'preview',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://example.com/lain/slasher/');
    expect(url.searchParams.get('still')).toBe('1');
    expect(url.searchParams.get('embedded')).toBe('1');
    expect(url.searchParams.get('preview')).toBe('1');
    expect(url.searchParams.get('v')).toBe('42');
    expect(url.searchParams.get('targetImage')).toBe('https://cdn.example.com/target.png');
    expect(url.searchParams.get('awpMusic')).toBe('https://drive.example.com/awp.mp3');
    expect(url.searchParams.get('slasherMusic')).toBe('https://drive.example.com/slasher.mp3');
  });

  it('builds direct path urls for new scenes', () => {
    const url = new URL(
      buildSceneUrl('https://example.com/lain/', 'dust2', 99),
    );

    expect(url.origin + url.pathname).toBe('https://example.com/lain/dust2/');
    expect(url.searchParams.get('v')).toBe('99');
    expect(url.searchParams.has('mode')).toBe(false);
  });

  it('returns intro metadata for scene openings', () => {
    expect(getSceneOption('awp').intro.title).toBe('Die4Guy');
    expect(getSceneOption('slasher').intro.artist).toBe('Xxxtentacion');
    expect(getSceneOption('tomato-grid').intro.coverTag).toBe('GRID');
    expect(getSceneOption('tomato-guard').intro.kicker).toContain('Hold the lane');
  });
});
