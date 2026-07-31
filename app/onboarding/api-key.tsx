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
  const [existingKey, setExistingKey] = useState<boolean | null>(null);

  useEffect(() => {
    void hasApiKey().then(setExistingKey);
  }, []);

  const advance = (skipped: boolean) => {
    set({ skippedKey: skipped });
    router.push('/onboarding/results');
  };

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
        detail="Snap found a key in this phone’s keychain. You can replace or remove it in Settings."
        primaryLabel="Continue"
        onPrimary={() => advance(false)}
      />
    );
  }

  return (
    <StepShell
      step="api-key"
      title="Add your Anthropic key."
      detail="Snap has no server of its own. Photo estimates go straight from this phone to Anthropic, billed to your key."
    >
      <ApiKeyForm onSaved={() => advance(false)} saveLabel="Save and continue" />

      <View style={styles.skip}>
        <Button
          label="Skip for now"
          variant="ghost"
          onPress={() => advance(true)}
        />
        <Caption muted style={styles.skipDetail}>
          Without a key, Snap works as a manual food diary. Add one in Settings
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
