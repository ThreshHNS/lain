jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-glass-effect', () => {
  return {
    GlassView: ({ children, style }) => {
      const React = require('react');
      const { View } = require('react-native');
      return React.createElement(View, { style }, children);
    },
    isLiquidGlassAvailable: () => false,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');

  return {
    ...actual,
    useSafeAreaInsets: () => ({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }),
  };
});
