import { Redirect } from 'expo-router';

import { useProfileStore } from '@/store/profileStore';

/** Sends a fresh install to onboarding and everyone else to Today. */
export default function Index() {
  const profile = useProfileStore((state) => state.profile);
  return <Redirect href={profile ? '/(tabs)' : '/onboarding/welcome'} />;
}
