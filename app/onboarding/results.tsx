import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Caption, Hero, SectionLabel } from '@/components/Type';
import { duration, macroColor, space } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { goalLabel } from '@/constants/activityLevels';
import { energyTargets } from '@/logic/bmr';
import { macroTargets } from '@/logic/macros';
import {
  ONBOARDING_SPLIT,
  useOnboardingStore,
} from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import type { Profile } from '@/types';

export default function ResultsStep() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const draft = useOnboardingStore();
  const createProfile = useProfileStore((state) => state.create);
  const resetDraft = useOnboardingStore((state) => state.reset);

  const computed = useMemo(() => {
    if (
      draft.sex === null ||
      draft.age === null ||
      draft.heightCm === null ||
      draft.weightKg === null ||
      draft.activityLevel === null ||
      draft.goal === null
    ) {
      return null;
    }
    const targets = energyTargets(
      {
        sex: draft.sex,
        age: draft.age,
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
      },
      draft.activityLevel,
      draft.goal,
    );
    const macros = macroTargets(targets.target, {
      proteinPct: ONBOARDING_SPLIT.proteinPct,
      carbsPct: ONBOARDING_SPLIT.carbsPct,
      fatPct: ONBOARDING_SPLIT.fatPct,
    });
    return { targets, macros };
  }, [draft]);

  if (!computed) {
    // A step was skipped by deep link — send them back to the top.
    return (
      <Screen gutter>
        <Body>Something’s missing from your profile. Let’s start over.</Body>
        <Button
          label="Restart setup"
          onPress={() => router.replace('/onboarding/welcome')}
        />
      </Screen>
    );
  }

  const { targets, macros } = computed;

  const startTracking = async () => {
    if (
      draft.sex === null ||
      draft.age === null ||
      draft.heightCm === null ||
      draft.weightKg === null ||
      draft.activityLevel === null ||
      draft.goal === null
    ) {
      return;
    }
    const profile: Profile = {
      sex: draft.sex,
      age: draft.age,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      activityLevel: draft.activityLevel,
      goal: draft.goal,
      targetCalories: targets.target,
      proteinPct: ONBOARDING_SPLIT.proteinPct,
      carbsPct: ONBOARDING_SPLIT.carbsPct,
      fatPct: ONBOARDING_SPLIT.fatPct,
      units: draft.units,
      onboardedAt: new Date().toISOString(),
    };
    await createProfile(profile);
    resetDraft();
    router.replace('/(tabs)');
  };

  // Native-only motion; reanimated's web layout path is buggy (see StepShell).
  const reveal = (delay: number) =>
    Platform.OS === 'web'
      ? undefined
      : reduceMotion
        ? FadeIn.duration(duration.reduced)
        : FadeInUp.duration(duration.count).delay(delay);

  return (
    <Screen
      scroll
      footer={<Button label="Start tracking" onPress={() => void startTracking()} />}
    >
      <View style={styles.header}>
        <SectionLabel muted>Your daily target</SectionLabel>
      </View>

      <Animated.View entering={reveal(0)} style={styles.hero}>
        <Hero numeric>{targets.target}</Hero>
        <Body muted>calories a day to {goalLabel(draft.goal ?? 'maintain').toLowerCase()}</Body>
      </Animated.View>

      <Animated.View entering={reveal(150)} style={styles.maintenance}>
        <Caption muted numeric>
          Maintenance is {targets.maintenance} kcal. Your goal adjusts it to{' '}
          {targets.target}.
        </Caption>
      </Animated.View>

      <Animated.View entering={reveal(300)}>
        <Card title="Macro split">
          <View style={styles.macros}>
            <Macro label="Protein" grams={macros.proteinG} fill={macroColor.protein} pct={30} />
            <Macro label="Carbs" grams={macros.carbsG} fill={macroColor.carbs} pct={40} />
            <Macro label="Fat" grams={macros.fatG} fill={macroColor.fat} pct={30} />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={reveal(450)} style={styles.note}>
        <Caption muted>
          You can change any of this in Settings. Past days keep the target that
          was active at the time.
        </Caption>
      </Animated.View>
    </Screen>
  );
}

function Macro({
  label,
  grams,
  fill,
  pct,
}: {
  label: string;
  grams: number;
  fill: string;
  pct: number;
}) {
  return (
    <View style={styles.macro}>
      <View style={[styles.dot, { backgroundColor: fill }]} />
      <View style={styles.macroText}>
        <Body>{label}</Body>
        <Caption muted numeric>
          {pct}%
        </Caption>
      </View>
      <Body numeric>{grams} g</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.xl, alignItems: 'center' },
  hero: { alignItems: 'center', marginTop: space.sm, gap: space.xs },
  maintenance: { alignItems: 'center', marginTop: space.md, marginBottom: space.xl },
  macros: { gap: space.base },
  macro: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  macroText: { flex: 1, gap: space.xs },
  note: { marginTop: space.lg },
});
