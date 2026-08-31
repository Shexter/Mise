import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { StepShell } from '@/components/StepShell';
import { Body, Caption, SectionLabel } from '@/components/Type';
import { color, opacity, radius, space } from '@/constants/theme';
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
          icon="activity"
          title="Track my calories"
          detail="Daily calorie & macronutrient targets measured against your meals."
          onToggle={() => toggleIntent('calories')}
        />

        <GoalCard
          intent="meal_prep"
          selected={hasMealPrep}
          icon="layers"
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
  icon: keyof typeof Feather.glyphMap;
  title: string;
  detail: string;
  onToggle: () => void;
}

function GoalCard({
  selected,
  icon,
  title,
  detail,
  onToggle,
}: GoalCardProps) {
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
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
          <Feather
            name={icon}
            size={22}
            color={selected ? color.action : color.muted}
          />
        </View>

        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected ? (
            <Feather name="check" size={16} color={color.surface} />
          ) : null}
        </View>
      </View>

      <View style={styles.cardBody}>
        <Body style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
          {title}
        </Body>
        <Caption muted style={styles.cardDetail}>
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
    padding: space.lg,
    gap: space.md,
  },
  cardSelected: {
    borderColor: color.action,
    backgroundColor: color.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    backgroundColor: color.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerSelected: {
    backgroundColor: color.ground,
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
  cardBody: {
    gap: space.xs,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: color.ink,
  },
  cardTitleSelected: {
    color: color.action,
  },
  cardDetail: {
    lineHeight: 20,
  },
});
