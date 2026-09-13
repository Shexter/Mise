import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { PlannerRecipeVisual } from '@/components/planner/PlannerRecipeVisual';
import { Screen } from '@/components/Screen';
import { Skeleton, SkeletonLine } from '@/components/Skeleton';
import { LabelledStepper } from '@/components/planner/LabelledStepper';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, radius, space } from '@/constants/theme';
import { getAllCanonicals, getOwnedAppliances, getRecipe, listDietaryRules } from '@/db/queries';
import { getExclusionSet } from '@/logic/dietaryService';
import { friendlyDate } from '@/logic/dates';
import { PLANNER_CATALOGUE, snapshotCatalogueRecipe } from '@/logic/plannerCatalogue';
import { PlannerConflictError } from '@/logic/plannerSchedule';
import { reviewPlannerRecipe, snapshotSavedRecipe, type PlannerRecipeReview } from '@/logic/plannerRecipe';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import { formatPortions } from '@/components/planner/MealSlotRow';
import { addRecipeToSlot, isOccupied, slotPhrase } from '@/components/planner/model';
import { usePlannerCommit } from '@/components/planner/usePlannerCommit';
import type { CanonicalItem, PlannedMealType, PlannerRecipeSnapshot } from '@/types';
import { Alert } from 'react-native';

const APPLIANCE_LABEL: Record<string, string> = {
  cooktop: 'Cooktop', oven: 'Oven', microwave: 'Microwave', air_fryer: 'Air fryer',
  rice_cooker: 'Rice cooker', slow_cooker: 'Slow cooker', blender: 'Blender',
};

/**
 * Preview one recipe against one dated slot, then schedule it.
 *
 * Two numbers, kept apart on purpose: **Your portion** is what you will eat and
 * what counts toward your day, **Batch makes** is what the cooking session
 * produces and what the grocery list buys for. The helper text says so, because
 * conflating them is how a shopping list silently multiplies.
 */
