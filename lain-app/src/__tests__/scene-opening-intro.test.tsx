import { act, render, screen } from '@testing-library/react-native';

import SceneOpeningIntro from '@/components/scene-opening-intro';
import { getSceneOption } from '@/lib/scene-config';

const INTRO_TOTAL_DURATION_MS = 320 + 1800 + 540 + 80;

describe('SceneOpeningIntro', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the track preview copy and dismisses itself after the intro window', () => {
    render(<SceneOpeningIntro bottomInset={24} scene={getSceneOption('awp')} topInset={12} />);

    expect(screen.getByTestId('scene-opening-intro')).toBeTruthy();
    expect(screen.getByText('Track preview')).toBeTruthy();
    expect(screen.getByText('Die4Guy')).toBeTruthy();
    expect(screen.getAllByText('AWP')).toHaveLength(3);
    expect(screen.getByText('Playboi Carti · tap to shoot')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(INTRO_TOTAL_DURATION_MS);
    });

    expect(screen.queryByTestId('scene-opening-intro')).toBeNull();
  });
});
