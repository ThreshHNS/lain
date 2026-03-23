import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import IOSInstallBanner from '@/components/ios-install-banner';

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: '#050608' },
          headerShown: false,
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="game"
          options={{
            animation: Platform.OS === 'web' ? 'none' : 'fade',
            headerShown: false,
            presentation: Platform.OS === 'web' ? 'card' : 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="editor"
          options={{
            animation: Platform.OS === 'web' ? 'none' : 'fade',
            headerShown: true,
            presentation: Platform.OS === 'web' ? 'card' : 'fullScreenModal',
          }}
        />
      </Stack>
      {Platform.OS === 'web' && <IOSInstallBanner />}
    </ThemeProvider>
  );
}
