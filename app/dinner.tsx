import { nextSunday } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { SuggestionPreferenceSheet } from '@/components/suggestions/PreferenceSheet';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { clearSuggestionPreference, getAllCanonicals, saveSuggestionPreference } from '@/db/queries';
import { localDateString } from '@/logic/dates';
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
  const remaining = target && consumed.calories !== null
    ? target.targetCalories - roundCalories(consumed.calories)
    : null;

  const [mode, setMode] = useState<SuggestionMode>(macro ? 'macro_gap' : 'tonight');
  const [outcome, setOutcome] = useState<SuggestionOutcome | { status: 'loading' }>({
    status: 'loading',
  });
  const [canonicals, setCanonicals] = useState<Map<string, CanonicalItem>>(new Map());
  const [cooking, setCooking] = useState<Suggestion | null>(null);
  const [servingsMade, setServingsMade] = useState(1);
  const [saving, setSaving] = useState(false);
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
  }, [macro]);

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

  const startCooking = (suggestion: Suggestion) => {
    setCooking(suggestion);
    setServingsMade(suggestion.servings);
  };

  const confirmCooked = async () => {
    if (!cooking) return;
    setSaving(true);
    const meal = mealFromSuggestion({
      suggestion: cooking,
      servingsMade,
      localDate: localDateString(),
      canonicals,
    });
    await addMeal(meal);
    await refresh();
    setSaving(false);
    setCooking(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show({ message: 'Meal saved.' });
    router.back();
  };

  const suggestions: Suggestion[] =
    outcome.status === 'ready'
      ? mode === 'stretch'
        ? (outcome.set.stretch?.dinners ?? [])
        : outcome.set.suggestions
      : [];
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        {outcome.status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={color.ink} />
          </View>
        ) : outcome.status === 'no_key' ? (
          <Card>
            <EmptyState
              title="Add an API key to get ideas"
              detail="Suggestions come from the same key photo estimates use. Your pantry and calorie tracking work fine without one."
              actionLabel="Open Settings"
              onAction={() => router.push('/(tabs)/settings')}
            />
          </Card>
        ) : outcome.status === 'error' ? (
          <Card>
            <EmptyState
              title="Couldn't get suggestions"
              detail={outcome.message}
              actionLabel="Try again"
              onAction={() => void load(mode, true)}
            />
          </Card>
        ) : outcome.status === 'met_target' ? (
          <Card><EmptyState title="That target is already met" detail="There is no remaining gap to solve." /></Card>
        ) : outcome.status === 'insufficient_data' ? (
          <Card><EmptyState
            title={outcome.reason === 'consumed_total_unknown'
              ? 'This day’s macro total is unavailable'
              : 'Not enough catalogue nutrition yet'}
            detail={outcome.reason === 'consumed_total_unknown'
              ? 'One or more logged meals has an unknown value for this macro, so Mise cannot calculate the gap.'
              : 'Mise cannot calculate a pantry contribution for this macro from current data.'}
          /></Card>
        ) : suggestions.length === 0 && droppedForDiet > 0 ? (
          <Card>
            <EmptyState
              title="Nothing left after your dietary rules"
              detail="Every idea today ran into something you avoid. Try again for a fresh set."
              actionLabel="Try again"
              onAction={() => void load(mode, true)}
            />
          </Card>
        ) : suggestions.length === 0 && droppedForConstraint > 0 ? (
          <Card>
            <EmptyState
              title="Nothing left after using what needs using first"
              detail="Every idea today skipped what's expiring soon. Try again for a fresh set."
              actionLabel="Try again"
              onAction={() => void load(mode, true)}
            />
          </Card>
        ) : suggestions.length === 0 ? (
          <Card>
            <EmptyState title="Nothing to suggest right now" />
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
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={`${suggestion.dish}-${index}`}
                suggestion={suggestion}
                remaining={remaining}
                onCook={() => startCooking(suggestion)}
              />
            ))}
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

      <Sheet
        visible={cooking !== null}
        onClose={() => setCooking(null)}
        title="I cooked this"
        footer={
          <Button label="Save meal" onPress={() => void confirmCooked()} loading={saving} />
        }
      >
        {cooking ? (
          <View style={styles.sheetBody}>
            <RowTitle>{cooking.dish}</RowTitle>
            <View style={styles.sheetStepper}>
              <SectionLabel muted>Servings this made</SectionLabel>
              <Stepper
                value={servingsMade}
                onChange={setServingsMade}
                step={1}
                min={1}
                max={20}
                label="Servings this made"
              />
            </View>
            <Caption muted>
              Logs {roundCalories(cooking.kcalPerServing)} kcal for one serving eaten now. The
              pantry loses the whole batch.
            </Caption>
            {cooking.estimatedNutritionPerServing ? (
              <Caption muted>
                Nutrition beyond the catalogue is from the initial provider estimate.
              </Caption>
            ) : null}
          </View>
        ) : null}
      </Sheet>

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
  remaining,
  onCook,
}: {
  suggestion: Suggestion;
  remaining: number | null;
  onCook: () => void;
}) {
  const kcal = roundCalories(suggestion.kcalPerServing);
  const overshoots = remaining !== null && kcal > remaining;

  return (
    <Card>
      <RowTitle>{suggestion.dish}</RowTitle>

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
        <Caption muted style={styles.missing}>
          Missing: {suggestion.missing.map((m) => m.name).join(', ')}
        </Caption>
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
  portion: { marginTop: space.sm },
  method: { marginTop: space.sm, gap: space.xs },
  methodStep: {},
  cookButton: { marginTop: space.base },
  refresh: { alignItems: 'center', paddingVertical: space.base },
  sheetBody: { gap: space.base },
  sheetStepper: { gap: space.sm },
});
