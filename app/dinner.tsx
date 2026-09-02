import { nextSunday } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DishVisual } from '@/components/DishVisual';
import { StateIllustration } from '@/components/StateIllustration';
import { Segmented } from '@/components/Choice';
import { Body, Caption, RowTitle, ScreenTitle } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { MealSwipeDeck } from '@/components/suggestions/MealSwipeDeck';
import { MealSuggestionSkeleton } from '@/components/skeleton/SkeletonLayouts';
import { SuggestionPreferenceSheet } from '@/components/suggestions/PreferenceSheet';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { addShoppingListSource, getAllCanonicals, insertShoppingListItem, listShoppingItems, clearSuggestionPreference, saveSuggestionPreference } from '@/db/queries';
import { localDateString } from '@/logic/dates';
import { mealSavedMessage } from '@/logic/feedback';
import { SUGGESTION_INTENT_POLICIES } from '@/logic/suggestionTemplates';
import { formatGrams, roundCalories } from '@/logic/scaling';
import {
  getResolvedTonightPreference,
  getRecommendedTonightBaseIntent,
  getOrGenerateSuggestions,
  mealFromSuggestion,
  type SuggestionOutcome,
} from '@/logic/suggestionService';
import { useDayStore } from '@/store/dayStore';
import { usePantryStore } from '@/store/pantryStore';
import { itemKey } from '@/logic/shoppingList';
import type {
  CanonicalItem,
  Suggestion,
  SuggestionBaseIntent,
  SuggestionMode,
  SuggestionPrepSpeed,
  SuggestionTargetMacro,
  TonightSuggestionPreference,
} from '@/types';

const MODE_OPTIONS = [
  { value: 'tonight' as SuggestionMode, label: 'Tonight' },
  { value: 'stretch' as SuggestionMode, label: 'Make it to Sunday' },
];

