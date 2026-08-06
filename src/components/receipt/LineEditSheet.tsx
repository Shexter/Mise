import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Caption } from '@/components/Type';
import { space } from '@/constants/theme';
import type { MeasureUnit, ReceiptLine } from '@/types';

interface Props {
  line: ReceiptLine | null;
  displayName: string;
  onClose: () => void;
  onApply: (details: { qty: number | null; unit: MeasureUnit | null; lineTotalCents: number | null }) => void;
}

/**
 * Corrects a receipt line's quantity and price during review (task 8.2).
 * Unit is not editable here — the model's estimate of *which* unit a
 * person would use is the same judgement call the meal-photo estimate
 * already makes, and getting the number right matters more than the
 * label.
 *
 * The quantity field's label follows the line's own `quantityKind` (task
 * 8.5b): a count line asks "how many containers," a measure line asks for
 * the weight or volume in the unit it was read in. Either way it is a
 * plain number field, never a stepper — a stepper implies a small integer
 * range that a weight in grams does not have.
 */
export function LineEditSheet({ line, displayName, onClose, onApply }: Props) {
  const [qtyText, setQtyText] = useState('');
  const [priceText, setPriceText] = useState('');

  useEffect(() => {
    if (line) {
      setQtyText(line.qty !== null ? String(line.qty) : '');
      setPriceText(
        line.lineTotalCents !== null ? (line.lineTotalCents / 100).toFixed(2) : '',
      );
    }
  }, [line]);

  if (!line) return null;

  const apply = () => {
    const qty = Number.parseFloat(qtyText);
    const price = Number.parseFloat(priceText);
    onApply({
      qty: Number.isFinite(qty) && qty >= 0 ? qty : null,
      unit: (Number.isFinite(qty) && qty >= 0 ? line.unit : null) as MeasureUnit | null,
      lineTotalCents: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : null,
    });
    onClose();
  };

  return (
    <Sheet
      visible={line !== null}
      onClose={onClose}
      title={displayName}
      footer={<Button label="Save" onPress={apply} />}
    >
      <View style={styles.body}>
        <Caption muted>As printed: “{line.rawText}”</Caption>
        <Field
          label={line.quantityKind === 'count' ? 'How many containers' : 'Weight or volume'}
          value={qtyText}
          onChangeText={setQtyText}
          keyboardType="decimal-pad"
          suffix={line.quantityKind === 'count' ? undefined : (line.unit ?? undefined)}
          numeric
        />
        <Field
          label="Price paid"
          value={priceText}
          onChangeText={setPriceText}
          keyboardType="decimal-pad"
          suffix="$"
          numeric
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.base },
});
