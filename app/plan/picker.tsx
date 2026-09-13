import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Pill, PillRow } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SkeletonLine } from '@/components/Skeleton';
import { Body, Caption, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { listRecipes } from '@/db/queries';
import { cuisineFilters, recipeHasCuisine } from '@/logic/cuisines';
import {
  catalogueForMealType,
  isNoCook,
  type PlannerCatalogueRecipe,
} from '@/logic/plannerCatalogue';
import { plannerVisualFromCatalogue } from '@/media/plannerRecipeVisuals';
import { CuisineRail } from '@/components/planner/CuisineRail';
import { RecipeChoiceRow, recipeMetaLine } from '@/components/planner/RecipeChoiceRow';
import { MEAL_TYPE_LABEL, MEAL_TYPES, slotPhrase } from '@/components/planner/model';
import type { PlannedMealType, Recipe } from '@/types';

/**
 * Choose a recipe for one dated slot.
 *
 * What this screen deliberately does not do: consult the pantry. Missing
 * ingredients are the normal case when the point of planning is to produce a
 * shopping list, so nothing here is filtered, greyed, or badged by what is in
 * stock. Coverage becomes an optional refinement later, in Shop.
 *
 * Two truthfulness rules shape the rest of it. Cuisine comes from the label a
 * recipe records, never from its title or its picture — so a saved recipe with
 * no cuisine is not a match for any cuisine, and says so rather than hiding.
 * And nothing here schedules: every row opens the preview, where portions,
 * dietary exclusions, required equipment and an occupied slot are reviewed
 * before anything is written.
 */
export default function RecipePickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date: string; mealType: PlannedMealType; replaceSlotId?: string }>();
  const date = params.date ?? '';
  const slotMealType = (params.mealType ?? 'dinner') as PlannedMealType;
  const replaceSlotId = params.replaceSlotId?.trim() ? params.replaceSlotId.trim() : undefined;

  // Replacing is locked to the slot it started from. Changing the meal type
  // here would replace one slot while the heading named another; moving a
  // scheduled meal to a different slot is the separate Move operation.
  const [mealType, setMealType] = useState<PlannedMealType>(slotMealType);
  const selectedMealType = replaceSlotId ? slotMealType : mealType;

  const [query, setQuery] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [saved, setSaved] = useState<Recipe[]>([]);
  const [savedState, setSavedState] = useState<'loading' | 'ready' | 'error'>('loading');

  const loadSaved = useCallback(() => {
    setSavedState('loading');
    void (async () => {
      try {
        setSaved(await listRecipes());
        setSavedState('ready');
      } catch {
        setSaved([]);
        setSavedState('error');
      }
    })();
  }, []);

  useEffect(loadSaved, [loadSaved]);

  const cuisines = useMemo(() => cuisineFilters(), []);
  const normalisedQuery = query.trim().toLowerCase();

  const catalogue = useMemo(() => catalogueForMealType(selectedMealType)
    .filter((recipe) => cuisine === null || recipeHasCuisine(recipe, cuisine))
    .filter((recipe) => normalisedQuery === '' || recipe.title.toLowerCase().includes(normalisedQuery)),
  [selectedMealType, cuisine, normalisedQuery]);

  // Saved recipes record no cuisine, so a cuisine filter excludes them rather
  // than letting them pass as matches for whichever tile happens to be lit.
  const savedMatches = useMemo(() => cuisine !== null ? [] : saved
    .filter((recipe) => normalisedQuery === '' || recipe.title.toLowerCase().includes(normalisedQuery)),
  [saved, cuisine, normalisedQuery]);

  const openPreview = (source: 'catalogue' | 'saved', id: string) => {
    router.push({
      pathname: '/plan/recipe',
      params: { source, id, date, mealType: selectedMealType, replaceSlotId: replaceSlotId ?? '' },
    });
  };

  const previewLabel = `Preview for ${MEAL_TYPE_LABEL[selectedMealType].toLowerCase()}`;
  const cuisineLabel = cuisines.find((entry) => entry.id === cuisine)?.label ?? null;
  const nothingMatches = catalogue.length === 0 && savedMatches.length === 0;
  const filtered = normalisedQuery !== '' || cuisine !== null;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <ScreenTitle>Choose {slotPhrase(date, selectedMealType)}</ScreenTitle>
        <Caption muted>Pick what you want to eat. Mise works out what to buy.</Caption>
      </View>

      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Search recipes"
        label="Search"
      />

      <SectionLabel style={styles.sectionLabel}>Meal</SectionLabel>
      {replaceSlotId ? (
        <View style={styles.locked}>
          <Body>{MEAL_TYPE_LABEL[slotMealType]}</Body>
          <Caption muted>
            You are replacing this {MEAL_TYPE_LABEL[slotMealType].toLowerCase()}. To put a meal on a different
            day or slot, use Move on the meal itself.
          </Caption>
        </View>
      ) : (
        <PillRow>
          {MEAL_TYPES.map((type) => (
            <Pill
              key={type}
              label={MEAL_TYPE_LABEL[type]}
              selected={type === selectedMealType}
              onPress={() => setMealType(type)}
            />
          ))}
        </PillRow>
      )}

      <SectionLabel style={styles.sectionLabel}>Cuisine</SectionLabel>
      <CuisineRail cuisines={cuisines} selected={cuisine} onSelect={setCuisine} />

      <View style={styles.divider} />

      <SectionLabel style={styles.sectionLabel}>Recipes for your plan</SectionLabel>

      {nothingMatches ? (
        <View style={styles.empty}>
          <Body>{emptyExplanation(cuisineLabel, selectedMealType, query.trim())}</Body>
          <Caption muted>
            You are still choosing {slotPhrase(date, selectedMealType)}. Nothing has been scheduled.
          </Caption>
          {filtered ? (
            <Pressable
              onPress={() => { setQuery(''); setCuisine(null); }}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
              accessibilityHint="Keeps the date and meal you are choosing for"
              style={({ pressed }) => [styles.clear, pressed && { opacity: opacity.pressed }]}
            >
              <Body style={styles.link}>Clear filters</Body>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.rows}>
        {catalogue.map((recipe) => (
          <RecipeChoiceRow
            key={recipe.id}
            title={recipe.title}
            meta={catalogueMeta(recipe)}
            actionLabel={previewLabel}
            onPress={() => openPreview('catalogue', recipe.id)}
            visual={plannerVisualFromCatalogue(recipe)}
          />
        ))}
      </View>

      <SectionLabel style={styles.sectionLabel}>Saved recipes</SectionLabel>

      {cuisine !== null ? (
        <View style={styles.empty}>
          <Caption muted>
            Your own recipes do not record a cuisine, so they are not shown under {cuisineLabel}.
          </Caption>
          <Pressable
            onPress={() => setCuisine(null)}
            accessibilityRole="button"
            accessibilityLabel="Show saved recipes"
            accessibilityHint="Clears the cuisine filter and keeps your search"
            style={({ pressed }) => [styles.clear, pressed && { opacity: opacity.pressed }]}
          >
            <Body style={styles.link}>Show saved recipes</Body>
          </Pressable>
        </View>
      ) : savedState === 'loading' ? (
        <View style={styles.loading}>
          <SkeletonLine width="70%" />
          <SkeletonLine width="45%" />
          <Caption muted>Reading your saved recipes…</Caption>
        </View>
      ) : savedState === 'error' ? (
        <View style={styles.empty}>
          <Body>Your saved recipes could not be read</Body>
          <Caption muted>
            This is a read failure, not an empty collection — nothing of yours has been lost. The recipes above are
            still selectable.
          </Caption>
          <Button label="Retry" variant="secondary" block={false} onPress={loadSaved} />
        </View>
      ) : savedMatches.length > 0 ? (
        <View style={styles.rows}>
          {savedMatches.map((recipe) => (
            <RecipeChoiceRow
              key={recipe.id}
              title={recipe.title}
              meta="Your recipe"
              note="Portions and nutrition need a quick review."
              actionLabel={previewLabel}
              onPress={() => openPreview('saved', recipe.id)}
              visual={{ sourceKind: 'saved_recipe', sourceId: recipe.id, title: recipe.title, photoUri: recipe.imageUri }}
            />
          ))}
        </View>
      ) : (
        <Caption muted>
          {normalisedQuery === ''
            ? 'Recipes you save from Pantry appear here too.'
            : `None of your saved recipes match “${query.trim()}”.`}
        </Caption>
      )}
    </Screen>
  );
}

/**
 * Why this combination is empty, naming both halves of it. "No results" would
 * leave someone changing the wrong filter.
 */
function emptyExplanation(
  cuisineLabel: string | null,
  mealType: PlannedMealType,
  search: string,
): string {
  const meal = MEAL_TYPE_LABEL[mealType].toLowerCase();
  if (cuisineLabel && search !== '') return `No ${cuisineLabel} ${meal} matches “${search}”.`;
  if (cuisineLabel) return `No ${cuisineLabel} recipe is available for ${meal}.`;
  if (search !== '') return `No recipe matches “${search}”.`;
  return `No ${meal} recipes are available.`;
}

/** Facts the recipe records. Never a ranking, and never a claim it cannot back. */
function catalogueMeta(recipe: PlannerCatalogueRecipe): string {
  return recipeMetaLine([
    `${recipe.durationMinutes} min`,
    `makes ${recipe.baseYield}`,
    isNoCook(recipe) ? 'no cooking' : recipe.cuisines[0],
  ]);
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  sectionLabel: { marginTop: space.lg, marginBottom: space.sm },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.line,
    marginTop: space.lg,
  },
  locked: { gap: space.xs },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  empty: { gap: space.sm, alignItems: 'flex-start' },
  loading: { gap: space.sm },
  clear: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
  link: { color: color.action },
});
