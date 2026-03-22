import { buildSceneUrl, resolveMode } from '@/lib/scene-config';

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
    expect(resolveMode('broken')).toBe('awp');
    expect(resolveMode(null)).toBe('awp');
  });

  it('builds scene urls with cache bust and optional asset overrides', () => {
    process.env.EXPO_PUBLIC_TARGET_IMAGE_URL = 'https://cdn.example.com/target.png';
    process.env.EXPO_PUBLIC_AWP_MUSIC_URL = 'https://cdn.example.com/awp.mp3';
    process.env.EXPO_PUBLIC_SLASHER_MUSIC_URL = 'https://cdn.example.com/slasher.mp3';

    const url = new URL(
      buildSceneUrl('https://example.com/lain/?still=1', 'slasher', 42, {
        embedded: true,
        variant: 'preview',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://example.com/lain/');
    expect(url.searchParams.get('still')).toBe('1');
    expect(url.searchParams.get('embedded')).toBe('1');
    expect(url.searchParams.get('mode')).toBe('slasher');
    expect(url.searchParams.get('preview')).toBe('1');
    expect(url.searchParams.get('v')).toBe('42');
    expect(url.searchParams.get('targetImage')).toBe('https://cdn.example.com/target.png');
    expect(url.searchParams.get('awpMusic')).toBe('https://cdn.example.com/awp.mp3');
    expect(url.searchParams.get('slasherMusic')).toBe('https://cdn.example.com/slasher.mp3');
  });
});
