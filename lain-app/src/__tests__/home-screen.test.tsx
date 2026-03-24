import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import HomeScreen from '@/app/(tabs)/index';

const mockPush = jest.fn();
const originalPlatform = Platform.OS;
const originalWindow = globalThis.window;
const originalE2EDebug = process.env.EXPO_PUBLIC_E2E_DEBUG;

type MockKeyboardEvent = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'defaultPrevented' | 'key' | 'metaKey' | 'preventDefault' | 'target'
>;

function installWebKeydownListener() {
  let keydownListener: ((event: KeyboardEvent) => void) | null = null;
  const mockWindow = {
    addEventListener: jest.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'keydown') {
        keydownListener = listener as (event: KeyboardEvent) => void;
      }
    }),
    removeEventListener: jest.fn(),
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: mockWindow,
  });

  return (key: string, overrides: Partial<MockKeyboardEvent> = {}) => {
    if (!keydownListener) {
      throw new Error('keydown listener was not registered');
    }

    keydownListener({
      altKey: false,
      ctrlKey: false,
      defaultPrevented: false,
      key,
      metaKey: false,
      preventDefault: jest.fn(),
      target: null,
      ...overrides,
    } as KeyboardEvent);
  };
}

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/components/scene-feed-card', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return function MockSceneFeedCard(props: {
    active: boolean;
    onOpenScene: (mode: string) => void;
    scene: {
      id: string;
      label: string;
    };
    uri: string;
  }) {
    return (
      <View testID={`scene-card-${props.scene.id}`}>
        <Text testID={`scene-preview-${props.scene.id}-uri`}>{props.uri}</Text>
        <Text testID={`scene-card-${props.scene.id}-active`}>{String(props.active)}</Text>
        <Pressable
          onPress={() => props.onOpenScene(props.scene.id)}
          testID={`scene-open-${props.scene.id}`}>
          <Text>{props.scene.label}</Text>
        </Pressable>
      </View>
    );
  };
});

describe('HomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.restoreAllMocks();
    process.env.EXPO_PUBLIC_E2E_DEBUG = originalE2EDebug;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_E2E_DEBUG = originalE2EDebug;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  it('renders preview urls for both scenes in embedded preview mode', () => {
    render(<HomeScreen />);

    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('/awp/');
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('preview=1');
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('still=1');

    expect(screen.getByTestId('scene-preview-slasher-uri').props.children).toContain('/slasher/');
    expect(screen.getByTestId('scene-preview-slasher-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('scene-preview-slasher-uri').props.children).toContain('preview=1');
    expect(screen.getByTestId('scene-preview-slasher-uri').props.children).toContain('still=1');

    expect(screen.getByTestId('scene-preview-tomato-guard-uri').props.children).toContain(
      '/tomato-guard/',
    );
    expect(screen.getByTestId('scene-preview-tomato-guard-uri').props.children).toContain(
      'embedded=1',
    );
    expect(screen.getByTestId('scene-preview-tomato-guard-uri').props.children).toContain(
      'preview=1',
    );
    expect(screen.getByTestId('scene-preview-tomato-guard-uri').props.children).toContain(
      'still=1',
    );

    expect(screen.getByTestId('scene-preview-tomato-grid-uri').props.children).toContain(
      '/tomato-grid/',
    );
    expect(screen.getByTestId('scene-preview-tomato-grid-uri').props.children).toContain(
      'embedded=1',
    );
    expect(screen.getByTestId('scene-preview-tomato-grid-uri').props.children).toContain(
      'preview=1',
    );
    expect(screen.getByTestId('scene-preview-tomato-grid-uri').props.children).toContain(
      'still=1',
    );
  });

  it('opens gameplay mode from the active scene card', () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('scene-open-slasher'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game',
      params: { mode: 'slasher' },
    });
  });

  it('removes the legacy top rail and keeps only feed chrome', () => {
    render(<HomeScreen />);

    expect(screen.queryByTestId('home-open-scene-lab-button')).toBeNull();
    expect(screen.queryByTestId('scene-tv-prev-button')).toBeNull();
    expect(screen.queryByTestId('scene-tv-play-button')).toBeNull();
    expect(screen.queryByTestId('scene-tv-next-button')).toBeNull();
  });

  it('switches the active scene from the right-side pager', () => {
    render(<HomeScreen />);

    expect(screen.getByTestId('scene-card-awp-active').props.children).toBe('true');

    fireEvent.press(screen.getByTestId('scene-feed-dot-slasher'));

    expect(screen.getByTestId('scene-card-slasher-active').props.children).toBe('true');
    fireEvent.press(screen.getByTestId('scene-open-slasher'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game',
      params: { mode: 'slasher' },
    });
  });

  it('handles web keyboard controls for the scene reel outside the iframe', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const pressKey = installWebKeydownListener();

    render(<HomeScreen />);

    expect(screen.getByTestId('scene-card-awp-active').props.children).toBe('true');

    act(() => {
      pressKey('ArrowDown');
    });

    expect(screen.getByTestId('scene-card-slasher-active').props.children).toBe('true');

    act(() => {
      pressKey('Enter');
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game',
      params: { mode: 'slasher' },
    });
  });

  it('renders the debug harness and switches the active mode when e2e debug is enabled', () => {
    process.env.EXPO_PUBLIC_E2E_DEBUG = '1';

    render(<HomeScreen />);

    expect(screen.getByTestId('scene-version-label')).toBeTruthy();
    expect(screen.getByTestId('scene-card-awp-active').props.children).toBe('true');

    fireEvent.press(screen.getByTestId('scene-feed-dot-slasher'));
    expect(screen.getByTestId('scene-card-slasher-active').props.children).toBe('true');

    fireEvent.press(screen.getByTestId('scene-open-slasher'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game',
      params: { mode: 'slasher' },
    });
  });

  it('can break and reload the active preview from the debug harness', () => {
    process.env.EXPO_PUBLIC_E2E_DEBUG = '1';

    render(<HomeScreen />);

    const initialUri = screen.getByTestId('scene-preview-awp-uri').props.children as string;
    expect(initialUri).toContain('/awp/');
    expect(initialUri).not.toContain('example.invalid');

    fireEvent.press(screen.getByTestId('scene-break-button'));
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('example.invalid');

    fireEvent.press(screen.getByTestId('scene-reload-button'));
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('/awp/');
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).not.toContain(
      'example.invalid',
    );
  });
});
