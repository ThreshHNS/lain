import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import GameScreen from '@/app/game';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockLocationAssign = jest.fn();
const mockUpsertSceneRuntime = jest.fn();
const originalPlatform = Platform.OS;
const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
let mockIsFocused = true;

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
    location: {
      assign: mockLocationAssign,
      href: 'https://example.com/app/',
    },
    removeEventListener: jest.fn(),
  };
  const mockDocument = {
    querySelector: jest.fn(() => null),
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: mockWindow,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: mockDocument,
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
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({
    mode: 'slasher',
  }),
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
}));

jest.mock('@/context/scene-runtime-context', () => ({
  SceneRuntimeProvider: ({ children }: { children?: unknown }) => children ?? null,
  useSceneRuntime: () => ({
    clearSceneRuntime: jest.fn(),
    runtime: {
      frameStatus: 'idle',
      lastState: null,
      lastUpdatedAt: null,
    },
    upsertSceneRuntime: mockUpsertSceneRuntime,
  }),
}));

jest.mock('@/components/scene-frame', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return function MockSceneFrame(props: {
    editorBackdropActive?: boolean;
    hideSceneChrome?: boolean;
    interactive?: boolean;
    muted?: boolean;
    testID?: string;
    uri: string;
  }) {
    return (
      <View testID={props.testID}>
        <Text testID="game-scene-backdrop-active">{String(props.editorBackdropActive)}</Text>
        <Text testID="game-scene-hide-chrome">{String(props.hideSceneChrome)}</Text>
        <Text testID="game-scene-uri">{props.uri}</Text>
        <Text testID="game-scene-interactive">{String(props.interactive)}</Text>
        <Text testID="game-scene-muted">{String(props.muted)}</Text>
      </View>
    );
  };
});

jest.mock('@/components/scene-opening-intro', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockSceneOpeningIntro(props: {
    scene: {
      intro: { title: string };
      label: string;
    };
  }) {
    return (
      <Text testID="game-scene-opening-intro">
        {props.scene.label}:{props.scene.intro.title}
      </Text>
    );
  };
});

describe('GameScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockLocationAssign.mockClear();
    mockUpsertSceneRuntime.mockClear();
    mockIsFocused = true;
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  it('renders the selected scene in embedded game mode', () => {
    render(<GameScreen />);

    expect(screen.getByTestId('game-scene-uri').props.children).toContain('/slasher/');
    expect(screen.getByTestId('game-scene-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('game-scene-uri').props.children).not.toContain('preview=1');
    expect(screen.getByTestId('game-scene-backdrop-active').props.children).toBe('false');
    expect(screen.getByTestId('game-scene-hide-chrome').props.children).toBe('true');
    expect(screen.getByTestId('game-scene-interactive').props.children).toBe('true');
    expect(screen.getByTestId('game-scene-muted').props.children).toBe('false');
    expect(screen.getByText('Slasher:#ImSippinTeaInYoHood')).toBeTruthy();
  });

  it('toggles scene audio from the mute control', () => {
    render(<GameScreen />);

    fireEvent.press(screen.getByTestId('game-mute-button'));
    expect(screen.getByTestId('game-scene-muted').props.children).toBe('true');

    fireEvent.press(screen.getByTestId('game-mute-button'));
    expect(screen.getByTestId('game-scene-muted').props.children).toBe('false');
  });

  it('opens the editor as an overlay on native so the current scene can stay mounted', () => {
    render(<GameScreen />);

    fireEvent.press(screen.getByTestId('game-edit-button'));

    expect(screen.queryByTestId('game-scene-opening-intro')).toBeNull();
    expect(screen.queryByTestId('game-mute-button')).toBeNull();
    expect(screen.queryByTestId('game-edit-button')).toBeNull();
    expect(screen.queryByTestId('game-close-button')).toBeNull();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/editor',
      params: {
        mode: 'slasher',
        overlayScene: '1',
      },
    });
  });

  it('hides scene controls while the game screen is not focused', () => {
    mockIsFocused = false;

    render(<GameScreen />);

    expect(screen.queryByTestId('game-mute-button')).toBeNull();
    expect(screen.queryByTestId('game-edit-button')).toBeNull();
    expect(screen.queryByTestId('game-close-button')).toBeNull();
  });

  it('handles web keyboard shortcuts for shell actions outside the iframe', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const pressKey = installWebKeydownListener();

    render(<GameScreen />);

    act(() => {
      pressKey('e');
    });

    expect(mockLocationAssign).toHaveBeenCalledWith('/app/editor?mode=slasher');

    act(() => {
      pressKey('Escape');
    });

    expect(mockLocationAssign).toHaveBeenCalledWith('https://example.com/app/');
  });
});
