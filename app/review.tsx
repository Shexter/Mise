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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  VisionError,
  copyForError,
  estimateMeal,
} from '@/api/vision';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { ReviewSkeleton } from '@/components/skeleton/SkeletonLayouts';
import { HiddenIngredientSheet } from '@/components/review/HiddenIngredientSheet';
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
  camera,
  color,
  fillParent,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';
import { matchSuggestion } from '@/constants/hiddenIngredients';
import { MEAL_TYPES, MEAL_VENUES } from '@/types';
import { localDateString, mealTypeForTime } from '@/logic/dates';
import { mealSavedMessage } from '@/logic/feedback';
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
import { Stepper } from '@/components/Stepper';
import type {
  Confidence,
  EstimatedItem,
  MealItem,
  MealType,
  MealVenue,
  VenueAssessment,
} from '@/types';

type Phase =
  | { kind: 'analyzing'; retryDelayMs?: number }
  | { kind: 'error'; error: VisionError }
  | { kind: 'review' };

const MEAL_TYPE_OPTIONS = MEAL_TYPES.map((type) => ({
  value: type,
  label: type.charAt(0).toUpperCase() + type.slice(1),
}));

const VENUE_LABELS: Record<MealVenue, string> = {
  home: 'Cooked in',
  out: 'Ate out',
  leftovers: 'Leftovers',
};

