import { render, screen } from '@testing-library/react-native';

import EditorScreen from '@/app/editor';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({
    mode: 'slasher',
  }),
  useRouter: () => ({
    back: mockBack,
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
        <Text testID="editor-scene-uri">{props.uri}</Text>
        <Text testID="editor-scene-interactive">{String(props.interactive)}</Text>
      </View>
    );
  };
});

jest.mock('@/components/app-header', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockAppHeader() {
    return <Text testID="editor-app-header">editor header</Text>;
  };
});

jest.mock('@/components/history-panel', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockHistoryPanel() {
    return <Text testID="editor-history-panel">history panel</Text>;
  };
});

jest.mock('@/components/asset-picker', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockAssetPicker() {
    return <Text testID="editor-asset-picker">asset picker</Text>;
  };
});

jest.mock('@/components/export-bundle-button', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockExportBundleButton() {
    return <Text testID="editor-export-button">export button</Text>;
  };
});

describe('EditorScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
  });

  it('renders the selected scene in embedded preview mode', () => {
    render(<EditorScreen />);

    expect(screen.getByTestId('editor-scene-uri').props.children).toContain('/slasher/');
    expect(screen.getByTestId('editor-scene-uri').props.children).toContain('embedded=1');
    expect(screen.getByTestId('editor-scene-uri').props.children).toContain('preview=1');
    expect(screen.getByTestId('editor-scene-uri').props.children).toContain('still=1');
    expect(screen.getByTestId('editor-scene-interactive').props.children).toBe('false');
  });
});
