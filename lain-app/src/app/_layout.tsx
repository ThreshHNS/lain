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
        <Stack.Screen name="(tabs)" />
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
            contentStyle: { backgroundColor: 'transparent' },
            headerShown: false,
            presentation: Platform.OS === 'web' ? 'card' : 'transparentModal',
          }}
        />
        <Stack.Screen
          name="prompt-history"
          options={{
            animation: 'slide_from_right',
            headerShown: true,
            presentation: 'card',
            title: 'Prompt history',
          }}
        />
        <Stack.Screen
          name="new-scene"
          options={{
            headerShown: true,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.72, 1.0],
            sheetCornerRadius: 32,
            sheetExpandsWhenScrolledToEdge: false,
            sheetGrabberVisible: true,
            title: 'Scene lab',
          }}
        />
      </Stack>
      {Platform.OS === 'web' && <IOSInstallBanner />}
    </ThemeProvider>
  );
}
