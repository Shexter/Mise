import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Caption, MealCalories, SectionLabel } from '@/components/Type';
import { color, space } from '@/constants/theme';
import { formatGrams, roundCalories, scaleItemQuantity } from '@/logic/scaling';
import type { MealItem } from '@/types';

interface Props {
  item: MealItem | null;
  onClose: () => void;
  onApply: (item: MealItem) => void;
}

/** Quantity editor for one detected item. Calories and macros scale live. */
export function QuantitySheet({ item, onClose, onApply }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [text, setText] = useState('1');

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity);
      setText(String(item.quantity));
    }
  }, [item]);

  if (!item) return null;

  const setBoth = (value: number) => {
    setQuantity(value);
    setText(String(value));
  };

  const preview = scaleItemQuantity(item, quantity);
  const step = item.unit === 'g' || item.unit === 'ml' ? 10 : 0.5;

  return (
    <Sheet
      visible={item !== null}
      onClose={onClose}
      title={item.name}
      footer={
        <Button
          label="Apply"
          onPress={() => {
            onApply(scaleItemQuantity(item, quantity));
            onClose();
          }}
        />
      }
    >
      <Stepper
        value={quantity}
        onChange={setBoth}
        step={step}
        unit={item.unit}
      />

      <Field
        label="Or type it"
        value={text}
        onChangeText={(next) => {
          setText(next);
          const parsed = Number.parseFloat(next);
          if (Number.isFinite(parsed) && parsed >= 0) setQuantity(parsed);
        }}
        keyboardType="decimal-pad"
        suffix={item.unit}
        numeric
      />

      <View style={styles.preview}>
        <View>
          <SectionLabel muted>Calories</SectionLabel>
          <MealCalories numeric>{roundCalories(preview.calories)}</MealCalories>
        </View>
        <Caption muted numeric style={styles.macros}>
          P {formatGrams(preview.proteinG)} · C {formatGrams(preview.carbsG)} · F{' '}
          {formatGrams(preview.fatG)}
        </Caption>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  macros: { marginBottom: space.xs },
});