export default function PlanRecipeScreen() {
  const router = useRouter();
  const commit = usePlannerCommit();
  const params = useLocalSearchParams<{
    source: 'catalogue' | 'saved'; id: string; date: string; mealType: PlannedMealType; replaceSlotId?: string;
  }>();
  const date = params.date ?? '';
  const mealType = (params.mealType ?? 'dinner') as PlannedMealType;

  const draft = useMealScheduleStore((state) => state.draft);
  const [snapshot, setSnapshot] = useState<PlannerRecipeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [eaten, setEaten] = useState(1);
  const [produced, setProduced] = useState(1);
  const [reviewedYield, setReviewedYield] = useState(1);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<PlannerRecipeReview | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const canonicals: ReadonlyMap<string, CanonicalItem> =
          new Map((await getAllCanonicals()).map((item) => [item.id, item]));

        if (params.source === 'catalogue') {
          const recipe = PLANNER_CATALOGUE.find((entry) => entry.id === params.id);
          if (!recipe) { setFailed(true); return; }
          const built = snapshotCatalogueRecipe({
            recipe, canonicals, snapshotId: randomUUID(), ingredientId: randomUUID,
          });
          setSnapshot(built);
          setEaten(1);
          setProduced(built.baseYield);
        } else {
          const recipe = await getRecipe(params.id);
          if (!recipe) { setFailed(true); return; }
          const built = snapshotSavedRecipe({
            recipe, reviewedYield, canonicals, snapshotId: randomUUID(),
            ingredientId: randomUUID, mealTypes: [mealType],
          });
          setSnapshot(built);
          setEaten(1);
          setProduced(reviewedYield);
        }
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.source, params.id, mealType, reviewedYield]);

  // Eligibility is read once the snapshot exists, because it is a question
  // about this recipe's ingredients and equipment rather than about the
  // collection. A failure here withholds the review rather than inventing a
  // clean bill of health.
  useEffect(() => {
    if (!snapshot) { setReview(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const [rules, owned] = await Promise.all([listDietaryRules(), getOwnedAppliances()]);
        const exclusions = await getExclusionSet(rules);
        if (cancelled) return;
        setReview(reviewPlannerRecipe({
          recipe: snapshot,
          exclusions,
          // No rows at all means the appliance question was never answered, which
          // is not the same as owning nothing.
          ownedApplianceIds: owned.length === 0
            ? null
            : new Set(owned.filter((entry) => entry.owned).map((entry) => entry.applianceId)),
        }));
      } catch {
        if (!cancelled) setReview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [snapshot]);

  /**
   * Scheduling, gated on the checks that must happen first: a recorded dietary
   * exclusion asks before it is overridden, and an occupied slot asks before it
   * is replaced. Cancelling either leaves the plan exactly as it was.
   */
  const add = async () => {
    if (!snapshot || !draft || saving) return;
    setSaving(true);

    const conflicts = review?.excluded ?? [];
    if (conflicts.length > 0) {
      Alert.alert(
        'This conflicts with your dietary profile',
        `${conflicts.map((item) => item.name).join(', ')} ${conflicts.length === 1 ? 'is' : 'are'} excluded by a rule you recorded. Nothing has been scheduled yet.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) },
          { text: 'Schedule anyway', onPress: () => void continueAdd() },
        ],
      );
      return;
    }
    await continueAdd();
  };

  const continueAdd = async () => {
    if (!snapshot || !draft) return;
    const run = async (replace: boolean) => {
      try {
        const next = addRecipeToSlot(draft, {
          snapshot, localDate: date, mealType,
          eatenPortions: eaten, producedPortions: produced, replace,
        });
        const ok = await commit(next, `Saved to ${slotPhrase(date, mealType)}`);
        // Back to the plan, not to the picker. `back()` would pop one screen and
        // leave the person in the list they just chose from, needing a second
        // Back to see the thing they scheduled. The date goes with it, so the
        // plan opens on the day this meal was actually scheduled into.
        if (ok) router.navigate({ pathname: '/(tabs)', params: { todayPage: 'meal-plan', date } });
      } catch (error) {
        Alert.alert('That change is not possible', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setSaving(false);
      }
    };

    const occupied = isOccupied(draft, date, mealType);
    if (occupied) {
      const existing = draft.snapshots.find((entry) =>
        entry.id === draft.batches.find((batch) => batch.id === occupied.batchId)?.snapshotId)?.title;
      Alert.alert(
        `Replace ${slotPhrase(date, mealType)}?`,
        existing ? `${existing} is already there.` : 'A meal is already there.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) },
          { text: 'Replace', style: 'destructive', onPress: () => void run(true) },
        ],
      );
      return;
    }
    await run(false);
  };

  if (loading) {
    return (
      <Screen scroll>
        <View style={styles.loading}>
          <Skeleton height={180} />
          <SkeletonLine width="70%" />
          <SkeletonLine width="45%" />
          <Caption muted>Loading this recipe…</Caption>
        </View>
      </Screen>
    );
  }

  if (failed || !snapshot) {
    return (
      <Screen scroll>
        <View style={styles.loading}>
          <ScreenTitle>This recipe could not be opened</ScreenTitle>
          <Caption muted>It may have been deleted. Your plan is unchanged.</Caption>
          <Button label="Back to recipes" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const nutrition = snapshot.nutritionPerPortion;
  const unknown = (['calories', 'proteinG', 'carbsG', 'fatG', 'fibreG'] as const)
    .filter((key) => nutrition[key] === null);
  const incomplete = unknown.length > 0;
  const scale = eaten / snapshot.baseYield;

  return (
    <Screen
      scroll
      footer={(
        <View style={styles.footer}>
          <Button
            label={`Add to ${slotPhrase(date, mealType)}`}
            onPress={() => void add()}
            loading={saving}
            block
          />
        </View>
      )}
    >
      <PlannerRecipeVisual snapshot={snapshot} size="hero" alt="" style={styles.hero} />
      <ScreenTitle style={styles.title}>{snapshot.title}</ScreenTitle>
      <Caption muted>
        {[
          snapshot.durationMinutes ? `${snapshot.durationMinutes} min` : null,
          `makes ${snapshot.baseYield}`,
          snapshot.requiredAppliances.length === 0
            ? 'no appliance'
            : snapshot.requiredAppliances.map((id) => APPLIANCE_LABEL[id] ?? id).join(', '),
          ...snapshot.cuisines,
        ].filter(Boolean).join(' · ')}
      </Caption>

      {review && (review.excluded.length > 0 || review.unverified.length > 0 || review.missingAppliances.length > 0) ? (
        <View style={styles.checks}>
          <SectionLabel>Check before you schedule</SectionLabel>
          {review.excluded.length > 0 ? (
            <Body style={styles.conflict}>
              Excluded by your dietary profile: {review.excluded.map((item) => item.name).join(', ')}.
            </Body>
          ) : null}
          {review.unverified.length > 0 ? (
            <Caption muted>
              Not checked against your dietary rules, because {review.unverified.length === 1 ? 'this ingredient is' : 'these ingredients are'} not
              matched to a known food: {review.unverified.join(', ')}.
            </Caption>
          ) : null}
          {review.missingAppliances.length > 0 ? (
            <Caption muted>
              Needs equipment you have not recorded: {review.missingAppliances.map((id) => APPLIANCE_LABEL[id] ?? id).join(', ')}.
            </Caption>
          ) : null}
          <Caption muted>You can still schedule this. Nothing has been added yet.</Caption>
        </View>
      ) : null}

      {params.source === 'saved' ? (
        <View style={styles.review}>
          <SectionLabel>How many portions does this recipe make?</SectionLabel>
          <Caption muted>
            Saved recipes do not record a yield, so this is your call. Everything below scales from it.
          </Caption>
          <LabelledStepper label="Recipe makes" value={reviewedYield} onChange={setReviewedYield} min={1} max={20} unit="portions" />
        </View>
      ) : null}

      <View style={styles.portions}>
        <LabelledStepper
          label="Your portion"
          detail="What you will eat, and what counts toward your day."
          value={eaten} onChange={setEaten} step={0.25} min={0.25} max={produced} unit="portions"
        />
        <LabelledStepper
          label="Batch makes"
          detail="What the cooking session produces, and what the grocery list buys for."
          value={produced} onChange={setProduced} step={1} min={1} max={24} unit="portions"
        />
      </View>

      <SectionLabel style={styles.sectionLabel}>Estimated nutrition, your portion</SectionLabel>
      {incomplete ? (
        <Caption muted style={styles.incomplete}>
          Nutrition incomplete — {unknown.map(labelOf).join(', ')} unknown for this recipe. Known values are shown; nothing
          is filled in with zero.
        </Caption>
      ) : null}
      <View style={styles.nutrition}>
        {([
          ['Calories', nutrition.calories, 'kcal'],
          ['Protein', nutrition.proteinG, 'g'],
          ['Carbs', nutrition.carbsG, 'g'],
          ['Fat', nutrition.fatG, 'g'],
          ['Fibre', nutrition.fibreG, 'g'],
        ] as const).map(([label, value, unit]) => (
          <View key={label} style={styles.nutritionRow}>
            <Body>{label}</Body>
            <Body numeric>{value === null ? 'Unknown' : `${Math.round(value * eaten)} ${unit}`}</Body>
          </View>
        ))}
      </View>

      <SectionLabel style={styles.sectionLabel}>Ingredients for this batch</SectionLabel>
      <View style={styles.list}>
        {snapshot.ingredients.map((ingredient) => (
          <View key={ingredient.id} style={styles.listRow}>
            <View style={styles.listText}>
              <Body numberOfLines={2}>{ingredient.name}</Body>
              {ingredient.preparation ? <Caption muted>{ingredient.preparation}</Caption> : null}
            </View>
            <Body numeric>
              {ingredient.quantity === null || ingredient.unit === null
                ? 'Amount unknown'
                : `${formatPortions(Math.round(ingredient.quantity * (produced / snapshot.baseYield) * 10) / 10)} ${ingredient.unit}`}
            </Body>
          </View>
        ))}
      </View>
      <Caption muted style={styles.note}>
        Amounts shown for a batch of {formatPortions(produced)}. You will eat {formatPortions(eaten)}
        {scale === 1 ? '' : ` of ${formatPortions(snapshot.baseYield)}`}.
      </Caption>

      <SectionLabel style={styles.sectionLabel}>Method</SectionLabel>
      <View style={styles.list}>
        {snapshot.steps.map((step) => (
          <View key={step.stepNumber} style={styles.step}>
            <Body numeric style={styles.stepNumber}>{step.stepNumber}</Body>
            <Body style={styles.stepText}>{step.instruction}</Body>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function labelOf(key: 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'): string {
  return key === 'calories' ? 'calories'
    : key === 'proteinG' ? 'protein'
      : key === 'carbsG' ? 'carbohydrate'
        : key === 'fatG' ? 'fat' : 'fibre';
}

const styles = StyleSheet.create({
  loading: { gap: space.base, marginTop: space.xl },
  hero: { alignSelf: 'center', marginTop: space.base },
  title: { marginTop: space.base },
  review: { marginTop: space.lg, gap: space.sm },
  checks: {
    marginTop: space.lg,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
    gap: space.sm,
  },
  conflict: { color: color.paprika },
  portions: { marginTop: space.lg, gap: space.md },
  sectionLabel: { marginTop: space.lg, marginBottom: space.sm },
  incomplete: { marginBottom: space.sm },
  nutrition: { borderTopWidth: 1, borderTopColor: color.line },
  nutritionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.line,
  },
  list: { borderTopWidth: 1, borderTopColor: color.line },
  listRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.base,
    minHeight: layout.minRowHeight, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: color.line,
  },
  listText: { flex: 1, gap: space.xs },
  note: { marginTop: space.sm },
  step: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.line },
  stepNumber: { width: 24, color: color.action },
  stepText: { flex: 1 },
  footer: { gap: space.sm },
});
