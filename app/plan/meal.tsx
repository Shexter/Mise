import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { PlannerRecipeVisual } from '@/components/planner/PlannerRecipeVisual';
import { Screen } from '@/components/Screen';
import { TechniqueIllustration } from '@/components/TechniqueIllustration';
import { resolveTechnique } from '@/media/techniqueIllustrations';
import { Body, Caption, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, space } from '@/constants/theme';
import { friendlyDate, isFuture, localDateString } from '@/logic/dates';
import { plannerMealReview } from '@/logic/plannerMeal';
import { useCaptureStore } from '@/store/captureStore';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import { formatPortions } from '@/components/planner/MealSlotRow';
import { MEAL_TYPE_LABEL, resolveSlotById } from '@/components/planner/model';

/**
 * The cooking guide for one scheduled meal.
 *
 * Opening it, reading it, and backing out of it change nothing: no stock moves,
 * no meal is logged, and the slot keeps its status. The only write starts at
 * **Review & log**, which hands the snapshot to the ordinary meal editor — the
 * same screen every other kind of meal is corrected in — and the save there is
 * what links the slot.
 */
export default function PlannedMealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slotId: string }>();
  const draft = useMealScheduleStore((state) => state.draft);
  const setPlannedMealDraft = useCaptureStore((state) => state.setPlannedMealDraft);

  // Minted once per visit, so a double tap on Review & log resolves to one meal.
  const idempotencyKey = useRef(randomUUID()).current;
  const [eatingDate, setEatingDate] = useState<string | null>(null);

  const resolved = useMemo(() => {
    if (!draft || !params.slotId) return null;
    try {
      return resolveSlotById(draft, params.slotId);
    } catch {
      return null;
    }
  }, [draft, params.slotId]);

  if (!resolved) {
    return (
      <Screen scroll>
        <View style={styles.missing}>
          <ScreenTitle>This meal is no longer on the plan</ScreenTitle>
          <Caption muted>It may have been removed or moved. Nothing was logged.</Caption>
          <Button label="Back to the week" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const { slot, snapshot, batch, shared } = resolved;
  const planned = isFuture(slot.localDate);
  const actualDate = eatingDate ?? (planned ? null : slot.localDate);

  /**
   * Takes the eating date explicitly rather than reading state, so the alert's
   * own action continues straight into review. Asking "when did you eat this?"
   * and then making the person tap the same button again would be a second
   * confirmation for a decision they just made.
   */
  const continueToReview = (eatenOn: string) => {
    setEatingDate(eatenOn);
    const review = plannerMealReview({
      snapshot,
      slot,
      actualLocalDate: eatenOn,
      actualLoggedAt: new Date().toISOString(),
      eatenPortions: slot.eatenPortions,
      productionPortions: batch.producedPortions,
    });

    if (review.status === 'needs_review') {
      Alert.alert(
        'Some amounts need a look first',
        `${review.missingIngredientIds.length} ingredient${review.missingIngredientIds.length === 1 ? ' has' : 's have'} no stated amount, so this cannot be logged accurately yet. Nothing has been saved.`,
      );
      return;
    }

    setPlannedMealDraft(review.meal, {
      slotId: slot.id,
      idempotencyKey,
      eatenPortions: review.eatenPortions,
      productionPortions: review.productionPortions,
    });
    router.push('/review');
  };

  const openReview = () => {
    if (planned && !actualDate) {
      Alert.alert(
        'When did you eat this?',
        `This meal is planned for ${friendlyDate(slot.localDate).toLowerCase()}. Logging it records what you actually ate, so pick the real date.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'I ate it today', onPress: () => continueToReview(localDateString()) },
        ],
      );
      return;
    }
    continueToReview(actualDate ?? localDateString());
  };

  const alreadyLogged = slot.status === 'logged';

  return (
    <Screen
      scroll
      footer={(
        <View style={styles.footer}>
          <Button
            label={alreadyLogged ? 'Already logged' : 'Review & log'}
            onPress={openReview}
            disabled={alreadyLogged}
            block
          />
          {planned && !alreadyLogged ? (
            <Caption muted>You choose the real eating date on the next screen. Nothing is logged until you save there.</Caption>
          ) : null}
        </View>
      )}
    >
      <PlannerRecipeVisual snapshot={snapshot} size="hero" alt="" style={styles.hero} />
      <ScreenTitle style={styles.title}>{snapshot.title}</ScreenTitle>
      <Caption muted>
        {friendlyDate(slot.localDate)} · {MEAL_TYPE_LABEL[slot.mealType]} ·{' '}
        {alreadyLogged ? 'Logged' : slot.status === 'skipped' ? 'Skipped' : 'Planned'}
      </Caption>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Caption muted>Your portion</Caption>
          <Body numeric>{formatPortions(slot.eatenPortions)}</Body>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Caption muted>Batch makes</Caption>
          <Body numeric>{formatPortions(batch.producedPortions)}</Body>
        </View>
        {snapshot.durationMinutes ? (
          <>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Caption muted>Time</Caption>
              <Body numeric>{snapshot.durationMinutes} min</Body>
            </View>
          </>
        ) : null}
      </View>

      {shared ? (
        <Caption muted style={styles.note}>
          Other meals this week eat from this batch. Cooking it once depletes the ingredients once; the later portions
          are logged as leftovers.
        </Caption>
      ) : null}

      <SectionLabel style={styles.sectionLabel}>Ingredients for the batch</SectionLabel>
      <View style={styles.list}>
        {snapshot.ingredients.map((ingredient) => (
          <View key={ingredient.id} style={styles.row}>
            <View style={styles.rowText}>
              <Body numberOfLines={2}>{ingredient.name}</Body>
              {ingredient.preparation ? <Caption muted>{ingredient.preparation}</Caption> : null}
            </View>
            <Body numeric>
              {ingredient.quantity === null || ingredient.unit === null
                ? 'Amount unknown'
                : `${formatPortions(Math.round(ingredient.quantity * (batch.producedPortions / snapshot.baseYield) * 10) / 10)} ${ingredient.unit}`}
            </Body>
          </View>
        ))}
      </View>

      <SectionLabel style={styles.sectionLabel}>Cooking guide</SectionLabel>
      <View style={styles.list}>
        {snapshot.steps.map((step) => (
          <View key={step.stepNumber} style={styles.step}>
            <Body numeric style={styles.stepNumber}>{step.stepNumber}</Body>
            <View style={styles.stepBody}>
              <Body>{step.instruction}</Body>
              {step.durationMinutes ? <Caption muted>{step.durationMinutes} min</Caption> : null}
            </View>
            <StepTechnique instruction={step.instruction} />
          </View>
        ))}
      </View>
    </Screen>
  );
}

/**
 * The step's illustration, when the bounded vocabulary recognises one. A step it
 * cannot match renders as text, and a guide that mixes the two is the expected
 * result rather than a half-loaded screen.
 */
function StepTechnique({ instruction }: { instruction: string }) {
  const technique = resolveTechnique({ instruction });
  if (technique === null) return null;
  return <TechniqueIllustration technique={technique} />;
}

const styles = StyleSheet.create({
  missing: { gap: space.base, marginTop: space.xl },
  hero: { alignSelf: 'center', marginTop: space.base },
  title: { marginTop: space.base },
  stats: { flexDirection: 'row', alignItems: 'center', gap: space.base, marginTop: space.lg },
  stat: { gap: space.xs },
  statDivider: { width: 1, height: 28, backgroundColor: color.line },
  note: { marginTop: space.base },
  sectionLabel: { marginTop: space.lg, marginBottom: space.sm },
  list: { borderTopWidth: 1, borderTopColor: color.line },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.base,
    minHeight: layout.minRowHeight, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: color.line,
  },
  rowText: { flex: 1, gap: space.xs },
  step: {
    flexDirection: 'row', gap: space.md, alignItems: 'flex-start',
    paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.line,
  },
  stepNumber: { width: 24, color: color.action },
  stepBody: { flex: 1, gap: space.xs },
  footer: { gap: space.sm },
});
