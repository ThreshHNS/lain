import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import type { ReactNode } from 'react';

import EditorSettingsScreen from '@/app/editor-settings';
import type { SceneRuntimeSnapshot } from '@/context/scene-runtime-context';
import type { SceneBridgeState } from '@/lib/runtime/scene-bridge';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockResetPreferences = jest.fn();
const mockShare = jest.fn();
const mockUpdatePreferences = jest.fn();
const READY_RUNTIME_STATE: SceneBridgeState = {
  assetState: 'synced',
  lastAction: 'slice',
  targetState: 'tracking',
};
const mockRuntime: SceneRuntimeSnapshot = {
  frameStatus: 'ready',
  lastState: READY_RUNTIME_STATE,
  lastUpdatedAt: null,
};
let mockParams: Record<string, string> = {
  assistantLabel: 'Codex',
  assistantNote: 'tool-first scene edits',
  mode: 'slasher',
  overlayScene: '1',
  pendingHistoryCount: '2',
  promptSessionId: 'session-42',
  sceneDraftId: 'draft-9',
  sessionStatus: 'ready',
  title: 'Slasher',
};

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
    Toolbar: Object.assign(({ children }: { children?: ReactNode }) => <>{children}</>, {
      View: ({ children }: { children?: ReactNode }) => <>{children}</>,
    }),
  },
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

jest.mock('@/context/scene-runtime-context', () => ({
  SceneRuntimeProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useSceneRuntime: () => ({
    clearSceneRuntime: jest.fn(),
    runtime: mockRuntime,
    upsertSceneRuntime: jest.fn(),
  }),
}));

jest.mock('@/context/editor-preferences-context', () => ({
  DEFAULT_EDITOR_PREFERENCES: {
    defaultSlotHint: 'walk',
    preferredAssistantId: 'codex',
    showPromptHistoryPreview: true,
    showStatusPills: true,
  },
  EditorPreferencesProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useEditorPreferences: () => ({
    preferences: {
      defaultSlotHint: 'walk',
      preferredAssistantId: 'codex',
      showPromptHistoryPreview: true,
      showStatusPills: true,
    },
    preferencesHydrated: true,
    resetPreferences: mockResetPreferences,
    updatePreferences: mockUpdatePreferences,
  }),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LinearGradient: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  };
});

jest.spyOn(Share, 'share').mockImplementation((...args: unknown[]) => mockShare(...args));

describe('EditorSettingsScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockResetPreferences.mockClear();
    mockShare.mockReset();
    mockShare.mockResolvedValue({
      action: Share.sharedAction,
      activityType: undefined,
    });
    mockUpdatePreferences.mockClear();
    mockRuntime.frameStatus = 'ready';
    mockRuntime.lastState = READY_RUNTIME_STATE;
    mockParams = {
      assistantLabel: 'Codex',
      assistantNote: 'tool-first scene edits',
      mode: 'slasher',
      overlayScene: '1',
      pendingHistoryCount: '2',
      promptSessionId: 'session-42',
      sceneDraftId: 'draft-9',
      sessionStatus: 'ready',
      title: 'Slasher',
    };
  });

  it('renders persisted preferences plus live diagnostics and links to prompt history', () => {
    render(<EditorSettingsScreen />);

    expect(screen.getByTestId('editor-settings-screen')).toBeTruthy();
    expect(screen.getByText('Launch defaults')).toBeTruthy();
    expect(screen.getByText(/Tune the assistant, slot, and chrome/i)).toBeTruthy();
    expect(screen.getByText('Saved on this device')).toBeTruthy();
    expect(screen.getByText('Default assistant')).toBeTruthy();
    expect(screen.getByText('Default slot hint')).toBeTruthy();
    expect(screen.getByText('Backend linked')).toBeTruthy();
    expect(screen.getByText('Overlay on live game scene')).toBeTruthy();
    expect(screen.getByText('action slice · target tracking · asset synced')).toBeTruthy();
    expect(screen.getByText('session-42')).toBeTruthy();
    expect(screen.getByText('Connected')).toBeTruthy();

    fireEvent.press(screen.getByTestId('editor-settings-history-button'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/prompt-history',
      params: {
        mode: 'slasher',
        promptSessionId: 'session-42',
        sceneDraftId: 'draft-9',
        title: 'Slasher',
      },
    });

    fireEvent.press(screen.getByTestId('editor-settings-share-button'));

    expect(mockShare).toHaveBeenCalledWith({
      message: expect.stringContaining('Slasher editor settings'),
      title: 'Slasher editor settings',
    });
  });

  it('updates preferences and resets defaults from the settings screen', () => {
    render(<EditorSettingsScreen />);

    fireEvent.press(screen.getByTestId('editor-settings-assistant-gpt-5'));
    fireEvent.press(screen.getByTestId('editor-settings-slot-seed'));
    fireEvent.press(screen.getByTestId('editor-settings-toggle-prompt-history-preview'));
    fireEvent.press(screen.getByTestId('editor-settings-toggle-status-pills'));
    fireEvent.press(screen.getByTestId('editor-settings-reset-button'));

    expect(mockUpdatePreferences).toHaveBeenCalledWith({ preferredAssistantId: 'gpt-5' });
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ defaultSlotHint: 'seed' });
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ showPromptHistoryPreview: false });
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ showStatusPills: false });
    expect(mockResetPreferences).toHaveBeenCalled();
  });

  it('falls back cleanly when route params are missing and closes with Done', () => {
    mockParams = {
      mode: 'awp',
      sessionStatus: 'offline',
    };
    mockRuntime.frameStatus = 'error';
    mockRuntime.lastState = null;

    render(<EditorSettingsScreen />);

    expect(screen.getByText('AWP')).toBeTruthy();
    expect(screen.getByText('Local only')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('Not linked yet')).toBeTruthy();
    expect(screen.getByText('Embedded preview frame')).toBeTruthy();
    expect(screen.getByText('Scene unavailable')).toBeTruthy();
    expect(screen.getByText('No scene bridge update yet')).toBeTruthy();
    expect(screen.getByText('Standalone editor draft')).toBeTruthy();

    fireEvent.press(screen.getByTestId('editor-settings-done-button'));

    expect(mockBack).toHaveBeenCalled();
  });
});
