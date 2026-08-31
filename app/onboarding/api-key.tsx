import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { hasApiKey } from '@/api/keyStore';
import { ApiKeyForm } from '@/components/ApiKeyForm';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepShell } from '@/components/StepShell';
import { Caption } from '@/components/Type';
import { space } from '@/constants/theme';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function ApiKeyStep() {
  const router = useRouter();
  const set = useOnboardingStore((state) => state.set);
  const consumeReturnIntent = useOnboardingStore((state) => state.consumeReturnIntent);
  const completedBranches = useOnboardingStore((state) => state.completedBranches);
  const [existingKey, setExistingKey] = useState<boolean | null>(null);

  useEffect(() => {
    void hasApiKey().then(setExistingKey);
  }, []);

  const finish = (skipped: boolean) => {
    set({ skippedKey: skipped });
    const intent = consumeReturnIntent();
    switch (intent.kind) {
      case 'default-onboarding':
        router.replace(completedBranches.includes('meal_prep')
          ? '/onboarding/results'
          : '/onboarding/dietary');
        return;
      case 'energy-onboarding':
        useOnboardingStore.getState().setMeasuredFlowOrigin('onboarding');
        set({ targetSource: intent.source });
        router.replace('/onboarding/energy');
        return;
      case 'energy-settings':
        useOnboardingStore.getState().setMeasuredFlowOrigin('settings');
        set({ targetSource: intent.source });
        router.replace('/onboarding/energy');
        return;
    }
  };

  const back = () => finish(true);

  if (existingKey === null) {
    return <Screen />;
  }

  // Nothing to ask when a key is already present — a `.env` seed, or a keychain
  // entry that survived a reinstall.
  if (existingKey) {
    return (
      <StepShell
        step="api-key"
        title="Your key is already set."
        detail="Mise found a key in this phone’s keychain. You can replace or remove it in Settings."
        primaryLabel="Continue"
        onPrimary={() => finish(false)}
        onBack={back}
      />
    );
  }

  return (
    <StepShell
      step="api-key"
        title="Add an API key."
        detail="Mise has no server of its own. Photo estimates go straight from this phone to the provider your key belongs to."
    >
      <ApiKeyForm onSaved={() => finish(false)} saveLabel="Save and continue" />

      <View style={styles.skip}>
        <Button
          label="Skip for now"
          variant="ghost"
          onPress={() => finish(true)}
        />
        <Caption muted style={styles.skipDetail}>
          Without a key, Mise works as a manual food diary. Add one in Settings
          whenever you want photo estimates.
        </Caption>
      </View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  skip: { marginTop: space.sm, gap: space.xs },
  skipDetail: { textAlign: 'center', paddingHorizontal: space.base },
});
