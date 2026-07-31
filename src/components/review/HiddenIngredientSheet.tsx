import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, SectionLabel } from '@/components/Type';
import {
  color,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';
import { HIDDEN_INGREDIENTS } from '@/constants/hiddenIngredients';
import type { EstimatedItem, HiddenIngredient } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: EstimatedItem) => void;
}

/**
 * The hidden-ingredient sheet — the app's headline feature, not a buried one.
 * A quick-pick grid of the usual invisible calories, plus a free-text custom
 * option for anything the grid misses.
 */
export function HiddenIngredientSheet({ visible, onClose, onAdd }: Props) {
  const [customOpen, setCustomOpen] = useState(false);

  const addQuickPick = (ingredient: HiddenIngredient) => {
    onAdd({
      name: ingredient.name,
      quantity: ingredient.defaultQuantity,
      unit: ingredient.unit,
      calories: ingredient.calories,
      proteinG: ingredient.proteinG,
      carbsG: ingredient.carbsG,
      fatG: ingredient.fatG,
    });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Add a hidden ingredient">
      {customOpen ? (
        <CustomForm
          onAdd={(item) => {
            onAdd(item);
            setCustomOpen(false);
            onClose();
          }}
          onCancel={() => setCustomOpen(false)}
        />
      ) : (
        <>
          <SectionLabel muted>The usual invisible calories</SectionLabel>
          <View style={styles.grid}>
            {HIDDEN_INGREDIENTS.map((ingredient) => (
              <Pressable
                key={ingredient.name}
                onPress={() => addQuickPick(ingredient)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${ingredient.name}, ${ingredient.calories} calories`}
                style={({ pressed }) => [
                  styles.pick,
                  pressed && { opacity: opacity.pressed },
                ]}
              >
                <Body numberOfLines={1}>{ingredient.name}</Body>
                <Caption muted numeric>
                  {ingredient.defaultQuantity} {ingredient.unit} · {ingredient.calories} kcal
                </Caption>
              </Pressable>
            ))}
          </View>

          <Button
            label="Something else"
            variant="secondary"
            onPress={() => setCustomOpen(true)}
          />
        </>
      )}
    </Sheet>
  );
}

function CustomForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: EstimatedItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const kcal = Number.parseFloat(calories);
  const valid = name.trim().length > 0 && Number.isFinite(kcal) && kcal >= 0;

  const num = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  return (
    <View style={styles.custom}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Peanut butter" autoFocus />
      <Field
        label="Calories"
        value={calories}
        onChangeText={setCalories}
        keyboardType="number-pad"
        suffix="kcal"
        numeric
      />
      <SectionLabel muted style={styles.optional}>
        Macros (optional)
      </SectionLabel>
      <View style={styles.macroRow}>
        <Field style={styles.macroField} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="P g" numeric />
        <Field style={styles.macroField} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="C g" numeric />
        <Field style={styles.macroField} value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="F g" numeric />
      </View>

      <Button
        label="Add ingredient"
        disabled={!valid}
        onPress={() =>
          onAdd({
            name: name.trim(),
            quantity: 1,
            unit: 'serving',
            calories: num(calories),
            proteinG: num(protein),
            carbsG: num(carbs),
            fatG: num(fat),
          })
        }
      />
      <Button label="Back to quick picks" variant="ghost" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  pick: {
    width: '48%',
    minHeight: layout.minRowHeight,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.md,
    gap: space.xs,
    justifyContent: 'center',
  },
  custom: { gap: space.base },
  optional: { marginTop: space.xs },
  macroRow: { flexDirection: 'row', gap: space.sm },
  macroField: { flex: 1 },
});
