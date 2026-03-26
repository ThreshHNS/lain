import { render, screen, waitFor } from '@testing-library/react-native';

import PromptHistoryScreen from '@/app/prompt-history';

const mockFetchPromptMessages = jest.fn();
let mockParams: Record<string, string> = {
  mode: 'slasher',
  promptSessionId: 'session-42',
  sceneDraftId: 'draft-9',
  title: 'Slasher',
};

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/lib/api/prompt-session', () => ({
  PromptSessionApiError: class PromptSessionApiError extends Error {},
  fetchPromptMessages: (...args: unknown[]) => mockFetchPromptMessages(...args),
}));

describe('PromptHistoryScreen', () => {
  beforeEach(() => {
    mockFetchPromptMessages.mockReset();
    mockParams = {
      mode: 'slasher',
      promptSessionId: 'session-42',
      sceneDraftId: 'draft-9',
      title: 'Slasher',
    };
  });

  it('renders real prompt messages for the linked session', async () => {
    mockFetchPromptMessages.mockResolvedValue([
      {
        createdAt: '2026-03-26T12:05:00.000Z',
        id: 'assistant-1',
        role: 'assistant',
        sessionId: 'session-42',
        slot: 'walk',
        source: 'codex',
        text: 'Keep the pursuit tighter and hold the camera lower.',
      },
      {
        createdAt: '2026-03-26T12:03:00.000Z',
        id: 'user-1',
        role: 'user',
        sessionId: 'session-42',
        slot: 'walk',
        source: 'text',
        text: 'Tighten the chase beat.',
      },
    ]);

    render(<PromptHistoryScreen />);

    await waitFor(() => {
      expect(screen.getByText('Messages')).toBeTruthy();
    });

    expect(screen.getByTestId('prompt-history-screen')).toBeTruthy();
    expect(screen.getByText('Slasher')).toBeTruthy();
    expect(screen.getByText('Session session-42')).toBeTruthy();
    expect(screen.getByText('Draft draft-9')).toBeTruthy();
    expect(screen.getByText('Keep the pursuit tighter and hold the camera lower.')).toBeTruthy();
    expect(screen.getByText('Tighten the chase beat.')).toBeTruthy();
  });

  it('shows an honest local-only state when no session is linked yet', () => {
    mockParams = {
      mode: 'awp',
    };

    render(<PromptHistoryScreen />);

    expect(screen.getByText('AWP')).toBeTruthy();
    expect(screen.getByText('Local draft only')).toBeTruthy();
    expect(screen.getByText('Session not linked')).toBeTruthy();
    expect(screen.getByText('Draft standalone')).toBeTruthy();
    expect(mockFetchPromptMessages).not.toHaveBeenCalled();
  });
});
