import { render, screen } from '@testing-library/react-native';

import GameScreen from '@/app/game';

const mockBack = jest.fn();
const mockPush = jest.fn();

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
        <Text testID="game-scene-uri">{props.uri}</Text>
        <Text testID="game-scene-interactive">{String(props.interactive)}</Text>
      </View>
    );
  };
});

describe('GameScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
  });

  it('renders the selected scene in embedded game mode', () => {
    render(<GameScreen />);

    expect(screen.getByTestId('game-scene-uri').props.children).toContain('mode=slasher');
    expect(screen.getByTestId('game-scene-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('game-scene-uri').props.children).not.toContain('preview=1');
    expect(screen.getByTestId('game-scene-interactive').props.children).toBe('true');
  });
});
