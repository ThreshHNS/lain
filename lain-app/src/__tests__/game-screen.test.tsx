import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import GameScreen from '@/app/game';

const mockBack = jest.fn();
const mockPush = jest.fn();
const originalPlatform = Platform.OS;
const originalWindow = globalThis.window;

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
  useLocalSearchParams: () => ({
    mode: 'slasher',
  }),
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/components/scene-frame', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return function MockSceneFrame(props: {
    interactive?: boolean;
    muted?: boolean;
    testID?: string;
    uri: string;
  }) {
    return (
      <View testID={props.testID}>
        <Text testID="game-scene-uri">{props.uri}</Text>
        <Text testID="game-scene-interactive">{String(props.interactive)}</Text>
        <Text testID="game-scene-muted">{String(props.muted)}</Text>
      </View>
    );
  };
});

describe('GameScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  it('renders the selected scene in embedded game mode', () => {
    render(<GameScreen />);

    expect(screen.getByTestId('game-scene-uri').props.children).toContain('/slasher/');
    expect(screen.getByTestId('game-scene-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('game-scene-uri').props.children).not.toContain('preview=1');
    expect(screen.getByTestId('game-scene-interactive').props.children).toBe('true');
    expect(screen.getByTestId('game-scene-muted').props.children).toBe('false');
  });

  it('toggles scene audio from the mute control', () => {
    render(<GameScreen />);

    fireEvent.press(screen.getByTestId('game-mute-button'));
    expect(screen.getByTestId('game-scene-muted').props.children).toBe('true');

    fireEvent.press(screen.getByTestId('game-mute-button'));
    expect(screen.getByTestId('game-scene-muted').props.children).toBe('false');
  });

  it('handles web keyboard shortcuts for shell actions outside the iframe', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const pressKey = installWebKeydownListener();

    render(<GameScreen />);

    act(() => {
      pressKey('e');
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/editor',
      params: { mode: 'slasher' },
    });

    act(() => {
      pressKey('Escape');
    });

    expect(mockBack).toHaveBeenCalled();
  });
});
