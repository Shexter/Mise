import { Stack } from 'expo-router';

import { color } from '@/constants/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.ground },
        animation: 'slide_from_right',
      }}
    />
  );
}
