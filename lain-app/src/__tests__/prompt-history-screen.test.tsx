import { render, screen } from '@testing-library/react-native';

import PromptHistoryScreen from '@/app/prompt-history';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({
    mode: 'slasher',
  }),
}));

describe('PromptHistoryScreen', () => {
  it('renders prompt telemetry mocks for the selected scene', () => {
    render(<PromptHistoryScreen />);

    expect(screen.getByTestId('prompt-history-screen')).toBeTruthy();
    expect(screen.getByText('Slasher')).toBeTruthy();
    expect(screen.getByText('Prompt session')).toBeTruthy();
    expect(screen.getByText(/Session total/)).toBeTruthy();
    expect(screen.getByText(/Pursuit tension pass/)).toBeTruthy();
  });
});
