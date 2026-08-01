import { addDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Segmented } from '@/components/Choice';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { friendlyDate, localDateString } from '@/logic/dates';
import { predictExpiry } from '@/logic/expiry';
import { usePantryStore } from '@/store/pantryStore';
import type { CanonicalItem, MeasureUnit } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type AcquiredChoice = '0' | '1' | '3' | '7';

const ACQUIRED_OPTIONS: { value: AcquiredChoice; label: string }[] = [
  { value: '0', label: 'Today' },
  { value: '1', label: 'Yesterday' },
  { value: '3', label: '3 days ago' },
  { value: '7', label: 'A week ago' },
];

const QTY_UNITS: { value: MeasureUnit; label: string }[] = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'piece', label: 'pieces' },
];

/**
 * Manual add (decision 24): ingredient, location, acquisition date — with
 * the predicted expiry shown before saving so the user knows what the app
 * will claim. Quantity is optional and recorded as the user's own entry.
 */
export function AddPantryItemSheet({ visible, onClose }: Props) {
  const locations = usePantryStore((state) => state.locations);
  const addItem = usePantryStore((state) => state.addItem);

  const [picking, setPicking] = useState(false);
  const [canonical, setCanonical] = useState<CanonicalItem | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [acquired, setAcquired] = useState<AcquiredChoice>('0');
  const [qty, setQty] = useState('');
  const [qtyUnit, setQtyUnit] = useState<MeasureUnit>('g');
  const [saving, setSaving] = useState(false);

  const location =
    locations.find((l) => l.id === locationId) ??
    (canonical
      ? locations.find((l) => l.kind !== 'freezer' && matchesDefault(canonical, l.id))
      : undefined) ??
    locations[0];

  const purchasedAt = localDateString(
    addDays(new Date(), -Number.parseInt(acquired, 10)),
  );

  const predicted = useMemo(() => {
    if (!canonical || !location) return null;
    return predictExpiry(canonical, location.kind, purchasedAt, null);
  }, [canonical, location, purchasedAt]);

  const reset = () => {
    setCanonical(null);
    setLocationId(null);
    setAcquired('0');
    setQty('');
  };

  const onSave = () => {
    if (!canonical || !location || saving) return;
    const parsedQty = Number.parseFloat(qty);
    setSaving(true);
    void addItem({
      canonicalId: canonical.id,
      locationId: location.id,
      purchasedAt,
      ...(Number.isFinite(parsedQty) && parsedQty > 0
        ? { qtyRemaining: parsedQty, qtyUnit }
        : {}),
    })
      .catch(() => {})
      .finally(() => {
        setSaving(false);
        reset();
        onClose();
      });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add to pantry"
      footer={
        <Button
          label="Add item"
          onPress={onSave}
          disabled={!canonical || !location}
          loading={saving}
        />
      }
    >
      <View style={styles.section}>
        <SectionLabel muted>Ingredient</SectionLabel>
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={canonical ? canonical.displayName : 'Pick an ingredient'}
          style={({ pressed }) => [
            styles.pickerBox,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          {canonical ? (
            <RowTitle>{canonical.displayName}</RowTitle>
          ) : (
            <Body muted>Pick an ingredient</Body>
          )}
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionLabel muted>Where it lives</SectionLabel>
        <View style={styles.locations}>
          {locations.map((option) => {
            const selected = option.id === location?.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setLocationId(option.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.name}
                style={({ pressed }) => [
                  styles.locationChip,
                  selected && styles.locationChipOn,
                  pressed && { opacity: opacity.pressed },
                ]}
              >
                <Caption muted={!selected} style={selected ? styles.chipTextOn : undefined}>
                  {option.name}
                </Caption>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel muted>Acquired</SectionLabel>
        <Segmented
          options={ACQUIRED_OPTIONS}
          value={acquired}
          onChange={setAcquired}
        />
      </View>

      <View style={styles.section}>
        <SectionLabel muted>How much (optional)</SectionLabel>
        <View style={styles.qtyRow}>
          <Field
            value={qty}
            onChangeText={setQty}
            placeholder="e.g. 500"
            keyboardType="numeric"
            numeric
            style={styles.qtyField}
          />
          <Segmented
            options={QTY_UNITS}
            value={qtyUnit}
            onChange={setQtyUnit}
            style={styles.qtyUnits}
          />
        </View>
        <Caption muted style={styles.hint}>
          Only shown back to you as your own entry.
        </Caption>
      </View>

      {canonical ? (
        <Caption muted>
          {predicted
            ? `Predicted expiry: ${friendlyDate(predicted)} (estimate).`
            : 'No shelf-life estimate for this spot — no date will be claimed.'}
        </Caption>
      ) : null}

      <CanonicalPickerSheet
        visible={picking}
        title="What is it?"
        onPick={(item) => {
          setCanonical(item);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Sheet>
  );
}

/** Preselects the canonical's default location where ids line up. */
function matchesDefault(canonical: CanonicalItem, locationId: string): boolean {
  return canonical.defaultLocation === locationId;
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  pickerBox: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.input,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.base,
    justifyContent: 'center',
  },
  locations: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  locationChip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.input,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationChipOn: { borderColor: color.ink, backgroundColor: color.ground },
  chipTextOn: { color: color.ink },
  qtyRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  qtyField: { flex: 1 },
  qtyUnits: { flex: 1.4 },
  hint: { marginLeft: space.xs },
});
