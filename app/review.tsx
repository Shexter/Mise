import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  VisionError,
  copyForError,
  estimateMeal,
} from '@/api/vision';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Skeleton, SkeletonLine, SkeletonText } from '@/components/Skeleton';
import { HiddenIngredientSheet } from '@/components/review/HiddenIngredientSheet';
import { MealModifierControls } from '@/components/review/MealModifierControls';
import { HistoryCalendarSheet } from '@/components/HistoryCalendarSheet';
import { ItemRow } from '@/components/review/ItemRow';
import { QuantitySheet } from '@/components/review/QuantitySheet';
import {
  Body,
  Caption,
  MealCalories,
  ScreenTitle,
  SectionLabel,
} from '@/components/Type';
import { useToast } from '@/components/Toast';
import {
  color,
  duration,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';
import { matchSuggestion } from '@/constants/hiddenIngredients';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { friendlyDate, localDateString, mealTypeForTime } from '@/logic/dates';
import { mealSavedMessage } from '@/logic/feedback';
import {
  createMealModifierState,
  transitionMealVenue,
  transitionServingsMultiplier,
} from '@/logic/mealModifiers';
import { formatGrams, macrosOfItems, roundCalories } from '@/logic/scaling';
import { deletePhoto } from '@/media/photos';
import type { NewMeal } from '@/db/queries';
import { useCaptureStore } from '@/store/captureStore';
import { useDayStore } from '@/store/dayStore';
import { lastServingsForDish } from '@/db/queries';
import { saveDishVenueDefault } from '@/db/queries';
import { inferVenueForDraft } from '@/logic/venueService';
import { deriveResolvedFibre } from '@/logic/nutrition';
import { getCanonicalById } from '@/db/queries';
import { resolveIngredientReferencesLocally } from '@/logic/resolution';
import type {
  Confidence,
  EstimatedItem,
  MealItem,
  VenueAssessment,
} from '@/types';

type Phase =
  | { kind: 'analyzing'; retryDelayMs?: number }
  | { kind: 'error'; error: VisionError }
  | { kind: 'review' };

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const toast = useToast();
  const { photoUri, base64, estimate, mealDraft, clear } = useCaptureStore();
  const draftSource = mealDraft?.source ?? 'photo';

  const [selectedDate, setSelectedDate] = useState(
    () => mealDraft?.localDate || useDayStore.getState().selectedDate || localDateString(),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  const loggedDateSet = useDayStore((state) => state.loggedDateSet);
  const earliestLoggedDate = useDayStore((state) => state.earliestLoggedDate);
  const loadMonthSummaries = useDayStore((state) => state.loadMonthSummaries);

  const addMeal = useDayStore((state) => state.addMeal);

  const [phase, setPhase] = useState<Phase>(
    estimate || mealDraft ? { kind: 'review' } : { kind: 'analyzing' },
  );
  const [mealName, setMealName] = useState(mealDraft?.name ?? estimate?.mealName ?? 'Meal');
  const [items, setItems] = useState<MealItem[]>(() =>
    mealDraft
      ? mealDraft.items.map(toDraftMealItem)
      : estimate?.items.map((item) => toMealItem(item, false)) ?? [],
  );
  const [confidence, setConfidence] = useState<Confidence | null>(
    mealDraft?.confidence ?? estimate?.confidence ?? null,
  );
  const [suggestions, setSuggestions] = useState<string[]>(
    mealDraft ? [] : estimate?.likelyHiddenIngredients ?? [],
  );
  const [venueAssessment, setVenueAssessment] = useState<VenueAssessment | null>(
    estimate?.venueAssessment ?? null,
  );
  const [modifiers, setModifiers] = useState(() =>
    createMealModifierState(
      mealDraft?.mealType ?? mealTypeForTime(),
      mealDraft?.venue ?? 'home',
      mealDraft?.servingsMult ?? 1,
    ),
  );

  const [editing, setEditing] = useState<MealItem | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [hiddenSuggestionsOpen, setHiddenSuggestionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const venueChangedRef = useRef(false);

  // Combine the estimate with on-device stock, batch, and learned-dish
  // signals. A user's tap permanently takes precedence over later async work.
  useEffect(() => {
    if (phase.kind !== 'review' || draftSource !== 'photo') return;
    let active = true;
    void inferVenueForDraft(mealName, items, venueAssessment).then((inferred) => {
      if (!active) return;
      if (!venueChangedRef.current) {
        setModifiers((current) => transitionMealVenue(current, inferred));
      }
    });
    return () => {
      active = false;
    };
  }, [draftSource, items, mealName, phase.kind, venueAssessment]);

  // A repeated dish remembers its yield, so the batch cook that made four
  // portions last time offers four again.
  useEffect(() => {
    if (draftSource !== 'photo') return;
    const dish = mealName.trim();
    if (dish.length === 0) return;
    let active = true;
    void lastServingsForDish(dish).then((remembered) => {
      if (active && remembered) {
        setModifiers((current) =>
          transitionServingsMultiplier(current, remembered),
        );
      }
    });
    return () => {
      active = false;
    };
  }, [draftSource, mealName]);

  const runEstimate = useCallback(async () => {
    if (!base64) {
      setPhase({ kind: 'error', error: new VisionError('malformed', 'No photo.') });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'analyzing' });
    try {
      const result = await estimateMeal(base64, controller.signal, (retryDelayMs) => {
        setPhase({ kind: 'analyzing', retryDelayMs });
      });
      setMealName(result.mealName);
      setItems(result.items.map((item) => toMealItem(item, false)));
      setConfidence(result.confidence);
      setSuggestions(result.likelyHiddenIngredients);
      setVenueAssessment(result.venueAssessment);
      setPhase({ kind: 'review' });
    } catch (error) {
      const visionError =
        error instanceof VisionError
          ? error
          : new VisionError('malformed', 'The estimate failed.');
      if (visionError.kind !== 'cancelled') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      setPhase({ kind: 'error', error: visionError });
    }
  }, [base64]);

  useEffect(() => {
    if (!estimate && !mealDraft) void runEstimate();
    return () => abortRef.current?.abort();
    // Only on mount — estimate is a snapshot handed off from capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = macrosOfItems(items);

  const applyItem = (next: MealItem) => {
    setItems((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const addItem = (estimated: EstimatedItem) => {
    setItems((current) => [...current, toMealItem(estimated, true)]);
  };

  const addSuggestion = (suggestion: string) => {
    const match = matchSuggestion(suggestion);
    if (match) {
      addItem({
        name: match.name,
        quantity: match.defaultQuantity,
        unit: match.unit,
        calories: match.calories,
        proteinG: match.proteinG,
        carbsG: match.carbsG,
        fatG: match.fatG,
      });
    } else {
      addItem({
        name: suggestion,
        quantity: 1,
        unit: 'serving',
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      });
    }
    setSuggestions((current) => current.filter((value) => value !== suggestion));
  };

  const discard = () => {
    deletePhoto(photoUri);
    clear();
    router.back();
  };

  const save = async () => {
    if (items.length === 0) return;
    setSaving(true);
    const localDate = selectedDate;
    const resolvedItems = await Promise.all(items.map(async (item) => {
      const outcome = item.canonicalId
        ? { status: 'resolved' as const, canonicalId: item.canonicalId }
        : draftSource === 'recipe'
          ? undefined
          : (await resolveIngredientReferencesLocally([{ raw: item.name }], 'vision'))[0];
      const canonicalId = outcome?.status === 'resolved' ? outcome.canonicalId : item.canonicalId;
      const canonical = canonicalId ? await getCanonicalById(canonicalId) : null;
      const fibre = deriveResolvedFibre(null, canonical, item.quantity, item.unit);
      return { ...item, canonicalId, fibreG: fibre.value };
    }));
    const meal: NewMeal = {
      loggedAt: new Date().toISOString(),
      localDate,
      mealType: modifiers.mealType,
      name: mealName.trim() || 'Meal',
      photoUri: mealDraft?.photoUri ?? photoUri,
      source: draftSource,
      confidence,
      venue: modifiers.venue,
      servingsMult: modifiers.servingsMult,
      items: resolvedItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        fibreG: item.fibreG,
        isManualAddition: item.isManualAddition,
        canonicalId: item.canonicalId,
      })),
    };
    const stored = await addMeal(meal);
    if (draftSource === 'photo' && venueChangedRef.current) {
      try {
        await saveDishVenueDefault(meal.name, modifiers.venue);
      } catch {
        // The meal is the authority. A failed preference write must not make a
        // successful food log look failed.
      }
    }
    clear();
    // The success haptic completes the save sequence in §7.6; the segment
    // scale-in and hero count-down play once Today re-renders with the new meal.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // An automatic pantry change should be visible, not silent — the user
    // needs to know why their stock moved.
    const depleted = useDayStore.getState().lastDepletion;
    toast.show({
      kind: 'success',
      message: mealSavedMessage(depleted?.names ?? []),
    });
    router.dismissAll();
    router.replace({ pathname: '/(tabs)', params: { savedMealId: stored.id } });
  };

  /* ----------------------------- Analyzing ----------------------------- */

  if (phase.kind === 'analyzing') {
    return <ReviewLoadingScreen photoUri={photoUri} retrying={phase.retryDelayMs !== undefined} onCancel={() => {
      abortRef.current?.abort();
      discard();
    }} />;
  }

  /* ------------------------------- Error ------------------------------- */

  if (phase.kind === 'error') {
    const copy = copyForError(
      phase.error,
      phase.error instanceof VisionError ? phase.error.provider : null,
    );
    return (
      <View style={[styles.root, styles.errorRoot, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.errorContent}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.errorPhoto} />
          ) : null}
          <ScreenTitle accessibilityRole="alert">{copy.title}</ScreenTitle>
          <Body muted>{copy.detail}</Body>
          <View style={styles.errorActions}>
            {copy.action === 'retry' ? (
              <Button label="Try again" onPress={() => void runEstimate()} />
            ) : null}
            <Button
              label="Enter by hand"
              variant="secondary"
              onPress={() => router.replace('/manual')}
            />
            <Button label="Discard" variant="ghost" onPress={discard} />
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ------------------------------- Review ------------------------------ */

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(duration.quick)}
      style={[styles.reviewRoot, { paddingTop: insets.top }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.reviewScroll}
          contentContainerStyle={styles.reviewContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.thumb} />
        ) : null}

        <View style={styles.section}>
          <SectionLabel muted>Date</SectionLabel>
          <Button
            label={friendlyDate(selectedDate)}
            variant="secondary"
            onPress={() => setCalendarOpen(true)}
          />
        </View>

        <Field value={mealName} onChangeText={setMealName} label="Meal" />

        <View style={styles.totals}>
          <View>
            <SectionLabel muted>Total</SectionLabel>
            <MealCalories numeric>{totals.calories === null ? '—' : roundCalories(totals.calories)}</MealCalories>
          </View>
          <Caption muted numeric style={styles.totalsMacros}>
            P {formatGrams(totals.proteinG)} · C {formatGrams(totals.carbsG)} · F{' '}
            {formatGrams(totals.fatG)}
          </Caption>
        </View>

        {confidence === 'low' ? (
          <View style={styles.nudge}>
            <Caption muted>
              Estimate may be off — worth checking the portions.
            </Caption>
          </View>
        ) : null}

        <Card title="Items" padded={false}>
          {items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ItemRow item={item} onPress={setEditing} onRemove={removeItem} />
            </View>
          ))}
          {items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Caption muted>No items. Add one below.</Caption>
            </View>
          ) : null}
        </Card>

        {suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            <Pressable
              onPress={() => setHiddenSuggestionsOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: hiddenSuggestionsOpen }}
              accessibilityLabel="Possible hidden ingredients"
              style={({ pressed }) => [
                styles.suggestionDisclosure,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <SectionLabel muted>Possible hidden ingredients</SectionLabel>
              <Caption muted>{hiddenSuggestionsOpen ? 'Hide' : `Show ${suggestions.length}`}</Caption>
            </Pressable>
            {hiddenSuggestionsOpen ? (
              <View style={styles.chips}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => addSuggestion(suggestion)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${suggestion}`}
                    style={({ pressed }) => [
                      styles.chip,
                      pressed && { opacity: opacity.pressed },
                    ]}
                  >
                    <Caption>+ {suggestion}</Caption>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Button
          label="Add hidden ingredient"
          variant="secondary"
          onPress={() => setHiddenOpen(true)}
        />

        <MealModifierControls
          value={modifiers}
          onChange={setModifiers}
          onVenueChange={(next) => {
            if (next !== modifiers.venue) venueChangedRef.current = true;
          }}
        />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
          <Button
            label="Save changes"
            onPress={() => void save()}
            disabled={items.length === 0}
            loading={saving}
          />
          <Button label="Cancel" variant="secondary" onPress={discard} />
        </View>
      </KeyboardAvoidingView>

      <QuantitySheet
        item={editing}
        onClose={() => setEditing(null)}
        onApply={applyItem}
      />
      <HiddenIngredientSheet
        visible={hiddenOpen}
        onClose={() => setHiddenOpen(false)}
        onAdd={addItem}
      />
      <HistoryCalendarSheet
        visible={calendarOpen}
        selectedDate={selectedDate}
        loggedDates={loggedDateSet}
        earliestLoggedDate={earliestLoggedDate}
        loadSummaries={loadMonthSummaries}
        onSelect={(date) => {
          setSelectedDate(date);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />
    </Animated.View>
  );
}

function toMealItem(estimated: EstimatedItem, manual: boolean): MealItem {
  return {
    id: randomUUID(),
    mealId: '',
    name: estimated.name,
    quantity: estimated.quantity,
    unit: estimated.unit,
    calories: estimated.calories,
    proteinG: estimated.proteinG,
    carbsG: estimated.carbsG,
    fatG: estimated.fatG,
    fibreG: estimated.fibreG ?? null,
    isManualAddition: manual,
    sortOrder: 0,
    canonicalId: null,
  };
}

function toDraftMealItem(item: NewMeal['items'][number]): MealItem {
  return {
    id: randomUUID(),
    mealId: '',
    ...item,
    fibreG: item.fibreG ?? null,
    sortOrder: 0,
    canonicalId: item.canonicalId ?? null,
  };
}

function ReviewLoadingScreen({
  photoUri,
  retrying,
  onCancel,
}: {
  photoUri: string | null;
  retrying: boolean;
  onCancel: () => void;
}) {
  return (
    <View style={styles.reviewRoot}>
      <ScrollView contentContainerStyle={styles.loadingContent} showsVerticalScrollIndicator={false}>
         {photoUri ? <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" /> : null}
         {/* <ReviewSkeleton /> is represented here by the structured fields so the photo stays visible. */}
         <View accessible accessibilityRole="progressbar" accessibilityLabel={retrying ? 'Retrying meal estimate' : 'Reading your plate…'} accessibilityState={{ busy: true }} style={styles.loadingFields}>
          <SectionLabel muted>Name</SectionLabel>
          <Skeleton width="100%" height={56} />

          <SectionLabel muted>Meal</SectionLabel>
          <Skeleton width="100%" height={52} />

          <SectionLabel muted>Where from</SectionLabel>
          <Skeleton width="100%" height={52} />

          <Card title="Current total">
            <Skeleton width={150} height={36} />
            <SkeletonLine width="78%" />
          </Card>

          <View style={styles.loadingItemsHeader}>
            <SectionLabel muted>Items</SectionLabel>
            <SkeletonText width={88} />
          </View>
          <Card padded={false}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={styles.loadingItemRow}>
                <SkeletonText width={row === 1 ? '58%' : '72%'} />
                <Skeleton width={18} height={18} radius={radius.full} />
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
      <View style={styles.loadingFooter}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
        <Button label="Save changes" disabled onPress={() => undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  errorRoot: { backgroundColor: color.ground },
  errorContent: {
    padding: layout.screenGutter,
    gap: space.base,
  },
  errorPhoto: {
    width: '100%',
    height: 200,
    borderRadius: radius.card,
    marginBottom: space.sm,
  },
  errorActions: { gap: space.sm, marginTop: space.base },

  reviewRoot: { flex: 1, backgroundColor: color.ground },
  keyboardArea: { flex: 1 },
  reviewScroll: { flex: 1 },
  section: { gap: space.sm },
  reviewContent: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.base,
    paddingBottom: space.xxxl,
    gap: space.base,
  },
  loadingContent: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.base,
    paddingBottom: 140,
    gap: space.base,
  },
  loadingFields: { gap: space.sm },
  loadingItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.sm,
  },
  loadingItemRow: {
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  loadingFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenGutter,
    paddingVertical: space.sm,
    gap: space.sm,
    backgroundColor: color.ground,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  thumb: {
    width: '100%',
    height: 180,
    borderRadius: radius.card,
  },
  totals: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  totalsMacros: { marginBottom: space.xs },
  nudge: {
    backgroundColor: color.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.md,
  },
  divider: {
    height: 1,
    backgroundColor: color.line,
    marginLeft: layout.cardPadding,
  },
  emptyItems: { padding: layout.cardPadding, alignItems: 'center' },
  suggestions: { gap: space.sm },
  suggestionDisclosure: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.input,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.sm,
    gap: space.sm,
    backgroundColor: color.ground,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
});
