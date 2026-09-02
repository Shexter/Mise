import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, PixelRatio, Pressable, StyleSheet, View } from 'react-native';

import { StepShell } from '@/components/StepShell';
import { Body, Caption } from '@/components/Type';
import { color, opacity, radius, space, type } from '@/constants/theme';
import {
  GOAL_ILLUSTRATIONS,
  GOAL_ILLUSTRATION_BY_INTENT,
  type GoalIllustrationId,
} from '@/media/onboardingIllustrations';
import { ONBOARDING_ENTRY_ROUTES, useOnboardingStore } from '@/store/onboardingStore';
import type { OnboardingIntent } from '@/types';

export default function GoalsStep() {
  const router = useRouter();
  const intents = useOnboardingStore((state) => state.intents);
  const toggleIntent = useOnboardingStore((state) => state.toggleIntent);
  const targetSource = useOnboardingStore((state) => state.targetSource);

  const hasCalories = intents.includes('calories');
  const hasMealPrep = intents.includes('meal_prep');
  const canContinue = intents.length > 0;

  const onContinue = () => {
    if (!canContinue) return;
    if (hasCalories) {
      router.push(ONBOARDING_ENTRY_ROUTES[targetSource]);
    } else {
      router.push('/onboarding/dietary');
    }
  };

  return (
    <StepShell
      step="goals"
      title="What should Mise help you with?"
      detail="Choose one or both. You can always change your focus later."
      primaryLabel="Continue"
      primaryDisabled={!canContinue}
      onPrimary={onContinue}
    >
      <View style={styles.cards}>
        <GoalCard
          intent="calories"
          selected={hasCalories}
          title="Track my calories"
          detail="Daily calorie & macronutrient targets measured against your meals."
          onToggle={() => toggleIntent('calories')}
        />

        <GoalCard
          intent="meal_prep"
          selected={hasMealPrep}
          title="Meal prep"
          detail="Practical cooking plans built from your kitchen tools and on-hand stock."
          onToggle={() => toggleIntent('meal_prep')}
        />
      </View>
    </StepShell>
  );
}

interface GoalCardProps {
  intent: OnboardingIntent;
  selected: boolean;
  title: string;
  detail: string;
  onToggle: () => void;
}

/**
 * The illustration is the card's artwork, never its control. Selection is still
 * carried by the border, the title colour, and a vector checkbox — a painted
 * tick could not retint per theme or per state, and would read as decoration
 * exactly where the user needs certainty.
 */
function GoalCard({
  intent,
  selected,
  title,
  detail,
  onToggle,
}: GoalCardProps) {
  const illustration: GoalIllustrationId = GOAL_ILLUSTRATION_BY_INTENT[intent];
  // Every type token pairs a font size with a fixed line height, and React
  // Native scales the size but not the height — so at a large system text size
  // the glyphs outgrow their line box and the last line is clipped. Scaling the
  // height alongside keeps both labels fully readable instead of cropped.
  const fontScale = PixelRatio.getFontScale();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}, ${selected ? 'selected' : 'not selected'}`}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      {/* Contained, never cropped, and sitting straight on the card rather than
          inside a tinted box: the artwork's own warm paper is the surface, so
          there is no second frame competing with the card's. */}
      <Image
        source={GOAL_ILLUSTRATIONS[illustration]}
        style={styles.illustration}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Body
            style={[
              styles.cardTitle,
              { lineHeight: type.body.lineHeight * fontScale },
              selected && styles.cardTitleSelected,
            ]}
          >
            {title}
          </Body>
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected ? (
              <Feather name="check" size={16} color={color.surface} />
            ) : null}
          </View>
        </View>
        <Caption
          muted
          style={{ lineHeight: type.caption.lineHeight * fontScale }}
        >
          {detail}
        </Caption>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: space.md,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.line,
    paddingTop: space.base,
    paddingBottom: space.lg,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  cardSelected: {
    borderColor: color.action,
    backgroundColor: color.surface,
  },
  /**
   * Both cards use one square, so the gauge and the bowl carry the same visual
   * weight however differently they fill their own frames.
   */
  illustration: {
    width: 132,
    height: 132,
    alignSelf: 'center',
    borderRadius: radius.card,
  },
  cardBody: {
    gap: space.xs,
  },
  /**
   * The title takes the remaining width rather than a fixed one, so an enlarged
   * system text size wraps the title instead of pushing it under the checkbox.
   */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: color.ink,
  },
  cardTitleSelected: {
    color: color.action,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  checkboxSelected: {
    backgroundColor: color.action,
    borderColor: color.action,
  },
});
