import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Body, Caption } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { formatPortions } from '@/components/planner/MealSlotRow';
import { MEAL_TYPE_LABEL, type BatchCapacity, type ResolvedSlot } from '@/components/planner/model';

export type SlotAction = 'move' | 'copy-batch' | 'copy-leftovers' | 'replace' | 'skip' | 'unskip' | 'remove' | 'batch';

interface Props {
  visible: boolean;
  onClose: () => void;
  resolved: ResolvedSlot | null;
  capacity: BatchCapacity | null;
  onAction: (action: SlotAction) => void;
}

const ICONS: Record<SlotAction, keyof typeof Feather.glyphMap> = {
  move: 'calendar',
  'copy-batch': 'copy',
  'copy-leftovers': 'layers',
  replace: 'refresh-cw',
  skip: 'slash',
  unskip: 'rotate-ccw',
  remove: 'trash-2',
  batch: 'box',
};

/**
 * The labelled More menu. It carries the same operations as the drag gesture, so
 * a person who cannot drag — or is using a screen reader — loses nothing.
 *
 * Copy is deliberately two separate rows rather than one with a mode toggle:
 * cooking a second batch and eating leftovers from the first have different
 * grocery consequences, and burying that behind a segmented control is how a
 * shopping list quietly doubles.
 */
export function SlotActionSheet({ visible, onClose, resolved, capacity, onAction }: Props) {
  if (!resolved) return null;
  const { slot, snapshot, shared } = resolved;
  const label = MEAL_TYPE_LABEL[slot.mealType];
  const remaining = capacity?.remaining ?? 0;
  const logged = slot.status === 'logged';

  const rows: { action: SlotAction; title: string; detail?: string; destructive?: boolean }[] = [
    { action: 'move', title: 'Move to…', detail: 'Pick another day and meal' },
    { action: 'copy-batch', title: 'Cook another batch', detail: 'Buys the ingredients again' },
    {
      action: 'copy-leftovers',
      title: 'Use portions from this batch',
      detail: remaining > 0
        ? `${formatPortions(remaining)} portion${remaining === 1 ? '' : 's'} left — no extra shopping`
        : 'No portions left. Increase what the batch makes first.',
    },
    { action: 'replace', title: 'Replace…', detail: 'Choose a different recipe' },
  ];

  if (shared || resolved.batch.producedPortions !== slot.eatenPortions) {
    rows.push({ action: 'batch', title: 'View batch', detail: 'Production and who eats it' });
  }

  rows.push(slot.status === 'skipped'
    ? { action: 'unskip', title: 'Un-skip', detail: 'Put it back on the plan' }
    : { action: 'skip', title: 'Skip', detail: 'Keep it on the plan, marked skipped' });

  rows.push({ action: 'remove', title: 'Remove', detail: 'Takes it off the plan', destructive: true });

  return (
    <Sheet visible={visible} onClose={onClose} title={snapshot.title}>
      <Caption muted style={styles.context}>{label} · {logged ? 'Already logged' : 'Planned'}</Caption>
      {logged ? (
        <Caption muted style={styles.context}>
          This meal is in your history. Removing it from the plan does not delete what you ate.
        </Caption>
      ) : null}
      <View style={styles.rows}>
        {rows.map((row) => {
          const disabled = row.action === 'copy-leftovers' && remaining <= 0;
          return (
            <Pressable
              key={row.action}
              onPress={() => { if (!disabled) onAction(row.action); }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              accessibilityLabel={row.title}
              accessibilityHint={row.detail}
              style={({ pressed }) => [styles.row, pressed && !disabled && { opacity: opacity.pressed }]}
            >
              <Feather
                name={ICONS[row.action]}
                size={18}
                color={disabled ? color.muted : row.destructive ? color.paprika : color.ink}
              />
              <View style={styles.rowText}>
                <Body style={disabled ? styles.disabled : row.destructive ? styles.destructive : undefined}>
                  {row.title}
                </Body>
                {row.detail ? <Caption muted>{row.detail}</Caption> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  context: { marginBottom: space.sm },
  rows: { marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.base,
    minHeight: layout.minRowHeight,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  rowText: { flex: 1, gap: space.xs },
  destructive: { color: color.paprika },
  disabled: { color: color.muted },
});
