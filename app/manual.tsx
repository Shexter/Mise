import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Caption, ScreenTitle, SectionLabel } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { MEASURE_UNITS, MEAL_TYPES, MEAL_VENUES } from '@/types';
import { localDateString, mealTypeForTime } from '@/logic/dates';
import type { NewMeal } from '@/db/queries';
import { useCaptureStore } from '@/store/captureStore';
import { useDayStore } from '@/store/dayStore';
import { lastVenue } from '@/db/queries';
import { catalogueNutrition } from '@/logic/nutrition';
import type { CanonicalItem, MeasureUnit, MealType, MealVenue } from '@/types';

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


export default function ManualScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // A photo is only present when manual entry was reached from a failed
  // estimate. A meal entered from the FAB has none.
  const { photoUri, clear } = useCaptureStore();
  const addMeal = useDayStore((state) => state.addMeal);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<MeasureUnit>('serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState<MealType>(mealTypeForTime());
  const [venue, setVenue] = useState<MealVenue>('home');
  const [saving, setSaving] = useState(false);
  const [canonical, setCanonical] = useState<CanonicalItem | null>(null);
  const [pickingCanonical, setPickingCanonical] = useState(false);

  useEffect(() => {
    void lastVenue().then((last) => {
      if (last) setVenue(last);
    });
  }, []);

  useEffect(() => {
    if (!canonical) return;
    const parsedQuantity = Number.parseFloat(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) return;
    const result = catalogueNutrition(canonical, parsedQuantity, unit);
    if (!result) return;
    const field = (value: number | null) => value == null ? '' : String(value);
    setCalories(field(result.values.calories));
    setProtein(field(result.values.proteinG));
    setCarbs(field(result.values.carbsG));
    setFat(field(result.values.fatG));
  }, [canonical, quantity, unit]);

  const kcal = Number.parseFloat(calories);
  const valid = name.trim().length > 0 && Number.isFinite(kcal) && kcal >= 0;

  const num = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const localDate = localDateString();
    const meal: NewMeal = {
      loggedAt: new Date().toISOString(),
      localDate,
      mealType,
      name: name.trim(),
      photoUri,
      source: 'manual',
      confidence: null,
      venue,
      items: [
        {
          name: name.trim(),
          quantity: num(quantity) || 1,
          unit,
          calories: num(calories),
          proteinG: num(protein),
          carbsG: num(carbs),
          fatG: num(fat),
          isManualAddition: false,
          canonicalId: canonical?.id ?? null,
        },
      ],
    };
    const stored = await addMeal(meal);
    clear();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show({ message: 'Meal saved.' });
    router.dismissAll();
    router.replace({ pathname: '/(tabs)', params: { savedMealId: stored.id } });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ScreenTitle>Enter a meal</ScreenTitle>
        <Button label="Cancel" variant="ghost" block={false} onPress={() => router.back()} />
      </View>

      <View style={styles.body}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : null}

        <Field
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (canonical && value !== canonical.displayName) setCanonical(null);
          }}
          label="Name"
          placeholder="Chicken salad"
          autoFocus
        />

        <Button
          label={canonical ? `Catalogue: ${canonical.displayName}` : 'Choose a catalogue ingredient'}
          variant="ghost"
          onPress={() => setPickingCanonical(true)}
        />

        <Field
          value={quantity}
          onChangeText={setQuantity}
          label="Quantity"
          keyboardType="decimal-pad"
          numeric
        />

        <View>
          <SectionLabel muted style={styles.unitLabel}>
            Unit
          </SectionLabel>
          <View style={styles.units}>
            {MEASURE_UNITS.map((option) => {
              const selected = option === unit;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setUnit(option);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.unitChip,
                    selected && styles.unitChipOn,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <Caption muted={!selected} style={selected ? styles.unitChipTextOn : undefined}>
                    {option}
                  </Caption>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          value={calories}
          onChangeText={setCalories}
          label="Calories"
          keyboardType="number-pad"
          suffix="kcal"
          numeric
        />

        <SectionLabel muted style={styles.macrosLabel}>
          Macros (optional)
        </SectionLabel>
        <View style={styles.macros}>
          <Field style={styles.macroField} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="P g" numeric />
          <Field style={styles.macroField} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="C g" numeric />
          <Field style={styles.macroField} value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="F g" numeric />
        </View>
        {canonical && catalogueNutrition(canonical, num(quantity), unit) ? (
          <Caption muted>Nutrition from USDA FoodData Central.</Caption>
        ) : null}

        <View style={styles.mealType}>
          <SectionLabel muted style={styles.mealTypeLabel}>
            Meal
          </SectionLabel>
          <Segmented options={MEAL_TYPE_OPTIONS} value={mealType} onChange={setMealType} />
        </View>

        <View style={styles.mealType}>
          <SectionLabel muted style={styles.mealTypeLabel}>
            Where from
          </SectionLabel>
          <Segmented options={VENUE_OPTIONS} value={venue} onChange={setVenue} />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
        <Button label="Save meal" onPress={() => void save()} disabled={!valid} loading={saving} />
      </View>

      <CanonicalPickerSheet
        visible={pickingCanonical}
        title="Catalogue ingredient"
        onPick={(item) => {
          setCanonical(item);
          setName(item.displayName);
          setPickingCanonical(false);
        }}
        onClose={() => setPickingCanonical(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: layout.screenGutter,
    paddingRight: space.sm,
    paddingTop: space.sm,
  },
  body: {
    flex: 1,
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.base,
    gap: space.base,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: radius.card,
  },
  unitLabel: { marginBottom: space.sm, marginLeft: space.xs },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  unitChip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  unitChipOn: { backgroundColor: color.ink, borderColor: color.ink },
  unitChipTextOn: { color: color.surface },
  macrosLabel: { marginTop: space.xs },
  macros: { flexDirection: 'row', gap: space.sm },
  macroField: { flex: 1 },
  mealType: { gap: space.sm, marginTop: space.xs },
  mealTypeLabel: { marginLeft: space.xs },
  footer: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
});
