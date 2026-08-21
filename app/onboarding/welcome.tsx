import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { StepShell } from '@/components/StepShell';
import { Caption, SectionLabel } from '@/components/Type';
import { space } from '@/constants/theme';
import { ONBOARDING_ENTRY_ROUTES, useOnboardingStore } from '@/store/onboardingStore';
import type { TargetSource } from '@/types';

/**
 * The first screen has one job: say what the setup that follows is for.
 *
 * It previously stated the product promise and then asked for personal
 * details without connecting the two, so the questions read as a form to
 * be endured. The daily target is what connects them — it is the figure
 * pantry stock, logged meals, and recipes are all measured against — so it
 * is said plainly here, once, before anything is asked.
 *
 * The estimated path stays the single primary action. The other two
 * entrances are for people who already hold a figure, which is the minority
 * case, so they sit quietly underneath rather than competing as equals.
 */
export default function Welcome() {
  const router = useRouter();
  const set = useOnboardingStore((state) => state.set);
  const setMeasuredFlowOrigin = useOnboardingStore((state) => state.setMeasuredFlowOrigin);

  const start = (targetSource: TargetSource) => {
    if (targetSource === 'dexa' || targetSource === 'inbody') setMeasuredFlowOrigin('onboarding');
    set({ targetSource });
    router.push(ONBOARDING_ENTRY_ROUTES[targetSource]);
  };

  return (
    <StepShell
      step="welcome"
      showBack={false}
      title="Cook from what you have, tracked as you go."
      detail="First, a daily calorie and macro target. It is what your pantry, your logged meals, and your recipes are measured against, so the rest of Mise works towards what you are aiming for."
      primaryLabel="Let's do the basic setup"
      primaryDetail="Calculate from age, sex, height, weight & activity"
      onPrimary={() => start('estimated')}
    >
      <View style={styles.alternatives}>
        <SectionLabel muted>Already have a figure?</SectionLabel>
        <Button
          label="Scan or upload body composition report"
          detail="DEXA or InBody scan"
          variant="secondary"
          onPress={() => start('dexa')}
        />
        <Button
          label="I already know my calorie target"
          detail="Enter an exact daily calorie goal or resting BMR"
          variant="secondary"
          onPress={() => start('stated')}
        />
      </View>

      <Caption muted>
        Your diary stays on this phone, with no Mise account or server. A report
        or photo you choose to analyse is sent to the provider for your own API
        key, and nothing else leaves the device.
      </Caption>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  alternatives: { gap: space.sm },
});
