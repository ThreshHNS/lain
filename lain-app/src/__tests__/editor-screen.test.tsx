import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ActionSheetIOS, Platform } from 'react-native';
import type { ReactNode } from 'react';

import EditorScreen from '@/app/editor';
import { PromptSessionApiError } from '@/lib/api/prompt-session';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockGetDocumentAsync = jest.fn();
const mockAppendPromptMessage = jest.fn();
const mockCreatePromptSession = jest.fn();
const mockFetchPromptMessages = jest.fn();
const mockRespondToPrompt = jest.fn();
const mockTranscribeVoiceRecording = jest.fn();
const mockUpsertSceneRuntime = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockRuntime = {
  frameStatus: 'ready',
  lastState: null,
  lastUpdatedAt: null,
};
const originalPlatform = Platform.OS;
const originalWindow = globalThis.window;
let mockParams: Record<string, string> = { mode: 'slasher' };

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

async function renderEditorScreen() {
  render(<EditorScreen />);

  await waitFor(() => {
    expect(screen.getByText('backend ready')).toBeTruthy();
  });
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
  Link.Menu = () => null;
  Link.MenuAction = () => null;
  Link.Preview = () => null;

  return {
    Link,
    Stack: {
      Screen,
      Toolbar,
    },
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({
      back: mockBack,
      push: mockPush,
    }),
  };
});

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock('@/lib/api/prompt-session', () => {
  const actual = jest.requireActual('@/lib/api/prompt-session');

  return {
    ...actual,
    appendPromptMessage: (...args: unknown[]) => mockAppendPromptMessage(...args),
    createPromptSession: (...args: unknown[]) => mockCreatePromptSession(...args),
    fetchPromptMessages: (...args: unknown[]) => mockFetchPromptMessages(...args),
    respondToPrompt: (...args: unknown[]) => mockRespondToPrompt(...args),
    transcribeVoiceRecording: (...args: unknown[]) => mockTranscribeVoiceRecording(...args),
  };
});

jest.mock('@/context/scene-runtime-context', () => ({
  SceneRuntimeProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useSceneRuntime: () => ({
    clearSceneRuntime: jest.fn(),
    runtime: mockRuntime,
    upsertSceneRuntime: mockUpsertSceneRuntime,
  }),
}));

