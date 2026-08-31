import { Redirect } from 'expo-router';

import { isOnboardingComplete } from '@/logic/onboardingGuards';
import { useCookingPreferencesStore } from '@/store/cookingPreferencesStore';
import { useProfileStore } from '@/store/profileStore';

/** Sends a fresh install to onboarding and everyone else to Today. */
export default function Index() {
  const profile = useProfileStore((state) => state.profile);
  const cookingPreferences = useCookingPreferencesStore((state) => state.cookingPreferences);
  const complete = isOnboardingComplete({ profile, cookingPreferences });

  return <Redirect href={complete ? '/(tabs)' : '/onboarding/welcome'} />;
}
