import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { LabelledStepper } from '@/components/planner/LabelledStepper';
import { Body, Caption, SectionLabel } from '@/components/Type';
import { color, layout, space } from '@/constants/theme';
import { friendlyDate } from '@/logic/dates';
import { formatPortions } from '@/components/planner/MealSlotRow';
import { MEAL_TYPE_LABEL, type BatchCapacity, type ResolvedSlot } from '@/components/planner/model';
import type { PlannedMealSlot, PlannerDraft } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  resolved: ResolvedSlot | null;
  draft: PlannerDraft;
  capacity: BatchCapacity | null;
  onChangeProduction: (producedPortions: number) => void;
}

/**
 * What one cooking session makes, and who eats it.
 *
 * Production and consumption are separate numbers on purpose. Other people at
 * the table are represented by raising **Batch makes**, which is what the
 * grocery list buys for; **Your portion** on each slot is what counts toward
 * your own nutrition. Conflating them is how a shopping list ends up four times
 * too large — or a household of four ends up shopping for one.
 */
export function BatchSheet({ visible, onClose, resolved, draft, capacity, onChangeProduction }: Props) {
  const produced = resolved?.batch.producedPortions ?? 1;
  const [value, setValue] = useState(produced);

  useEffect(() => { if (visible) setValue(produced); }, [visible, produced]);

  if (!resolved || !capacity) return null;

  const eaters: PlannedMealSlot[] = draft.slots
    .filter((slot) => slot.batchId === resolved.batch.id)
    .slice()
    .sort((left, right) => left.localDate.localeCompare(right.localDate));
  const allocated = capacity.allocated;
  const belowAllocated = value < allocated;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Batch"
      footer={(
        <View style={styles.footer}>
          <Button
            label="Save batch size"
            onPress={() => onChangeProduction(value)}
            disabled={value === produced || belowAllocated}
            block
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} block />
        </View>
      )}
    >
      <Caption muted>{resolved.snapshot.title} · cooked {friendlyDate(resolved.batch.cookDate)}</Caption>

      <View style={styles.stepper}>
        <LabelledStepper
          label="Batch makes"
          value={value}
          onChange={setValue}
          step={1}
          min={1}
          max={24}
          unit="portions"
        />
        <Caption muted>Changing this changes the grocery list. It does not change what any one meal counts as.</Caption>
      </View>

      {belowAllocated ? (
        <Caption style={styles.warning}>
          {formatPortions(allocated)} portions are already promised to meals below. Reduce a portion or remove a
          meal before making the batch smaller.
        </Caption>
      ) : null}

      <SectionLabel style={styles.sectionLabel}>Who eats it</SectionLabel>
      <View>
        {eaters.map((slot) => (
          <View key={slot.id} style={styles.row}>
            <View style={styles.rowText}>
              <Body>{friendlyDate(slot.localDate)} · {MEAL_TYPE_LABEL[slot.mealType]}</Body>
              <Caption muted>{slot.status === 'skipped' ? 'Skipped — portions returned' : slot.status === 'logged' ? 'Logged' : 'Planned'}</Caption>
            </View>
            <Body numeric>{formatPortions(slot.eatenPortions)}</Body>
          </View>
        ))}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Caption muted>Makes</Caption>
          <Body numeric>{formatPortions(value)} portions</Body>
        </View>
        <View style={styles.summaryRow}>
          <Caption muted>Allocated</Caption>
          <Body numeric>{formatPortions(allocated)} portions</Body>
        </View>
        <View style={styles.summaryRow}>
          <Caption muted>Unclaimed</Caption>
          <Body numeric>{formatPortions(Math.max(0, value - allocated))} portions</Body>
        </View>
      </View>
      <Caption muted style={styles.sectionLabel}>
        Dates say when you planned to cook and eat. They are not a claim about how long this keeps.
      </Caption>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stepper: { gap: space.sm, marginTop: space.base },
  sectionLabel: { marginTop: space.base },
  warning: { color: color.paprika, marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.base,
    minHeight: layout.minRowHeight,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  rowText: { flex: 1, gap: space.xs },
  summary: { marginTop: space.base, gap: space.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer: { gap: space.sm },
});
