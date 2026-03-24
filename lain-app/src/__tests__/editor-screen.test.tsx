import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import type { ReactNode } from 'react';

import EditorScreen from '@/app/editor';

const mockBack = jest.fn();
const mockGetDocumentAsync = jest.fn();
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

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Link = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const Screen = () => null;
  Screen.Title = ({ children }: { children?: ReactNode }) => <Text testID="editor-sheet-title">{children}</Text>;
  const Toolbar = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Toolbar.View = ({ children }: { children?: ReactNode }) => <>{children}</>;

  Link.Trigger = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Link.Preview = () => null;

  return {
    Link,
    Stack: {
      Screen,
      Toolbar,
    },
    useLocalSearchParams: () => ({
      mode: 'slasher',
    }),
    useRouter: () => ({
      back: mockBack,
    }),
  };
});

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Image: (props: { testID?: string }) => <View testID={props.testID ?? 'mock-expo-image'} />,
  };
});

jest.mock('@/components/scene-frame', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return function MockSceneFrame(props: {
    interactive?: boolean;
    testID?: string;
    uri: string;
  }) {
    return (
      <View testID={props.testID}>
        <Text testID="editor-scene-uri">{props.uri}</Text>
        <Text testID="editor-scene-interactive">{String(props.interactive)}</Text>
      </View>
    );
  };
});

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('EditorScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockGetDocumentAsync.mockReset();
    mockGetDocumentAsync.mockResolvedValue({ assets: [], canceled: true });
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  it('renders the chat-first editor controls for the selected scene', () => {
    render(<EditorScreen />);

    expect(screen.getByTestId('editor-chat-shell')).toBeTruthy();
    expect(screen.getByTestId('editor-scene-uri').props.children).toContain('/slasher/');
    expect(screen.getByTestId('editor-scene-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('editor-scene-interactive').props.children).toBe('true');
    expect(screen.getByTestId('editor-sheet-title').props.children).toBe('Slasher');
    expect(screen.getByTestId('editor-live-count')).toBeTruthy();
    expect(screen.getByTestId('editor-settings-button')).toBeTruthy();
    expect(screen.getByTestId('editor-close-button')).toBeTruthy();
    expect(screen.getByTestId('editor-history-link')).toBeTruthy();
    expect(screen.getByTestId('editor-prompt-input')).toBeTruthy();
    expect(screen.getByTestId('editor-voice-button')).toBeTruthy();
    expect(screen.queryByTestId('editor-asset-preview-row')).toBeNull();
  });

  it('opens the tools sheet from the header settings action', () => {
    render(<EditorScreen />);

    fireEvent.press(screen.getByTestId('editor-settings-button'));

    expect(screen.getByTestId('editor-tools-sheet')).toBeTruthy();
  });

  it('closes the editor from the native header action', () => {
    render(<EditorScreen />);

    fireEvent.press(screen.getByTestId('editor-close-button'));

    expect(mockBack).toHaveBeenCalled();
  });

  it('attaches uploaded files and shows them next to the assistant picker', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      assets: [
        {
          mimeType: 'model/gltf-binary',
          name: 'boss.glb',
          size: 1024,
          uri: 'file:///boss.glb',
        },
      ],
      canceled: false,
    });

    render(<EditorScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('editor-assets-button'));
    });

    expect(mockGetDocumentAsync).toHaveBeenCalled();
    expect(screen.getByTestId('editor-asset-preview-row')).toBeTruthy();
    expect(screen.getByText('boss.glb')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('remove boss.glb'));

    expect(screen.queryByText('boss.glb')).toBeNull();
  });

  it('handles web keyboard shortcuts for the editor shell', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const pressKey = installWebKeydownListener();

    render(<EditorScreen />);

    act(() => {
      pressKey('Escape');
    });

    expect(mockBack).toHaveBeenCalled();
  });
});
