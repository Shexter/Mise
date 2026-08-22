import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CollapsibleEditorRow, nextExpandedId } from '@/components/CollapsibleEditorRow';
import { Segmented } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { HistoryCalendarSheet } from '@/components/HistoryCalendarSheet';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Screen } from '@/components/Screen';
import { Body, Caption, MealCalories, ScreenTitle, SectionLabel } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { color, opacity, radius, space } from '@/constants/theme';
import { getMeal } from '@/db/queries';
import { photoBase64 } from '@/media/photos';
import { friendlyDate } from '@/logic/dates';
import {
  hasMealEditErrors,
  isMealDraftDirty,
  mealToDraft,
  normaliseMealDraft,
  validateMealDraft,
  type MealEditDraft,
  type MealItemDraft,
} from '@/logic/mealEdit';
import { catalogueNutrition } from '@/logic/nutrition';
import { formatGrams, macrosOfItems, roundCalories } from '@/logic/scaling';
import { useDayStore } from '@/store/dayStore';
import { useCaptureStore } from '@/store/captureStore';
import {
  MEAL_TYPES,
  MEAL_VENUES,
  MEASURE_UNITS,
  type CanonicalItem,
  type MealType,
  type MealVenue,
  type MeasureUnit,
} from '@/types';

const MEAL_OPTIONS = MEAL_TYPES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));
const VENUE_LABELS: Record<MealVenue, string> = {
  home: 'Cooked in', out: 'Ate out', leftovers: 'Leftovers',
};
const VENUE_OPTIONS = MEAL_VENUES.map((value) => ({ value, label: VENUE_LABELS[value] }));
const UNIT_OPTIONS = MEASURE_UNITS.map((value) => ({ value, label: value }));