jest.mock('@/context/editor-preferences-context', () => ({
  EditorPreferencesProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useEditorPreferences: () => ({
    preferences: {
      defaultSlotHint: 'walk',
      preferredAssistantId: 'codex',
      showPromptHistoryPreview: true,
      showStatusPills: true,
    },
    preferencesHydrated: true,
    resetPreferences: jest.fn(),
    updatePreferences: mockUpdatePreferences,
  }),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Image: (props: { testID?: string }) => <View testID={props.testID ?? 'mock-expo-image'} />,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LinearGradient: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/components/scene-frame', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return function MockSceneFrame(props: {
    editorBackdropActive?: boolean;
    hideSceneChrome?: boolean;
    interactive?: boolean;
    onRetry?: () => void;
    retryTestID?: string;
    statusTestID?: string;
    testID?: string;
    uri: string;
  }) {
    return (
      <View testID={props.testID}>
        <Text testID="editor-scene-backdrop-active">{String(props.editorBackdropActive)}</Text>
        <Text testID="editor-scene-hide-chrome">{String(props.hideSceneChrome)}</Text>
        <Text testID="editor-scene-uri">{props.uri}</Text>
        <Text testID="editor-scene-interactive">{String(props.interactive)}</Text>
        {props.statusTestID ? <Text testID={`${props.statusTestID}-ready`}>ready</Text> : null}
        {props.onRetry && props.retryTestID ? (
          <Pressable onPress={props.onRetry} testID={props.retryTestID}>
            <Text>Retry</Text>
          </Pressable>
        ) : null}
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
    mockPush.mockClear();
    mockGetDocumentAsync.mockReset();
    mockAppendPromptMessage.mockReset();
    mockCreatePromptSession.mockReset();
    mockFetchPromptMessages.mockReset();
    mockRespondToPrompt.mockReset();
    mockTranscribeVoiceRecording.mockReset();
    mockUpsertSceneRuntime.mockReset();
    mockUpdatePreferences.mockReset();
    mockGetDocumentAsync.mockResolvedValue({ assets: [], canceled: true });
    mockCreatePromptSession.mockResolvedValue({
      createdAt: '2026-03-25T10:00:00.000Z',
      creatorId: 'local-creator',
      id: 'session-1',
      latestResponseId: null,
      status: 'active',
      title: 'Scene editor draft',
    });
    mockFetchPromptMessages.mockResolvedValue([]);
    mockAppendPromptMessage.mockResolvedValue({
      createdAt: '2026-03-25T10:00:01.000Z',
      id: 'message-1',
      role: 'user',
      sessionId: 'session-1',
      slot: 'walk',
      source: 'text',
      text: 'hello',
    });
    mockRespondToPrompt.mockResolvedValue({
      message: {
        createdAt: '2026-03-25T10:00:02.000Z',
        id: 'assistant-1',
        role: 'assistant',
        sessionId: 'session-1',
        slot: 'walk',
        source: 'codex',
        text: 'reply',
      },
      model: 'stub',
    });
    mockTranscribeVoiceRecording.mockResolvedValue({
      model: 'gpt-4o-mini-transcribe',
      text: 'tighten the chase beat and keep the camera lower',
    });
    mockRuntime.frameStatus = 'ready';
    mockRuntime.lastState = null;
    mockRuntime.lastUpdatedAt = null;
    mockParams = { mode: 'slasher' };
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  it('renders the chat-first editor controls for the selected scene', async () => {
    await renderEditorScreen();

    expect(screen.getByTestId('editor-chat-shell')).toBeTruthy();
    expect(screen.getByTestId('editor-scene-overlay-transition')).toBeTruthy();
    expect(screen.getByTestId('editor-scene-progressive-blur')).toBeTruthy();
    expect(screen.getByTestId('editor-chat-top-shadow')).toBeTruthy();
    expect(screen.getByTestId('editor-composer-progressive-blur')).toBeTruthy();
    expect(screen.getByTestId('editor-scene-backdrop-active').props.children).toBe('true');
    expect(screen.getByTestId('editor-scene-hide-chrome').props.children).toBe('true');
    expect(screen.getByTestId('editor-scene-uri').props.children).toContain('/slasher/');
    expect(screen.getByTestId('editor-scene-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('editor-scene-interactive').props.children).toBe('true');
    expect(screen.getByTestId('editor-scene-frame-status-ready')).toBeTruthy();
    expect(screen.getByTestId('editor-sheet-title').props.children).toBe('Slasher');
    expect(screen.getByTestId('editor-live-count')).toBeTruthy();
    expect(screen.getByTestId('editor-settings-button')).toBeTruthy();
    expect(screen.getByTestId('editor-close-button')).toBeTruthy();
    expect(screen.getByTestId('editor-history-link')).toBeTruthy();
    expect(screen.getByTestId('editor-prompt-input')).toBeTruthy();
    expect(screen.getByTestId('editor-composer-status')).toBeTruthy();
    expect(screen.getByTestId('editor-voice-button')).toBeTruthy();
    expect(screen.queryByTestId('editor-asset-preview-row')).toBeNull();
  });

  it('shows the offline backend hint when prompt session bootstrap fails', async () => {
    mockCreatePromptSession.mockRejectedValue(
      new PromptSessionApiError('Prompt session backend is unreachable', {
        kind: 'network',
      }),
    );

    render(<EditorScreen />);

    expect(
      await screen.findByText(/Prompt session backend is unreachable/i),
    ).toBeTruthy();
    expect(screen.getByTestId('editor-session-retry-button')).toBeTruthy();
  });

  it('reuses the presented game scene when editor opens as an overlay', async () => {
    mockParams = {
      mode: 'slasher',
      overlayScene: '1',
    };

    await renderEditorScreen();

    expect(screen.getByTestId('editor-scene-overlay-transition')).toBeTruthy();
    expect(screen.getByTestId('editor-scene-progressive-blur')).toBeTruthy();
    expect(screen.getByTestId('editor-chat-top-shadow')).toBeTruthy();
    expect(screen.getByTestId('editor-composer-progressive-blur')).toBeTruthy();
    expect(screen.queryByTestId('editor-scene-frame')).toBeNull();
  });

  it('opens the native iOS tools menu from the input overflow action', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const actionSheetSpy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});

    await renderEditorScreen();

    fireEvent.press(screen.getByTestId('editor-tools-button'));

    expect(actionSheetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Capture workflows and agent playbooks',
        options: expect.arrayContaining(['Image2sprite', 'scene-director.md', 'Cancel']),
        title: 'Quick tools',
      }),
      expect.any(Function),
    );
  });

  it('falls back to the custom tools sheet from the input overflow action on non-iOS', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    await renderEditorScreen();

    fireEvent.press(screen.getByTestId('editor-tools-button'));

    expect(screen.getByTestId('editor-tools-sheet')).toBeTruthy();
  });

  it('opens editor settings as a separate stack screen from the header action', async () => {
    await renderEditorScreen();

    fireEvent.press(screen.getByTestId('editor-settings-button'));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/editor-settings',
        params: expect.objectContaining({
          assistantLabel: 'Codex',
          mode: 'slasher',
          title: 'Slasher',
        }),
      }),
    );
    expect(screen.queryByTestId('editor-tools-sheet')).toBeNull();
  });

  it('closes the editor from the native header action', async () => {
    await renderEditorScreen();

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

    await renderEditorScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('editor-assets-button'));
    });

    expect(mockGetDocumentAsync).toHaveBeenCalled();
    expect(screen.getByTestId('editor-asset-preview-row')).toBeTruthy();
    expect(screen.getByText('boss.glb')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('remove boss.glb'));

    expect(screen.queryByText('boss.glb')).toBeNull();
  });

  it('transcribes recorded voice and sends the transcript through the assistant pipeline', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    installWebKeydownListener();

    await renderEditorScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('editor-voice-button'));
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('editor-voice-button'));
    });

    await waitFor(() => {
      expect(mockTranscribeVoiceRecording).toHaveBeenCalledWith('file://mock-voice', {
        prompt: expect.stringContaining('walk'),
      });
    });

    await waitFor(() => {
      expect(mockAppendPromptMessage).toHaveBeenCalledWith(
        'session-1',
        'tighten the chase beat and keep the camera lower',
        'walk',
        'voice',
      );
    });

    await waitFor(() => {
      expect(mockRespondToPrompt).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          assistantLabel: 'Codex',
          slot: 'walk',
          text: 'tighten the chase beat and keep the camera lower',
        }),
      );
    });
  });

  it('handles web keyboard shortcuts for the editor shell', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const pressKey = installWebKeydownListener();

    await renderEditorScreen();

    act(() => {
      pressKey('Escape');
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it('renders service orchestrator replies as markdown without the glass bubble', async () => {
    jest.useFakeTimers();
    mockRespondToPrompt.mockResolvedValue({
      message: {
        createdAt: '2026-03-25T10:00:02.000Z',
        id: 'assistant-orchestrator-1',
        role: 'assistant',
        sessionId: 'session-1',
        slot: 'walk',
        source: 'service-orchestrator',
        text: '# Plan\n\n- Call image2sprite\n- Queue background job',
      },
      model: 'stub',
    });

    await renderEditorScreen();

    fireEvent.changeText(screen.getByTestId('editor-prompt-input'), 'route this through orchestration');

    await act(async () => {
      fireEvent.press(screen.getByTestId('editor-send-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('editor-orchestrator-message')).toBeTruthy();
      expect(screen.getByTestId('editor-orchestrator-markdown')).toBeTruthy();
    });

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByText(/Call image2sprite/i)).toBeTruthy();

    jest.useRealTimers();
  });
});
