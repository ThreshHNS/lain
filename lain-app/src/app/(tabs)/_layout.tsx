import { Tabs } from 'expo-router';

import FloatingHomeTabBar from '@/components/floating-home-tab-bar';
import { HomeFeedProvider } from '@/context/home-feed-context';

export default function TabsLayout() {
  return (
    <HomeFeedProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: '#050608' },
        }}
        tabBar={props => <FloatingHomeTabBar {...props} />}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
      </Tabs>
    </HomeFeedProvider>
  );
}