/** "What's for dinner": three ideas from what's already on hand, or a plan to Sunday. */
export default function DinnerScreen() {
  const router = useRouter();
  const { macro } = useLocalSearchParams<{ macro?: SuggestionTargetMacro }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const target = useDayStore((state) => state.target);
  const consumed = useDayStore((state) => state.consumed);
  const addMeal = useDayStore((state) => state.addMeal);
  const refresh = useDayStore((state) => state.refresh);
  const pantryRevision = usePantryStore((state) => state.revision);
  const pantryGroups = usePantryStore((state) => state.groups);
  const remaining = target && consumed.calories !== null
    ? target.targetCalories - roundCalories(consumed.calories)
    : null;

  const [mode, setMode] = useState<SuggestionMode>(macro ? 'macro_gap' : 'tonight');
  const [outcome, setOutcome] = useState<SuggestionOutcome | { status: 'loading' }>({
    status: 'loading',
  });
  const [canonicals, setCanonicals] = useState<Map<string, CanonicalItem>>(new Map());
  const [tuning, setTuning] = useState(false);
  const [tonightPreference, setTonightPreference] = useState<TonightSuggestionPreference | null>(null);
  const [recommendedIntent, setRecommendedIntent] = useState<SuggestionBaseIntent>('balanced');

  const load = useCallback(async (nextMode: SuggestionMode, forceRefresh = false) => {
    setOutcome({ status: 'loading' });
    const result = await getOrGenerateSuggestions({
      localDate: localDateString(),
      mode: nextMode,
      targetMacro: nextMode === 'macro_gap' ? macro : undefined,
      // "Make it to Sunday" — the closest one, always ahead.
      untilDate: nextMode === 'stretch' ? localDateString(nextSunday(new Date())) : undefined,
      forceRefresh,
    });
    setOutcome(result);
    if (result.status === 'ready' && nextMode === 'tonight') {
      setTonightPreference(result.set.tonightPreference);
    }
  }, [macro, pantryRevision]);

  useEffect(() => {
    void load(mode);
  }, [mode, load]);

  useEffect(() => {
    void getAllCanonicals().then((list) => {
      setCanonicals(new Map(list.map((c) => [c.id, c])));
    });
  }, []);

  useEffect(() => {
    void getRecommendedTonightBaseIntent().then(setRecommendedIntent);
  }, []);

  const confirmCooked = async (
    cooking: Suggestion,
    servingsMade: number,
    servingsEaten: number,
  ) => {
    const meal = mealFromSuggestion({
      suggestion: cooking,
      servingsMade,
      servingsEaten,
      localDate: localDateString(),
      canonicals,
    });
    const stored = await addMeal(meal);
    await refresh();
    await usePantryStore.getState().refresh();
    const depleted = useDayStore.getState().lastDepletion;
    toast.show({
      kind: 'success',
      message: mealSavedMessage(depleted?.names ?? []),
    });
    router.dismissAll();
    router.replace({ pathname: '/(tabs)', params: { savedMealId: stored.id } });
  };

  const addSuggestionGaps = async (suggestion: Suggestion, suggestionId: string) => {
    const existing = await listShoppingItems(true);
    let added = 0;
    for (const missing of suggestion.missing) {
      const candidate = { canonicalId: missing.canonicalId, displayName: missing.name };
      const current = existing.find((item) => itemKey(item) === itemKey(candidate));
      const item = current ?? await insertShoppingListItem({
        canonicalId: missing.canonicalId,
        displayName: missing.name,
        normalizedName: missing.name.toLocaleLowerCase(),
        category: 'other',
      });
      await addShoppingListSource({ shoppingItemId: item.id, kind: 'suggestion_missing', suggestionId });
      if (!current) added += 1;
    }
    toast.show({ kind: 'success', message: added > 0 ? `${added} missing ingredient${added === 1 ? '' : 's'} added to your grocery haul.` : 'Your grocery haul already covers this idea.' });
  };

  const suggestions: Suggestion[] =
    outcome.status === 'ready'
      ? mode === 'stretch'
        ? (outcome.set.stretch?.dinners ?? [])
        : outcome.set.suggestions
      : [];
  // Provider/scorer order already incorporates the remaining budget. Keeping
  // this array identity stable prevents a diary refresh after cooking from
  // rebuilding the deck and resurrecting the just-saved card.
  const deckSuggestions = suggestions;
  const onHandCanonicalIds = useMemo(() => new Set(
    pantryGroups
      .filter((group) => group.entries.some((entry) => entry.status !== 'out'))
      .map((group) => group.canonicalId),
  ), [pantryGroups]);
  const shortfall = outcome.status === 'ready' ? (outcome.set.stretch?.shortfall ?? null) : null;
  const droppedForConstraint =
    outcome.status === 'ready' ? outcome.set.droppedForConstraint : 0;
  const droppedForDiet = outcome.status === 'ready' ? outcome.set.droppedForDiet : 0;
  const macroGapContext = outcome.status === 'ready' ? outcome.set.macroGapContext : null;
  const macroLabel = outcome.status === 'ready' && outcome.set.targetMacro
    ? outcome.set.targetMacro === 'carbs' ? 'carbohydrate' : outcome.set.targetMacro
    : null;
  const savePreference = async (
    baseIntent: SuggestionBaseIntent,
    prepSpeed: SuggestionPrepSpeed,
  ) => {
    await saveSuggestionPreference(baseIntent, prepSpeed);
    setTuning(false);
    await load('tonight');
  };

  const resetPreference = async () => {
    await clearSuggestionPreference();
    setTuning(false);
    await load('tonight');
  };

  const openTuning = async () => {
    const [resolved, recommended] = await Promise.all([
      tonightPreference ? Promise.resolve(tonightPreference) : getResolvedTonightPreference(),
      getRecommendedTonightBaseIntent(),
    ]);
    setTonightPreference(resolved);
    setRecommendedIntent(recommended);
    setTuning(true);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ScreenTitle>What's for dinner</ScreenTitle>
        <Button label="Close" variant="ghost" block={false} onPress={() => router.back()} />
      </View>

      {mode !== 'macro_gap' ? <View style={styles.modeRow}>
        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </View> : null}

      {mode === 'tonight' && tonightPreference ? (
        <Pressable
          onPress={() => void openTuning()}
          accessibilityRole="button"
          accessibilityLabel="Tune dinner suggestions"
          style={({ pressed }) => [styles.preferenceSummary, pressed && { opacity: opacity.pressed }]}
        >
          <Caption muted>
            {SUGGESTION_INTENT_POLICIES[tonightPreference.baseIntent].label} · {tonightPreference.prepSpeed === 'quick' ? 'Quick' : 'Standard'}
          </Caption>
          <Caption>Tune dinner</Caption>
        </Pressable>
      ) : null}

      <ScrollView
        scrollEnabled={mode === 'stretch'}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        {outcome.status === 'loading' ? (
          <View style={styles.centered} accessibilityLiveRegion="polite">
            <MealSuggestionSkeleton />
            <Caption muted accessibilityRole="alert">Finding ideas from your pantry…</Caption>
          </View>
        ) : outcome.status === 'no_key' ? (
          <Card>
            <Body>Add an API key to get ideas</Body>
            <Caption muted>Suggestions come from the same key photo estimates use. Your pantry and calorie tracking work fine without one.</Caption>
            <Button label="Open Settings" variant="secondary" block={false} onPress={() => router.push('/(tabs)/settings')} style={styles.emptyAction} />
            <Button label="Enter manually" variant="secondary" block={false} onPress={() => router.push('/manual')} style={styles.emptyAction} />
          </Card>
        ) : outcome.status === 'error' ? (
          <Card>
            <Body>Couldn't get suggestions</Body>
            <Caption muted>{outcome.message}</Caption>
            <Button label="Try again" variant="secondary" block={false} onPress={() => void load(mode, true)} style={styles.emptyAction} />
          </Card>
        ) : outcome.status === 'met_target' ? (
          <Card>
            <Body>That target is already met</Body>
            <Caption muted>There is no remaining gap to solve.</Caption>
          </Card>
        ) : outcome.status === 'insufficient_data' ? (
          <Card>
            <Body>
              {outcome.reason === 'consumed_total_unknown'
                ? 'This day’s macro total is unavailable'
                : 'Not enough catalogue nutrition yet'}
            </Body>
            <Caption muted>
              {outcome.reason === 'consumed_total_unknown'
                ? 'One or more logged meals has an unknown value for this macro, so Mise cannot calculate the gap.'
                : 'Mise cannot calculate a pantry contribution for this macro from current data.'}
            </Caption>
          </Card>
        ) : suggestions.length === 0 && droppedForDiet > 0 ? (
          <Card>
            <Body>Nothing left after your dietary rules</Body>
            <Caption muted>Every idea today ran into something you avoid. Try again for a fresh set.</Caption>
            <Button label="Try again" variant="secondary" block={false} onPress={() => void load(mode, true)} style={styles.emptyAction} />
          </Card>
        ) : suggestions.length === 0 && droppedForConstraint > 0 ? (
          <Card>
            <Body>Nothing left after using what needs using first</Body>
            <Caption muted>Every idea today skipped what's expiring soon. Try again for a fresh set.</Caption>
            <Button label="Try again" variant="secondary" block={false} onPress={() => void load(mode, true)} style={styles.emptyAction} />
          </Card>
        ) : suggestions.length === 0 ? (
          // Only this branch. Loading, a missing key, a provider error, a met
          // target, and insufficient catalogue data are all different states,
          // and an empty pot would describe none of them honestly.
          <Card>
            <StateIllustration
              name="no-dinner-suggestion"
              accessibilityLabel="An empty cooking pot with its lid resting beside it"
            />
            <Body>Nothing to suggest right now</Body>
          </Card>
        ) : (
          <>
            {mode === 'stretch' && shortfall ? (
              <Card>
                <Body>{shortfall}</Body>
              </Card>
            ) : null}
            {droppedForConstraint > 0 ? (
              <Caption muted>
                {droppedForConstraint === 1
                  ? '1 idea was dropped for not using what needs using first.'
                  : `${droppedForConstraint} ideas were dropped for not using what needs using first.`}
              </Caption>
            ) : null}
            {droppedForDiet > 0 ? (
              <Caption muted>
                {droppedForDiet === 1
                  ? '1 idea was dropped for what you avoid.'
                  : `${droppedForDiet} ideas were dropped for what you avoid.`}
              </Caption>
            ) : null}
            {mode === 'stretch' ? suggestions.map((suggestion, index) => (
              <SuggestionCard key={`${suggestion.dish}-${index}`} suggestion={suggestion} canonicals={canonicals} remaining={remaining} onCook={() => void confirmCooked(suggestion, suggestion.servings, 1)} onAddMissing={() => void addSuggestionGaps(suggestion, `${localDateString()}:${mode}:${index}:${suggestion.dish}`)} />
            )) : (
              <MealSwipeDeck
                meals={deckSuggestions}
                targetCalories={target?.targetCalories ?? null}
                consumedCalories={consumed.calories}
                canonicals={canonicals}
                onHandCanonicalIds={onHandCanonicalIds}
                onCook={confirmCooked}
                onPass={() => undefined}
                onUndo={() => undefined}
                onRefresh={() => void load(mode, true)}
                onManual={() => router.push('/manual')}
              />
            )}
          </>
        )}

        {outcome.status === 'ready' && mode === 'macro_gap' && macroGapContext && macroLabel ? (
          <Card>
            <Body>
              {macroGapContext.bestAchievableG < macroGapContext.shortfallG
                ? `Your measurable pantry stock can add up to ${formatGrams(macroGapContext.bestAchievableG)} g of ${macroLabel} toward this ${formatGrams(macroGapContext.shortfallG)} g shortfall.`
                : `Your measurable pantry stock can cover this ${formatGrams(macroGapContext.shortfallG)} g ${macroLabel} shortfall.`}
            </Body>
            {macroGapContext.partialCoverage ? (
              <Caption muted>That figure only includes ingredients with known catalogue nutrition.</Caption>
            ) : null}
          </Card>
        ) : null}

        {outcome.status === 'ready' ? (
          <Pressable
            onPress={() => void load(mode, true)}
            accessibilityRole="button"
            accessibilityLabel="Refresh suggestions"
            style={({ pressed }) => [styles.refresh, pressed && { opacity: opacity.pressed }]}
          >
            <Caption muted>
              {outcome.fromCache ? 'From your last check — refresh for new ideas' : 'Refresh'}
            </Caption>
          </Pressable>
        ) : null}
      </ScrollView>

      {tonightPreference ? (
        <SuggestionPreferenceSheet
          visible={tuning}
          preference={tonightPreference}
          recommendedIntent={recommendedIntent}
          onClose={() => setTuning(false)}
          onSave={(baseIntent, prepSpeed) => void savePreference(baseIntent, prepSpeed)}
          onUseRecommended={() => void resetPreference()}
        />
      ) : null}
    </View>
  );
}

