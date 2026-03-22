import type { ConfigContext, ExpoConfig } from 'expo/config';

const { expo: appJson } = require('./app.json');

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseUrl = process.env.EXPO_BASE_URL;

  return {
    ...config,
    ...appJson,
    experiments: {
      ...appJson.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  };
};
