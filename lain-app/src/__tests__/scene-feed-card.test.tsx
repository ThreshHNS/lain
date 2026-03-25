import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import SceneFeedCard from '@/components/scene-feed-card';

const originalPlatform = Platform.OS;

jest.mock('@/components/scene-frame', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return function MockSceneFrame(props: {
    hideSceneChrome?: boolean;
    interactive?: boolean;
    testID?: string;
    uri: string;
  }) {
    return (
      <View testID={props.testID}>
        <Text testID="scene-feed-card-hide-chrome">{String(props.hideSceneChrome)}</Text>
        <Text testID="scene-feed-card-interactive">{String(props.interactive)}</Text>
        <Text testID="scene-feed-card-uri">{props.uri}</Text>
      </View>
    );
  };
});

describe('SceneFeedCard', () => {
  const scene = {
    description: 'long range',
    id: 'awp',
    label: 'AWP',
  };

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('hides scene chrome for native embedded previews', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const onOpenScene = jest.fn();

    render(
      <SceneFeedCard
        active
        height={640}
        onOpenScene={onOpenScene}
        scene={scene}
        uri="http://127.0.0.1:4173/awp/?embedded=1&preview=1"
      />,
    );

    expect(screen.getByTestId('scene-feed-card-hide-chrome').props.children).toBe('true');
    expect(screen.getByTestId('scene-feed-card-interactive').props.children).toBe('false');

    fireEvent.press(screen.getByTestId('scene-open-awp'));
    expect(onOpenScene).toHaveBeenCalledWith('awp');
  });

  it('keeps web previews unchanged', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    render(
      <SceneFeedCard
        active
        height={640}
        onOpenScene={jest.fn()}
        scene={scene}
        uri="https://example.com/awp/?embedded=1&preview=1"
      />,
    );

    expect(screen.getByTestId('scene-feed-card-hide-chrome').props.children).toBe('false');
  });
});
