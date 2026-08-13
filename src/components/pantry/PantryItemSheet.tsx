import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { EditAction } from '@/components/EditAction';
import { Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { expiryLabel, statusLabel } from '@/components/pantry/labels';
import { Sheet } from '@/components/Sheet';
import { Caption, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { localDateString } from '@/logic/dates';
import { getCanonicalById, getPantryItem } from '@/db/queries';
import { usePantryStore, type PantryEntry } from '@/store/pantryStore';
import { FULLNESS_LEVELS, type CanonicalItem, type Fullness, type MeasureUnit, type PantryItem } from '@/types';

interface Props {
  entry: PantryEntry | null;
  onClose: () => void;
}

const FULLNESS_OPTIONS = FULLNESS_LEVELS.map((value) => ({
  value,
  label: value === 'full' ? 'Full' : value === 'half' ? 'Half' : value === 'low' ? 'Low' : 'Out',
}));

/** Uses-tracked classes get the four-bucket fullness control (decision 14). */
const USES_TRACKED = ['seasoning', 'condiment'];

/**
 * One item: its status in words, its expiry, and the one-tap actions.
 * The only figure ever shown is the user's own entry, marked as theirs.
 */
export function PantryItemSheet({ entry, onClose }: Props) {
  const store = usePantryStore();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [item, setItem] = useState<PantryItem | null>(null);
  const [canonical, setCanonical] = useState<CanonicalItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [purchasedAt, setPurchasedAt] = useState('');
  const [qty, setQty] = useState('');
  const [qtyUnit, setQtyUnit] = useState<MeasureUnit>('g');
  const [editExpiry, setEditExpiry] = useState('');
  const [editError, setEditError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    setEditing(false);
    setEditError(undefined);
    if (!entry) { setItem(null); return () => { active = false; }; }
    void getPantryItem(entry.id).then((loaded) => {
      if (!active || !loaded) return;
      setItem(loaded);
      setLocationId(loaded.locationId);
      setPurchasedAt(loaded.purchasedAt);
      setQty(loaded.qtyRemaining == null ? '' : String(loaded.qtyRemaining));
      setQtyUnit(loaded.qtyUnit ?? 'g');
      setEditExpiry(loaded.expiresAt ?? '');
    });
    return () => { active = false; };
  }, [entry]);

  if (!entry) return <Sheet visible={false} onClose={onClose} title="">{null}</Sheet>;

  const run = (work: () => Promise<void>, keepOpen = false) => {
    if (busy) return;
    setBusy(true);
    void work()
      .catch(() => {})
      .finally(() => {
        setBusy(false);
        if (!keepOpen) onClose();
      });
  };

  const setFullness = (fullness: Fullness) => {
    run(() => store.setFullness(entry.id, fullness), true);
  };

  const saveEdit = () => {
    if (!item || !canonical || !locationId || !purchasedAt || busy) return;
    const parsedQty = qty.trim() ? Number(qty) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedAt)) {
      setEditError('Use an acquired date like 2026-08-12.');
      return;
    }
    if (parsedQty !== null && (!Number.isFinite(parsedQty) || parsedQty < 0)) {
      setEditError('Quantity must be zero or greater.');
      return;
    }
    setEditError(undefined);
    setBusy(true);
    void store.updateItem(item.id, {
      canonicalId: canonical.id,
      locationId,
      purchasedAt,
      qtyRemaining: parsedQty,
      qtyUnit: parsedQty === null ? null : qtyUnit,
      expiresAt: editExpiry.trim() || null,
    }).then(() => setEditing(false)).catch(() => setEditError('Could not save this item. Your changes are still here.')).finally(() => setBusy(false));
  };

  if (editing && item) {
    return (
      <Sheet visible onClose={() => setEditing(false)} title={`Edit ${entry.name}`} footer={<View style={styles.footer}><Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} /><Button label="Save changes" onPress={saveEdit} loading={busy} disabled={!canonical || !locationId || !purchasedAt} /></View>}>
        <View style={styles.editSection}>
          <Pressable onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel="Change ingredient" style={styles.pickerBox}><Caption>{canonical?.displayName ?? entry.name}</Caption></Pressable>
        </View>
        <View style={styles.editSection}><SectionLabel muted>Where it lives</SectionLabel><View style={styles.locations}>{store.locations.map((location) => <Pressable key={location.id} onPress={() => setLocationId(location.id)} accessibilityRole="radio" accessibilityState={{ selected: location.id === locationId }} style={[styles.locationChip, location.id === locationId && styles.locationChipOn]}><Caption muted={location.id !== locationId} style={location.id === locationId ? styles.chipTextOn : undefined}>{location.name}</Caption></Pressable>)}</View></View>
        <Field label="Acquired (YYYY-MM-DD)" value={purchasedAt} onChangeText={(value) => { setPurchasedAt(value); setEditError(undefined); }} placeholder={localDateString()} error={editError} />
        <Field label="Expiry date (optional)" value={editExpiry} onChangeText={(value) => { setEditExpiry(value); setEditError(undefined); }} placeholder="YYYY-MM-DD" />
        <View style={styles.qtyRow}><Field label="Your quantity (optional)" value={qty} onChangeText={(value) => { setQty(value); setEditError(undefined); }} placeholder="e.g. 500" keyboardType="numeric" numeric style={styles.qtyField} /><Segmented options={QTY_UNITS} value={qtyUnit} onChange={setQtyUnit} style={styles.qtyUnits} /></View>
        <Caption muted>Changing the ingredient is an explicit identity correction. Captured source and provenance remain attached.</Caption>
        <CanonicalPickerSheet visible={picking} title="What is it?" onPick={(next) => { setCanonical(next); setPicking(false); }} onClose={() => setPicking(false)} />
      </Sheet>
    );
  }

  return (
    <Sheet visible onClose={onClose} title={entry.name}>
      <View style={styles.facts}>
        <Caption muted>
          {entry.locationName}
          {entry.opened ? ' · opened' : ''}
        </Caption>
        <ScreenTitle>
          {statusLabel(entry.status, entry.statusConfident)}
        </ScreenTitle>
        <Caption muted>{expiryLabel(entry)}</Caption>
        {entry.expiryIsPredicted && entry.expiryDataSource ? (
          <Caption muted>
            Quality timing: {entry.expiryDataSource === 'foodkeeper'
              ? 'USDA FoodKeeper'
              : entry.expiryDataSource === 'food-data-central'
                ? 'USDA FoodData Central'
                : 'Mise catalogue'}.
          </Caption>
        ) : null}
        {entry.userEnteredQty ? (
          <Caption muted>Your entry: {entry.userEnteredQty}</Caption>
        ) : null}
      </View>

      {entry.suggestFullnessCheck ? (
        <Caption muted style={styles.check}>
          It's been a while since this was checked — a quick look keeps the
          list honest.
        </Caption>
      ) : null}

      {USES_TRACKED.includes(entry.foodClass) ? (
        <View style={styles.section}>
          <SectionLabel muted>How full is it?</SectionLabel>
          <Segmented
            options={FULLNESS_OPTIONS}
            value={entry.fullness ?? 'full'}
            onChange={setFullness}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <EditAction onPress={() => { setCanonical(null); void getCanonicalById(entry.canonicalId).then(setCanonical); setEditing(true); }} disabled={busy} />
        {!entry.opened ? (
          <Button
            label="Mark opened"
            variant="secondary"
            onPress={() => run(() => store.markOpened(entry.id))}
            disabled={busy}
          />
        ) : null}
        {entry.freezable ? (
          <Button
            label="Freeze it"
            variant="secondary"
            onPress={() => run(() => store.freeze(entry.id))}
            disabled={busy}
          />
        ) : null}
        <Button
          label="Running low"
          variant="secondary"
          onPress={() => run(() => store.markRunningLow(entry.id))}
          disabled={busy}
        />
        <Button
          label="Used it up"
          onPress={() => run(() => store.markUsedUp(entry.id))}
          disabled={busy}
        />
        <Button
          label="Discard — it went off"
          variant="destructive"
          onPress={() => run(() => store.discard(entry.id))}
          disabled={busy}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  facts: { gap: space.xs },
  section: { gap: space.sm, marginTop: space.base },
  check: { marginTop: space.base },
  actions: { gap: space.sm, marginTop: space.lg },
  footer: { gap: space.sm },
  editSection: { gap: space.sm },
  pickerBox: { minHeight: layout.minTouchTarget, borderRadius: radius.input, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, paddingHorizontal: space.base, justifyContent: 'center' },
  locations: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  locationChip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.input, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  locationChipOn: { borderColor: color.action, backgroundColor: color.action },
  chipTextOn: { color: color.onAction },
  qtyRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  qtyField: { flex: 1 },
  qtyUnits: { flex: 1.4 },
});

const QTY_UNITS: { value: MeasureUnit; label: string }[] = [
  { value: 'g', label: 'g' }, { value: 'ml', label: 'ml' }, { value: 'piece', label: 'pieces' },
];
