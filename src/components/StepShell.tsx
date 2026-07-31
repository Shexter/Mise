import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Body, ScreenTitle } from '@/components/Type';
import {
  color,
  duration,
  layout,
  motionOffset,
  opacity,
  radius,
  space,
} from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  ONBOARDING_STEPS,
  stepIndex,
  type OnboardingStep,
} from '@/store/onboardingStore';

interface Props {
  step: OnboardingStep;
  title: string;
  /** One or two lines under the title. */
  detail?: string;
  children?: ReactNode;
  /** Omit both to let the step's own content own its actions. */
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** A second, quieter action under the primary — "Skip for now". */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Hides the back chevron on the first step. */
  showBack?: boolean;
}

/** One question per screen, with a progress indicator and back navigation. */
export function StepShell({
  step,
  title,
  detail,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  showBack = true,
}: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const index = stepIndex(step);

  // Reanimated's web layout-animation path throws on entering transitions
  // (a known upstream bug), so motion is native-only. The phone experience,
  // which is what ships, is unchanged.
  const entering =
    Platform.OS === 'web'
      ? undefined
      : reduceMotion
        ? FadeIn.duration(duration.reduced)
        : FadeInDown.duration(duration.quick).withInitialValues({
            // A 4px rise, matching the standard enter transition in §7.6.
            transform: [{ translateY: motionOffset }],
          });

  return (
    <Screen
      scroll
      footer={
        primaryLabel && onPrimary ? (
          <View style={styles.footer}>
            <Button
              label={primaryLabel}
              onPress={onPrimary}
              disabled={primaryDisabled}
              loading={primaryLoading}
            />
            {secondaryLabel && onSecondary ? (
              <Button
                label={secondaryLabel}
                variant="ghost"
                onPress={onSecondary}
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      <View style={styles.header}>
        {showBack && router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.back,
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <Feather name="chevron-left" size={22} color={color.ink} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Progress index={index} />
      </View>

      <Animated.View entering={entering} style={styles.body}>
        <ScreenTitle>{title}</ScreenTitle>
        {detail ? (
          <Body muted style={styles.detail}>
            {detail}
          </Body>
        ) : null}
        {children ? <View style={styles.content}>{children}</View> : null}
      </Animated.View>
    </Screen>
  );
}

function Progress({ index }: { index: number }) {
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${ONBOARDING_STEPS.length}`}
    >
      {ONBOARDING_STEPS.map((name, position) => (
        <View
          key={name}
          style={[styles.tick, position <= index && styles.tickOn]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  back: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    marginLeft: -space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flex: 1, flexDirection: 'row', gap: space.xs },
  tick: {
    flex: 1,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: color.line,
  },
  tickOn: { backgroundColor: color.ink },
  body: { gap: space.sm },
  detail: { marginTop: space.xs },
  content: { marginTop: space.lg, gap: space.base },
  footer: { gap: space.sm },
});
