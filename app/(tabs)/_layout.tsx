import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { color, font } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.action,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.line,
        },
        tabBarLabelStyle: {
          fontFamily: font.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color: tint, size }) => (
            <Feather name="sun" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'Pantry',
          tabBarIcon: ({ color: tint, size }) => (
            <Feather name="archive" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color: tint, size }) => (
            <Feather name="settings" size={size} color={tint} />
          ),
        }}
      />
    </Tabs>
  );
}
