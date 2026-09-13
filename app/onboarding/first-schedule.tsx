import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DishVisual } from '@/components/DishVisual';
import { StepShell } from '@/components/StepShell';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { getAllCanonicals } from '@/db/queries';
import { friendlyDate, localDateString, mealTypeForTime } from '@/logic/dates';
import { catalogueForMealType, snapshotCatalogueRecipe } from '@/logic/plannerCatalogue';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useCookingPreferencesStore } from '@/store/cookingPreferencesStore';
import { addRecipeToSlot, MEAL_TYPE_LABEL, slotPhrase } from '@/components/planner/model';
import type { CanonicalItem, PlannedMealType } from '@/types';

/**
 * The first scheduled meal, and the only required step of the planning branch.
 *
 * It comes before pantry capture and before goals on purpose: someone should be
 * able to plan a meal on a fresh install with no stock, no body metrics, no
 * targets and no API key. Pantry capture and calorie setup are both offered
 * afterwards, in context, and both remain skippable.
 *
 * The meal is persisted here, before either bridge is taken, so a person who
 * closes the app between choosing and handing off still finds their plan.
 */
export default function FirstScheduleScreen() {
  const router = useRouter();
  const [canonicals, setCanonicals] = useState<ReadonlyMap<string, CanonicalItem>>(new Map());
  const [saving, setSaving] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draft = useMealScheduleStore((state) => state.draft);
  const load = useMealScheduleStore((state) => state.load);
  const updateDraft = useMealScheduleStore((state) => state.updateDraft);
  const save = useMealScheduleStore((state) => state.save);

  const completeBranch = useOnboardingStore((state) => state.completeBranch);
  const setDraft = useOnboardingStore((state) => state.set);
  const resetDraft = useOnboardingStore((state) => state.reset);
  const savePreferences = useCookingPreferencesStore((state) => state.savePreferences);
  const completeMealPrep = useCookingPreferencesStore((state) => state.completeMealPrep);

  const today = localDateString();
  const mealType: PlannedMealType = mealTypeForTime() === 'snack' ? 'dinner' : mealTypeForTime() as PlannedMealType;
  const options = catalogueForMealType(mealType).slice(0, 6);

  useEffect(() => {
    void (async () => {
      setCanonicals(new Map((await getAllCanonicals()).map((item) => [item.id, item])));
      await load(today);
    })();
  }, [load, today]);

  const choose = async (recipeId: string) => {
    const current = useMealScheduleStore.getState().draft;
    if (!current) return;
    const recipe = options.find((entry) => entry.id === recipeId);
    if (!recipe) return;

    setSaving(recipeId);
    setError(null);
    try {
      const snapshot = snapshotCatalogueRecipe({
        recipe, canonicals, snapshotId: randomUUID(), ingredientId: randomUUID,
      });
      // An existing slot is replaced rather than duplicated, so tapping a second
      // recipe here corrects the choice instead of creating two plans.
      const next = addRecipeToSlot(current, {
        snapshot, localDate: today, mealType,
        eatenPortions: 1, producedPortions: snapshot.baseYield, replace: true,
      });
      await updateDraft(next);
      await save();
      if (useMealScheduleStore.getState().status === 'error') {
        setError("That could not be saved. Your choice is kept — try again.");
        return;
      }
      setSavedTitle(recipe.title);
    } catch {
      setError('That could not be scheduled. Nothing was saved.');
    } finally {
      setSaving(null);
    }
  };

  const markBranchDone = async () => {
    await completeMealPrep();
    await savePreferences({
      intents: useOnboardingStore.getState().intents,
      mealPrepStatus: 'completed',
    });
    completeBranch('meal_prep');
  };

  const onSeeWeek = async () => {
    await markBranchDone();
    resetDraft();
    router.replace({ pathname: '/(tabs)', params: { todayPage: 'meal-plan', plannerView: 'week' } });
  };

  const onSetUpTarget = async () => {
    await markBranchDone();
    setDraft({ intents: ['calories', 'meal_prep'] });
    router.push('/onboarding/sex');
  };

  const onSkip = () => {
    resetDraft();
    router.replace('/(tabs)');
  };

  if (savedTitle) {
    return (
      <StepShell
        step="first-plan"
        title={`${savedTitle} is on your plan`}
        detail={`Saved to ${slotPhrase(today, mealType)}. Mise can turn it into a grocery list whenever you are ready.`}
        primaryLabel="See my week"
        onPrimary={() => void onSeeWeek()}
        secondaryLabel="Set up daily calorie target"
        onSecondary={() => void onSetUpTarget()}
      >
        <Caption muted>
          You can add what is already in your kitchen later, from Pantry. Nothing here needed it.
        </Caption>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="first-plan"
      title={`What do you want for ${MEAL_TYPE_LABEL[mealType].toLowerCase()}?`}
      detail="Pick one and Mise works out what to buy. No pantry, no targets and no key needed."
      secondaryLabel="Skip for now"
      onSecondary={onSkip}
    >
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
      <View style={styles.rows}>
        {options.map((recipe) => (
          <Pressable
            key={recipe.id}
            onPress={() => void choose(recipe.id)}
            disabled={saving !== null}
            accessibilityRole="button"
            accessibilityLabel={recipe.title}
            accessibilityHint={`${recipe.durationMinutes} minutes, makes ${recipe.baseYield}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
          >
            <DishVisual dish={recipe.title} size="sm" alt="" />
            <View style={styles.rowText}>
              <RowTitle numberOfLines={2}>{recipe.title}</RowTitle>
              <Caption muted>
                {recipe.durationMinutes} min · makes {recipe.baseYield}
                {recipe.requiredAppliances.length === 0 ? ' · no appliance' : ''}
              </Caption>
            </View>
            {saving === recipe.id ? <Body muted>Saving…</Body> : null}
          </Pressable>
        ))}
      </View>
      {!draft ? <Caption muted>Preparing your week…</Caption> : null}
    </StepShell>
  );
}

const styles = StyleSheet.create({
  rows: { borderTopWidth: 1, borderTopColor: color.line },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    minHeight: layout.minRowHeight, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: color.line,
  },
  rowText: { flex: 1, gap: space.xs },
  error: { color: color.paprika, marginBottom: space.sm },
});