function SuggestionCard({
  suggestion,
  canonicals,
  remaining,
  onCook,
  onAddMissing,
}: {
  suggestion: Suggestion;
  canonicals: Map<string, CanonicalItem>;
  remaining: number | null;
  onCook: () => void;
  onAddMissing: () => void;
}) {
  const kcal = roundCalories(suggestion.kcalPerServing);
  const overshoots = remaining !== null && kcal > remaining;
  const foodClasses = suggestion.uses.map((use) => canonicals.get(use.canonicalId)?.foodClass ?? null);

  return (
    <Card>
      <View style={styles.cardHeader}>
        <DishVisual
          dish={suggestion.dish}
          foodClasses={foodClasses}
          size="md"
        />
        <View style={styles.cardTitleWrap}>
          <RowTitle>{suggestion.dish}</RowTitle>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Caption>
            {kcal} kcal
            {remaining !== null
              ? overshoots
                ? ` — over your remaining ${remaining}, try a smaller portion`
                : ` — fits your remaining ${remaining}`
              : ' per serving'}
          </Caption>
        </View>
        <View style={styles.chip}>
          <Caption>{suggestion.effortMinutes} min</Caption>
        </View>
      </View>

      {suggestion.portionRecommendation ? (
        <Caption muted style={styles.portion}>{suggestion.portionRecommendation.label}</Caption>
      ) : null}

      <View style={styles.chipRow}>
        {suggestion.reasons.map((reason, index) => (
          <View key={index} style={styles.reasonChip}>
            <Caption muted>{reason.label}</Caption>
          </View>
        ))}
      </View>

      {suggestion.missing.length > 0 ? (
        <View style={styles.missingBlock}>
          <Caption muted style={styles.missing}>Missing: {suggestion.missing.map((m) => m.name).join(', ')}</Caption>
          <Button label="Add missing to grocery haul" variant="secondary" onPress={onAddMissing} style={styles.cookButton} />
        </View>
      ) : null}

      {suggestion.method.length > 0 ? (
        <View style={styles.method}>
          <Caption muted>An idea, not a tested recipe:</Caption>
          {suggestion.method.map((step, index) => (
            <Body key={index} style={styles.methodStep}>
              {index + 1}. {step}
            </Body>
          ))}
        </View>
      ) : null}

      <Button
        label="I cooked this"
        variant="secondary"
        onPress={onCook}
        style={styles.cookButton}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground },
  emptyAction: { marginTop: space.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenGutter,
  },
  modeRow: { paddingHorizontal: layout.screenGutter, paddingTop: space.sm },
  preferenceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.sm,
  },
  content: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.lg,
    gap: space.base,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xs,
  },
  cardTitleWrap: {
    flex: 1,
  },
  centered: { alignItems: 'center', paddingVertical: space.xxxl },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  chip: {
    backgroundColor: color.ground,
    borderRadius: radius.input,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  reasonChip: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.input,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  missing: { marginTop: space.sm },
  missingBlock: { marginTop: space.sm },
  portion: { marginTop: space.sm },
  method: { marginTop: space.sm, gap: space.xs },
  methodStep: {},
  cookButton: { marginTop: space.base },
  refresh: { alignItems: 'center', paddingVertical: space.base },
});
