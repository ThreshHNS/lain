import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';

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
            animation: 'fade',
            headerShown: true,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="editor"
          options={{
            animation: 'fade',
            headerShown: true,
            presentation: 'fullScreenModal',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