export default function MealEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const updateMeal = useDayStore((state) => state.updateMeal);
  const removeMeal = useDayStore((state) => state.removeMeal);
  const undoRemove = useDayStore((state) => state.undoRemove);
  const loggedDateSet = useDayStore((state) => state.loggedDateSet);
  const earliestLoggedDate = useDayStore((state) => state.earliestLoggedDate);
  const loadMonthSummaries = useDayStore((state) => state.loadMonthSummaries);
  const setCapture = useCaptureStore((state) => state.set);
  const [draft, setDraft] = useState<MealEditDraft | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pickingItemId, setPickingItemId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const allowLeave = useRef(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      return;
    }
    void getMeal(id).then((meal) => {
      if (meal) setDraft(mealToDraft(meal));
      else setNotFound(true);
    });
  }, [id]);

  const dirty = draft ? isMealDraftDirty(draft) : false;
  useEffect(
    () => navigation.addListener('beforeRemove', (event) => {
      if (!dirty || allowLeave.current) return;
      event.preventDefault();
      Alert.alert('Discard changes?', 'Your meal and pantry will stay unchanged.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard', style: 'destructive', onPress: () => {
            allowLeave.current = true;
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    }),
    [dirty, navigation],
  );

  const errors = useMemo(() => draft ? validateMealDraft(draft) : null, [draft]);
  const valid = errors ? !hasMealEditErrors(errors) : false;
  const preview = draft ? normaliseMealDraft(draft) : null;
  const totals = preview ? macrosOfItems(preview.items) : null;

  const patchDraft = (patch: Partial<MealEditDraft>) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
  };
  const patchItem = (itemId: string, patch: Partial<MealItemDraft>) => {
    setDraft((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
    } : current);
  };

  const save = async () => {
    if (!draft || !valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateMeal(normaliseMealDraft(draft));
      allowLeave.current = true;
      toast.show({ message: 'Meal updated.' });
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the meal.');
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!draft || deleting) return;
    Alert.alert(
      'Delete this meal?',
      'This will remove it from your daily log and restore any depleted pantry items.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void executeDelete(),
        },
      ],
    );
  };

  const executeDelete = async () => {
    if (!draft) return;
    setDeleting(true);
    setSaveError(null);
    try {
      allowLeave.current = true;
      await removeMeal(draft.original.id);
      toast.show({
        kind: 'success',
        message: 'Meal removed.',
        actionLabel: 'Undo',
        onAction: () => void undoRemove(),
        durationMs: 5_000,
      });
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not delete the meal.');
      setDeleting(false);
    }
  };

  const estimatePhoto = async () => {
    const photoUri = draft?.original.photoUri;
    if (!photoUri || estimating) return;
    setEstimating(true);
    setSaveError(null);
    try {
      const base64 = await photoBase64(photoUri);
      setCapture({ photoUri, base64, estimate: null });
      router.push('/review');
    } catch {
      setSaveError('Could not read the meal photo. Try again or continue editing by hand.');
    } finally {
      setEstimating(false);
    }
  };

  if (notFound) {
    return (
      <Screen contentStyle={styles.center}>
        <EmptyState
          title="Meal no longer available"
          detail="It may have been deleted from another screen."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }
  if (!draft || !totals) {
    return (
      <Screen contentStyle={styles.center}>
        <ActivityIndicator color={color.ink} accessibilityLabel="Loading meal" />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {saveError ? <Caption style={styles.error}>{saveError}</Caption> : null}
          <View style={styles.footerButtons}>
            <Button label="Cancel" variant="secondary" onPress={() => router.back()} style={styles.button} />
            <Button label="Save changes" onPress={() => void save()} disabled={!valid} loading={saving} style={styles.button} />
          </View>
        </View>
      }
    >
      <View style={styles.header}>
        <ScreenTitle>Edit meal</ScreenTitle>
      </View>

      {draft.original.photoUri ? (
        <View style={styles.photoSection}>
          <Image
            source={{ uri: draft.original.photoUri }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel="Attached meal photo"
          />
          <Button
            label="Estimate with AI"
            detail="Re-send this photo for a fresh estimate"
            variant="secondary"
            style={styles.estimateButton}
            onPress={() => void estimatePhoto()}
            loading={estimating}
            disabled={estimating}
          />
        </View>
      ) : null}

      <Field
        label="Name" value={draft.name} onChangeText={(name) => patchDraft({ name })}
        error={errors?.name}
      />

      <View style={styles.section}>
        <SectionLabel muted>Date</SectionLabel>
        <Button
          label={friendlyDate(draft.localDate)}
          variant="secondary"
          onPress={() => setCalendarOpen(true)}
        />
      </View>

      <View style={styles.section}>
        <SectionLabel muted>Meal</SectionLabel>
        <Segmented
          options={MEAL_OPTIONS} value={draft.mealType}
          onChange={(mealType: MealType) => patchDraft({ mealType })}
        />
      </View>
      <View style={styles.section}>
        <SectionLabel muted>Where from</SectionLabel>
        <Segmented
          options={VENUE_OPTIONS} value={draft.venue}
          onChange={(venue: MealVenue) => patchDraft({ venue })}
        />
      </View>
      {draft.venue === 'home' ? (
        <Field
          label="Servings made" value={draft.servingsMult}
          onChangeText={(servingsMult) => patchDraft({ servingsMult })}
          keyboardType="decimal-pad" numeric error={errors?.servingsMult}
          hint="Pantry use is multiplied by the number of servings made."
        />
      ) : null}

      <Card title="Current total">
        <MealCalories numeric>{totals.calories === null ? '—' : `${roundCalories(totals.calories)} kcal`}</MealCalories>
        <Caption muted numeric>
          P {formatGrams(totals.proteinG)} g · C {formatGrams(totals.carbsG)} g · F {formatGrams(totals.fatG)} g
        </Caption>
      </Card>

      <View style={styles.itemsHeader}>
        <SectionLabel muted>Items</SectionLabel>
        <Pressable
          accessibilityRole="button" accessibilityLabel="Add meal item"
          onPress={() => {
            const item = newItemDraft();
            patchDraft({ items: [...draft.items, item] });
            setExpandedItemId(item.id);
          }}
          style={({ pressed }) => pressed && { opacity: opacity.pressed }}
        >
          <Body>+ Add item</Body>
        </Pressable>
      </View>
      {errors?.items ? <Caption style={styles.error}>{errors.items}</Caption> : null}

      {draft.items.map((item, index) => {
        const itemErrors = errors?.itemFields[item.id];
        return (
          <CollapsibleEditorRow
            key={item.id}
            title={item.name.trim() || `Item ${index + 1}`}
            subtitle={item.canonicalId ? `Catalogue: ${item.canonicalId}` : undefined}
            expanded={expandedItemId === item.id}
            onToggle={() => setExpandedItemId((current) => nextExpandedId(current, item.id))}
          >
            <View style={styles.itemFields}>
              <Field
                label="Name" value={item.name}
                onChangeText={(name) => patchItem(item.id, { name })}
                error={itemErrors?.name}
              />
              <Field
                label="Quantity" value={item.quantity}
                onChangeText={(quantity) => patchItem(item.id, { quantity })}
                keyboardType="decimal-pad" numeric error={itemErrors?.quantity}
              />
              <View>
                <SectionLabel muted style={styles.unitLabel}>Unit</SectionLabel>
                <Segmented
                  options={UNIT_OPTIONS.slice(0, 3)} value={item.unit}
                  onChange={(unit: MeasureUnit) => patchItem(item.id, { unit })}
                />
                <Segmented
                  options={UNIT_OPTIONS.slice(3, 6)} value={item.unit}
                  onChange={(unit: MeasureUnit) => patchItem(item.id, { unit })}
                  style={styles.unitRow}
                />
                <Segmented
                  options={UNIT_OPTIONS.slice(6)} value={item.unit}
                  onChange={(unit: MeasureUnit) => patchItem(item.id, { unit })}
                  style={styles.unitRow}
                />
              </View>
              <Field
                label="Calories" value={item.calories}
                onChangeText={(calories) => patchItem(item.id, { calories })}
                keyboardType="decimal-pad" suffix="kcal" numeric error={itemErrors?.calories}
              />
              <View style={styles.threeColumns}>
                <Field style={styles.flex} label="Protein" value={item.proteinG} onChangeText={(proteinG) => patchItem(item.id, { proteinG })} keyboardType="decimal-pad" suffix="g" numeric error={itemErrors?.proteinG} />
                <Field style={styles.flex} label="Carbs" value={item.carbsG} onChangeText={(carbsG) => patchItem(item.id, { carbsG })} keyboardType="decimal-pad" suffix="g" numeric error={itemErrors?.carbsG} />
                <Field style={styles.flex} label="Fat" value={item.fatG} onChangeText={(fatG) => patchItem(item.id, { fatG })} keyboardType="decimal-pad" suffix="g" numeric error={itemErrors?.fatG} />
              </View>
              <Button
                label={item.canonicalId ? `Catalogue: ${item.canonicalId}` : 'Choose catalogue ingredient'}
                variant="secondary" onPress={() => setPickingItemId(item.id)}
              />
              <View style={styles.itemActions}>
                {item.canonicalId ? <Button label="Clear match" variant="ghost" block={false} onPress={() => patchItem(item.id, { canonicalId: null })} /> : null}
                {index > 0 ? <Button label="Move up" variant="ghost" block={false} onPress={() => patchDraft({ items: move(draft.items, index, index - 1) })} /> : null}
                {index < draft.items.length - 1 ? <Button label="Move down" variant="ghost" block={false} onPress={() => patchDraft({ items: move(draft.items, index, index + 1) })} /> : null}
                <Button label="Remove" variant="destructive" block={false} onPress={() => patchDraft({ items: draft.items.filter((candidate) => candidate.id !== item.id) })} />
              </View>
            </View>
          </CollapsibleEditorRow>
        );
      })}

      <View style={styles.deleteSection}>
        <Button
          label="Delete meal"
          variant="destructive"
          onPress={confirmDelete}
          loading={deleting}
          disabled={deleting || saving}
        />
      </View>

      <CanonicalPickerSheet
        visible={pickingItemId !== null}
        title="Catalogue ingredient"
        onPick={(canonical) => {
          if (pickingItemId) applyCanonical(pickingItemId, canonical, draft, patchItem);
          setPickingItemId(null);
        }}
        onClose={() => setPickingItemId(null)}
      />

      <HistoryCalendarSheet
        visible={calendarOpen}
        selectedDate={draft.localDate}
        loggedDates={loggedDateSet}
        earliestLoggedDate={earliestLoggedDate}
        loadSummaries={loadMonthSummaries}
        onSelect={(date) => {
          patchDraft({ localDate: date });
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />
    </Screen>
  );
}

function newItemDraft(): MealItemDraft {
  return {
    id: randomUUID(), name: '', quantity: '1', unit: 'serving', calories: '',
    proteinG: '', carbsG: '', fatG: '', isManualAddition: true, canonicalId: null,
  };
}

function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

function applyCanonical(
  itemId: string,
  canonical: CanonicalItem,
  draft: MealEditDraft,
  patchItem: (itemId: string, patch: Partial<MealItemDraft>) => void,
) {
  const item = draft.items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  const nutrition = catalogueNutrition(canonical, Number(item.quantity), item.unit);
  patchItem(itemId, {
    canonicalId: canonical.id,
    name: canonical.displayName,
    ...(nutrition ? {
      calories: nutrition.values.calories === null ? '' : String(nutrition.values.calories),
      proteinG: nutrition.values.proteinG === null ? '' : String(nutrition.values.proteinG),
      carbsG: nutrition.values.carbsG === null ? '' : String(nutrition.values.carbsG),
      fatG: nutrition.values.fatG === null ? '' : String(nutrition.values.fatG),
    } : {}),
  });
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: space.lg, paddingTop: space.sm },
  header: { paddingBottom: space.sm },
  photoSection: { gap: space.sm },
  photo: { width: '100%', height: 200, borderRadius: radius.card },
  estimateButton: { borderColor: color.action },
  section: { gap: space.sm },
  deleteSection: { marginTop: space.base, paddingTop: space.base, borderTopWidth: 1, borderTopColor: color.line },
  footer: { gap: space.sm },
  footerButtons: { flexDirection: 'row', gap: space.sm },
  button: { flex: 1 },
  error: { color: color.paprika },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemCard: { gap: space.base },
  itemFields: { gap: space.base },
  threeColumns: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  unitLabel: { marginBottom: space.sm, marginLeft: space.xs },
  unitRow: { marginTop: space.xs },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
});