const VENUE_OPTIONS = MEAL_VENUES.map((venue) => ({
  value: venue,
  label: VENUE_LABELS[venue],
}));

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { photoUri, base64, estimate, clear } = useCaptureStore();
  const addMeal = useDayStore((state) => state.addMeal);

  const [phase, setPhase] = useState<Phase>(
    estimate ? { kind: 'review' } : { kind: 'analyzing' },
  );
  const [mealName, setMealName] = useState(estimate?.mealName ?? 'Meal');
  const [items, setItems] = useState<MealItem[]>(() =>
    estimate ? estimate.items.map((item) => toMealItem(item, false)) : [],
  );
  const [confidence, setConfidence] = useState<Confidence | null>(
    estimate?.confidence ?? null,
  );
  const [suggestions, setSuggestions] = useState<string[]>(
    estimate?.likelyHiddenIngredients ?? [],
  );
  const [venueAssessment, setVenueAssessment] = useState<VenueAssessment | null>(
    estimate?.venueAssessment ?? null,
  );
  const [mealType, setMealType] = useState<MealType>(mealTypeForTime());
  const [venue, setVenue] = useState<MealVenue>('home');
  const [servings, setServings] = useState(1);

  const [editing, setEditing] = useState<MealItem | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const venueChangedRef = useRef(false);

  // Combine the estimate with on-device stock, batch, and learned-dish
  // signals. A user's tap permanently takes precedence over later async work.
  useEffect(() => {
    if (phase.kind !== 'review') return;
    let active = true;
    void inferVenueForDraft(mealName, items, venueAssessment).then((inferred) => {
      if (!active) return;
      if (!venueChangedRef.current) setVenue(inferred);
    });
    return () => {
      active = false;
    };
  }, [items, mealName, phase.kind, venueAssessment]);

  // A repeated dish remembers its yield, so the batch cook that made four
  // portions last time offers four again.
  useEffect(() => {
    const dish = mealName.trim();
    if (dish.length === 0) return;
    let active = true;
    void lastServingsForDish(dish).then((remembered) => {
      if (active && remembered) setServings(remembered);
    });
    return () => {
      active = false;
    };
  }, [mealName]);

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
      // A malformed estimate is not worth stranding the user on — drop straight
      // into manual entry with the photo attached.
      if (visionError.kind === 'malformed') {
        router.replace('/manual');
        return;
      }
      setPhase({ kind: 'error', error: visionError });
    }
  }, [base64, router]);

  useEffect(() => {
    if (!estimate) void runEstimate();
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
    const localDate = localDateString();
    const resolvedItems = await Promise.all(items.map(async (item) => {
      const outcome = item.canonicalId
        ? { status: 'resolved' as const, canonicalId: item.canonicalId }
        : (await resolveIngredientReferencesLocally([{ raw: item.name }], 'vision'))[0];
      const canonicalId = outcome?.status === 'resolved' ? outcome.canonicalId : item.canonicalId;
      const canonical = canonicalId ? await getCanonicalById(canonicalId) : null;
      const fibre = deriveResolvedFibre(null, canonical, item.quantity, item.unit);
      return { ...item, canonicalId, fibreG: fibre.value };
    }));
    const meal: NewMeal = {
      loggedAt: new Date().toISOString(),
      localDate,
      mealType,
      name: mealName.trim() || 'Meal',
      photoUri,
      source: 'photo',
      confidence,
      venue,
      servingsMult: venue === 'home' ? servings : 1,
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
    if (venueChangedRef.current) {
      try {
        await saveDishVenueDefault(meal.name, venue);
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
    return (
      <View style={styles.root}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        <View style={styles.analyzing}>
          <ReviewSkeleton
            onDark
            label={phase.retryDelayMs
              ? 'The provider asked Mise to wait a moment before retrying…'
              : 'Reading your plate…'}
          />
          <Button
            label="Cancel"
            variant="ghost"
            block={false}
            onPress={() => {
              abortRef.current?.abort();
              discard();
            }}
          />
        </View>
      </View>
    );
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
    <View style={[styles.reviewRoot, { paddingTop: insets.top }]}>
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
            <SectionLabel muted>Might be in there too</SectionLabel>
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
          </View>
        ) : null}

        <Button
          label="Add hidden ingredient"
          variant="secondary"
          onPress={() => setHiddenOpen(true)}
        />

        <View style={styles.mealType}>
          <SectionLabel muted style={styles.mealTypeLabel}>
            Meal
          </SectionLabel>
          <Segmented
            options={MEAL_TYPE_OPTIONS}
            value={mealType}
            onChange={setMealType}
          />
        </View>

        <View style={styles.mealType}>
          <SectionLabel muted style={styles.mealTypeLabel}>
            Where from
          </SectionLabel>
          <Segmented
            options={VENUE_OPTIONS}
            value={venue}
            onChange={(next) => {
              if (next !== venue) venueChangedRef.current = true;
              setVenue(next);
              if (next !== 'home') setServings(1);
            }}
          />
          <Caption muted style={styles.venueHint}>
            {venue === 'home'
              ? 'Cooking at home takes what you used out of the pantry.'
              : venue === 'out'
                ? 'Eating out leaves your pantry alone.'
                : 'Leftovers were already taken out when you cooked the batch.'}
          </Caption>
        </View>

        {venue === 'home' ? (
          <View style={styles.mealType}>
            <SectionLabel muted style={styles.mealTypeLabel}>
              Servings this made
            </SectionLabel>
            <Stepper
              value={servings}
              onChange={setServings}
              step={1}
              min={1}
              max={20}
              label="Servings this made"
            />
            <Caption muted style={styles.venueHint}>
              Cooked more than you ate? The pantry loses the whole batch.
            </Caption>
          </View>
        ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
          <Button
            label="Save meal"
            onPress={() => void save()}
            disabled={items.length === 0}
            loading={saving}
          />
          <Button label="Discard" variant="ghost" onPress={discard} />
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
    </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  analyzing: {
    ...fillParent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: camera.analyzingScrim,
    gap: space.base,
  },

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
  reviewContent: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.base,
    paddingBottom: space.xxxl,
    gap: space.base,
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
  mealType: { gap: space.sm },
  mealTypeLabel: { marginLeft: space.xs },
  venueHint: { marginLeft: space.xs },
  footer: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.sm,
    gap: space.sm,
    backgroundColor: color.ground,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
});
