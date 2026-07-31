import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { MEAL_TYPES } from '@/types';
import { localDateString, mealTypeForTime } from '@/logic/dates';
import { formatGrams, macrosOfItems, roundCalories } from '@/logic/scaling';
import { deletePhoto } from '@/media/photos';
import type { NewMeal } from '@/db/queries';
import { useCaptureStore } from '@/store/captureStore';
import { useDayStore } from '@/store/dayStore';
import type {
  Confidence,
  EstimatedItem,
  MealItem,
  MealType,
} from '@/types';

type Phase =
  | { kind: 'analyzing' }
  | { kind: 'error'; error: VisionError }
  | { kind: 'review' };

const MEAL_TYPE_OPTIONS = MEAL_TYPES.map((type) => ({
  value: type,
  label: type.charAt(0).toUpperCase() + type.slice(1),
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
  const [mealType, setMealType] = useState<MealType>(mealTypeForTime());

  const [editing, setEditing] = useState<MealItem | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const runEstimate = useCallback(async () => {
    if (!base64) {
      setPhase({ kind: 'error', error: new VisionError('malformed', 'No photo.') });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'analyzing' });
    try {
      const result = await estimateMeal(base64, controller.signal);
      setMealName(result.mealName);
      setItems(result.items.map((item) => toMealItem(item, false)));
      setConfidence(result.confidence);
      setSuggestions(result.likelyHiddenIngredients);
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
    const meal: NewMeal = {
      loggedAt: new Date().toISOString(),
      localDate,
      mealType,
      name: mealName.trim() || 'Meal',
      photoUri,
      source: 'photo',
      confidence,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        isManualAddition: item.isManualAddition,
      })),
    };
    const stored = await addMeal(meal);
    clear();
    // The success haptic completes the save sequence in §7.6; the segment
    // scale-in and hero count-down play once Today re-renders with the new meal.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show({ message: 'Meal saved.' });
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
          <ActivityIndicator color={color.surface} size="large" />
          <Caption style={styles.analyzingText}>Reading your plate…</Caption>
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
    const copy = copyForError(phase.error);
    return (
      <View style={[styles.root, styles.errorRoot, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.errorContent}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.errorPhoto} />
          ) : null}
          <ScreenTitle>{copy.title}</ScreenTitle>
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
      <ScrollView
        contentContainerStyle={styles.reviewContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.thumb} />
        ) : null}

        <Field value={mealName} onChangeText={setMealName} label="Meal" />

        <View style={styles.totals}>
          <View>
            <SectionLabel muted>Total</SectionLabel>
            <MealCalories numeric>{roundCalories(totals.calories)}</MealCalories>
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
    isManualAddition: manual,
    sortOrder: 0,
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
  analyzingText: { color: color.surface },

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
  footer: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.sm,
    gap: space.sm,
    backgroundColor: color.ground,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
});
