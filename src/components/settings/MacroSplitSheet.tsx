import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Body, Caption } from '@/components/Type';
import { color, macroColor, space } from '@/constants/theme';
import { isValidSplit } from '@/logic/macros';

interface Props {
  visible: boolean;
  onClose: () => void;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  onSave: (split: { proteinPct: number; carbsPct: number; fatPct: number }) => void;
}

/** Editor for the macro split. Must sum to 100%. */
export function MacroSplitSheet({
  visible,
  onClose,
  proteinPct,
  carbsPct,
  fatPct,
  onSave,
}: Props) {
  const [protein, setProtein] = useState(String(Math.round(proteinPct * 100)));
  const [carbs, setCarbs] = useState(String(Math.round(carbsPct * 100)));
  const [fat, setFat] = useState(String(Math.round(fatPct * 100)));

  const parse = (value: string) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const p = parse(protein);
  const c = parse(carbs);
  const f = parse(fat);
  const total = p + c + f;
  const valid = isValidSplit({
    proteinPct: p / 100,
    carbsPct: c / 100,
    fatPct: f / 100,
  });

  const save = () => {
    if (!valid) return;
    onSave({ proteinPct: p / 100, carbsPct: c / 100, fatPct: f / 100 });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Macro split"
      footer={<Button label="Save split" onPress={save} disabled={!valid} />}
    >
      <Row label="Protein" fill={macroColor.protein} value={protein} onChange={setProtein} />
      <Row label="Carbs" fill={macroColor.carbs} value={carbs} onChange={setCarbs} />
      <Row label="Fat" fill={macroColor.fat} value={fat} onChange={setFat} />

      <Caption
        numeric
        style={[styles.total, !valid && styles.totalBad]}
        muted={valid}
      >
        {valid ? 'Adds up to 100%.' : `Currently ${total}% — must total 100%.`}
      </Caption>
    </Sheet>
  );
}

function Row({
  label,
  fill,
  value,
  onChange,
}: {
  label: string;
  fill: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: fill }]} />
      <Body style={styles.label}>{label}</Body>
      <Field
        style={styles.field}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        suffix="%"
        numeric
        maxLength={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1 },
  field: { width: 110 },
  total: { marginTop: space.sm },
  totalBad: { color: color.paprika },
});
