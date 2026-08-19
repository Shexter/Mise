import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmMatchSheet, type PendingConfirmation } from '@/components/match/ConfirmMatchSheet';
import { RecipeIngredientEditor } from '@/components/recipes/RecipeIngredientEditor';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, opacity, space } from '@/constants/theme';
import { addShoppingListSource, getAllCanonicals, getRecipe, insertShoppingListItem, listPantryItems, listShoppingItems, updateRecipe } from '@/db/queries';
import { localDateString } from '@/logic/dates';
import { coverageForRecipe, mealFromRecipe, type RecipeCoverage } from '@/logic/recipe';
import { itemKey } from '@/logic/shoppingList';
import { confirmMatch, resolveIngredientReferencesLocally } from '@/logic/resolution';
import { useDayStore } from '@/store/dayStore';
import type { RecipeIngredient, RecipeWithIngredients } from '@/types';

export default function RecipeDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const addMeal = useDayStore((state) => state.addMeal);
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [coverage, setCoverage] = useState<RecipeCoverage | null>(null);
  const [canonicals, setCanonicals] = useState(new Map());
  const [confirmationMatches, setConfirmationMatches] = useState<PendingConfirmation[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIngredients, setEditingIngredients] = useState(false);
  const load = useCallback(() => {
    if (!id) return;
    void (async () => {
      const found = await getRecipe(id);
      setRecipe(found);
      const [pantry, canonicalItems] = await Promise.all([listPantryItems(), getAllCanonicals()]);
      const canonicalMap = new Map(canonicalItems.map((canonical) => [canonical.id, canonical]));
      if (found) {
        setCoverage(coverageForRecipe(found, pantry));
        const unresolved = found.ingredients.filter((ingredient) => ingredient.canonicalId === null);
        const outcomes = await resolveIngredientReferencesLocally(
          unresolved.map((ingredient) => ({ raw: ingredient.name })),
          'user',
        );
        const pending: PendingConfirmation[] = outcomes.flatMap((outcome) => {
          if (outcome.status !== 'needs_confirmation') return [];
          const canonical = canonicalMap.get(outcome.canonicalId);
          return canonical ? [{
            raw: outcome.raw,
            canonicalId: outcome.canonicalId,
            displayName: canonical.displayName,
            confidence: outcome.confidence,
            source: 'user',
          }] : [];
        });
        setConfirmationMatches(pending);
        setConfirming(pending.length > 0);
      }
      setCanonicals(canonicalMap);
    })();
  }, [id]);
  useFocusEffect(load);

  const persistConfirmedMatch = async (raw: string, canonicalId: string | null) => {
    if (!id || canonicalId === null) return;
    const current = await getRecipe(id);
    if (!current) return;
    const ingredient = current.ingredients.find(
      (candidate) => candidate.canonicalId === null && candidate.name === raw,
    );
    if (!ingredient) return;
    const updated = await updateRecipe({
      ...current,
      ingredients: current.ingredients.map((candidate) =>
        candidate.id === ingredient.id ? { ...candidate, canonicalId } : candidate,
      ),
    });
    setRecipe(updated);
    setCoverage(coverageForRecipe(updated, await listPantryItems()));
  };

  const saveIngredients = async (ingredients: readonly RecipeIngredient[]) => {
    if (!recipe) return;
    await Promise.all(ingredients.flatMap((ingredient) => {
      const previous = recipe.ingredients.find((candidate) => candidate.id === ingredient.id);
      const canonicalId = ingredient.canonicalId;
      const learnedCorrection = canonicalId !== null &&
        (previous?.canonicalId !== canonicalId || previous.name !== ingredient.name);
      return learnedCorrection ? [confirmMatch(ingredient.name, canonicalId)] : [];
    }));
    const updated = await updateRecipe({ ...recipe, ingredients });
    setRecipe(updated);
    setCoverage(coverageForRecipe(updated, await listPantryItems()));
    toast.show({ kind: 'success', message: 'Recipe ingredients updated.' });
  };

  const cook = async () => {
    if (!recipe || saving) return;
    setSaving(true);
    try {
      await addMeal(mealFromRecipe({ recipe, localDate: localDateString(), canonicals }));
      toast.show({ kind: 'success', message: 'Meal logged. Stated ingredient amounts updated your pantry.' });
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const addMissingToShoppingList = async () => {
    if (!recipe || !coverage) return;
    const [existing, currentPantry, canonicalItems] = await Promise.all([
      listShoppingItems(true),
      listPantryItems(),
      getAllCanonicals(),
    ]);
    const canonicalMap = new Map(canonicalItems.map((item) => [item.id, item]));
    const held = new Set(currentPantry
      .filter((item) => item.status === 'in_stock' || item.status === 'running_low')
      .map((item) => item.canonicalId));
    let added = 0;
    for (const ingredient of recipe.ingredients) {
      if (ingredient.canonicalId && held.has(ingredient.canonicalId)) continue;
      const canonical = ingredient.canonicalId ? canonicalMap.get(ingredient.canonicalId) : null;
      const candidate = {
        canonicalId: ingredient.canonicalId,
        displayName: canonical?.displayName ?? ingredient.name,
      };
      const current = existing.find((item) => itemKey(item) === itemKey(candidate));
      const item = current ?? await insertShoppingListItem({
        canonicalId: ingredient.canonicalId,
        displayName: candidate.displayName,
        normalizedName: candidate.displayName.toLocaleLowerCase(),
        requestedQty: ingredient.quantity,
        requestedUnit: ingredient.unit,
        category: canonical?.foodClass ?? 'other',
      });
      await addShoppingListSource({
        shoppingItemId: item.id,
        kind: 'recipe_missing',
        sourceId: ingredient.id,
        recipeId: recipe.id,
      });
      if (!current) added += 1;
    }
    toast.show({ kind: 'success', message: added > 0 ? `${added} missing ingredient${added === 1 ? '' : 's'} added to your grocery haul.` : 'Your grocery haul already covers this recipe.' });
  };

  if (!recipe) return <Screen><EmptyState title="Recipe not found" actionLabel="Back to recipes" onAction={() => router.replace('/recipes')} /></Screen>;

  return (
    <Screen scroll footer={recipe.status === 'ready' ? <Button label="I cooked this" loading={saving} onPress={() => void cook()} /> : undefined}>
      <View style={styles.header}>
        <ScreenTitle>{recipe.title}</ScreenTitle>
        <Button label="Close" variant="ghost" block={false} onPress={() => router.back()} />
      </View>
      <View style={styles.content}>
        {recipe.sourceLink ? (
          <Pressable onPress={() => void Linking.openURL(recipe.sourceLink!)} accessibilityRole="link" accessibilityLabel="Open original recipe source" style={({ pressed }) => [styles.source, pressed && { opacity: opacity.pressed }]}>
            <Caption>Open original source</Caption>
            <Caption muted numberOfLines={1}>{recipe.sourceLink}</Caption>
          </Pressable>
        ) : <Caption muted>No source link was provided with this recipe.</Caption>}

        {recipe.status === 'awaiting_content' ? (
          <Card>
            <Body>Add the ingredients when you have them</Body>
            <Caption muted>This link was saved without usable recipe text. Paste the caption or add a screenshot from Saved recipes.</Caption>
            <Button label="Back to recipes" variant="secondary" block={false} onPress={() => router.replace('/recipes')} style={styles.emptyAction} />
          </Card>
        ) : <>
          <Card title="Kitchen coverage">
            <Coverage label="You have" names={coverage?.held ?? []} empty="Nothing matched in your pantry yet." />
            <Coverage label="Missing" names={coverage?.missing ?? []} empty="Nothing missing." />
            {(coverage?.unresolved.length ?? 0) > 0 ? <Coverage label="Needs a match" names={coverage?.unresolved ?? []} empty="" /> : null}
            <Button label="Add missing ingredients" variant="secondary" onPress={() => void addMissingToShoppingList()} />
          </Card>
          <Card title="Ingredients">
            <Caption muted>Ingredients can be corrected at any time.</Caption>
            <View style={styles.list}>{recipe.ingredients.map((ingredient) => <View key={ingredient.id} style={styles.ingredient}><Body>{ingredient.name}</Body><Caption muted>{ingredient.quantity === null ? 'No amount stated' : `${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ''}`}</Caption></View>)}</View>
          </Card>
          {recipe.steps.length > 0 ? <Card title="Method"><Caption muted>The original method, kept for your own reference.</Caption><View style={styles.list}>{recipe.steps.map((step, index) => <Body key={`${step}-${index}`}>{index + 1}. {step}</Body>)}</View></Card> : null}
        </>}
      </View>
      <ConfirmMatchSheet
        visible={confirming}
        matches={confirmationMatches}
        onClose={() => setConfirming(false)}
        onResolved={persistConfirmedMatch}
      />
      <RecipeIngredientEditor
        visible={editingIngredients}
        ingredients={recipe.ingredients}
        canonicalNames={new Map([...canonicals].map(([key, value]) => [key, value.displayName]))}
        onClose={() => setEditingIngredients(false)}
        onSave={saveIngredients}
      />
    </Screen>
  );
}

function Coverage({ label, names, empty }: { label: string; names: readonly string[]; empty: string }) {
  return <View style={styles.coverage}><SectionLabel muted>{label}</SectionLabel><Caption>{names.length > 0 ? names.join(', ') : empty}</Caption></View>;
}

const styles = StyleSheet.create({
  emptyAction: { marginTop: space.sm },
  header: { marginTop: space.base, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { gap: space.base, marginTop: space.lg },
  source: { gap: space.xs, paddingVertical: space.sm },
  coverage: { gap: space.xs, marginBottom: space.base },
  list: { gap: space.sm, marginTop: space.sm },
  ingredient: { gap: space.xs },
});
