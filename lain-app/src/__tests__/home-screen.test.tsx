import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/components/scene-feed-card', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return function MockSceneFeedCard(props: {
    active: boolean;
    onPlay: (mode: string) => void;
    scene: {
      id: string;
      label: string;
    };
    uri: string;
  }) {
    return (
      <View testID={`scene-card-${props.scene.id}`}>
        <Text testID={`scene-preview-${props.scene.id}-uri`}>{props.uri}</Text>
        <Text testID={`scene-card-${props.scene.id}-active`}>{String(props.active)}</Text>
        <Pressable
          onPress={() => props.onPlay(props.scene.id)}
          testID={`scene-play-${props.scene.id}`}>
          <Text>{props.scene.label}</Text>
        </Pressable>
      </View>
    );
  };
});

describe('HomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders preview urls for both scenes in embedded preview mode', () => {
    render(<HomeScreen />);

    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('/awp/');
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('preview=1');
    expect(screen.getByTestId('scene-preview-awp-uri').props.children).toContain('still=1');

    expect(screen.getByTestId('scene-preview-slasher-uri').props.children).toContain('/slasher/');
    expect(screen.getByTestId('scene-preview-slasher-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('scene-preview-slasher-uri').props.children).toContain('preview=1');
    expect(screen.getByTestId('scene-preview-slasher-uri').props.children).toContain('still=1');

    expect(screen.getByTestId('scene-preview-tomato-guard-uri').props.children).toContain(
      '/tomato-guard/',
    );
    expect(screen.getByTestId('scene-preview-tomato-guard-uri').props.children).toContain(
      'embedded=1',
    );
    expect(screen.getByTestId('scene-preview-tomato-guard-uri').props.children).toContain(
      'preview=1',
    );
    expect(screen.getByTestId('scene-preview-tomato-guard-uri').props.children).toContain(
      'still=1',
    );

    expect(screen.getByTestId('scene-preview-tomato-grid-uri').props.children).toContain(
      '/tomato-grid/',
    );
    expect(screen.getByTestId('scene-preview-tomato-grid-uri').props.children).toContain(
      'embedded=1',
    );
    expect(screen.getByTestId('scene-preview-tomato-grid-uri').props.children).toContain(
      'preview=1',
    );
    expect(screen.getByTestId('scene-preview-tomato-grid-uri').props.children).toContain(
      'still=1',
    );
  });

  it('opens gameplay mode from the overlay play button', () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('scene-play-slasher'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game',
      params: { mode: 'slasher' },
    });
  });
});
