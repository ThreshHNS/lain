import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import NewSceneScreen from '@/app/new-scene';

const originalFetch = global.fetch;

describe('NewSceneScreen', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('loads existing scene drafts from the backend', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          sceneDrafts: [
            {
              brief: 'A tight rooftop chase with one clean jump window.',
              createdAt: '2026-03-23T12:00:00.000Z',
              creatorId: 'local-creator',
              id: 'scene-1',
              inputModel: 'hold',
              promptSessionId: 'session-1',
              slug: 'rooftop-chase',
              status: 'draft',
              title: 'Rooftop Chase',
              updatedAt: '2026-03-23T12:00:00.000Z',
            },
          ],
        }),
    });

    render(<NewSceneScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('scene-draft-card-rooftop-chase')).toBeTruthy();
    });
  });

  it('creates a new scene draft with a compact form', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sceneDrafts: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sceneDraft: {
              brief: 'Cold hallway with one stalking beat and remote-safe focus order.',
              createdAt: '2026-03-23T12:03:00.000Z',
              creatorId: 'local-creator',
              id: 'scene-2',
              inputModel: 'remote',
              promptSessionId: 'session-2',
              slug: 'cold-hallway',
              status: 'draft',
              title: 'Cold Hallway',
              updatedAt: '2026-03-23T12:03:00.000Z',
            },
          }),
      });

    render(<NewSceneScreen />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    fireEvent.changeText(screen.getByTestId('new-scene-title-input'), 'Cold Hallway');
    fireEvent.press(screen.getByTestId('new-scene-input-remote'));
    fireEvent.changeText(
      screen.getByTestId('new-scene-brief-input'),
      'Cold hallway with one stalking beat and remote-safe focus order.',
    );
    fireEvent.press(screen.getByTestId('new-scene-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('scene-draft-card-cold-hallway')).toBeTruthy();
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3001/scene-drafts',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
}));
