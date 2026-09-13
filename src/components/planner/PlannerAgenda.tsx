import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Body, Caption, SectionLabel } from '@/components/Type';
import { color, layout, space } from '@/constants/theme';
import { friendlyDate } from '@/logic/dates';
import { PlannerConflictError } from '@/logic/plannerSchedule';
import { BatchSheet } from '@/components/planner/BatchSheet';
import { DraggableSlot } from '@/components/planner/DraggableSlot';
import { MealSlotRow } from '@/components/planner/MealSlotRow';
import { PortionSheet } from '@/components/planner/PortionSheet';
import { SlotActionSheet, type SlotAction } from '@/components/planner/SlotActionSheet';
import { SlotDestinationSheet } from '@/components/planner/SlotDestinationSheet';
import type { DayTarget } from '@/components/planner/WeekDayRail';
import {
  batchCapacity,
  copyAsNewBatch,
  copyFromSameBatch,
  isOccupied,
  MEAL_TYPE_LABEL,
  moveSlotTo,
  removeSlot,
  resolveSlotById,
  setEatenPortions,
  setProducedPortions,
  setSlotStatus,
  slotPhrase,
  slotsForDate,
  weekDays,
  type ResolvedSlot,
} from '@/components/planner/model';
import type { DailyTarget, PlannedMealType, PlannerDraft, PlannerNutrition } from '@/types';

interface Props {
  draft: PlannerDraft;
  selectedDate: string;
  target: DailyTarget | null;
  /** Nutrition already logged for the selected day, counted once. */
  eatenEntries: readonly PlannerNutrition[];
  onSelectDate: (localDate: string) => void;
  onCommit: (draft: PlannerDraft, message: string) => void;
  onOpenSlot: (slotId: string) => void;
  onChooseRecipe: (localDate: string, mealType: PlannedMealType) => void;
  /** Replacement is locked to the slot it started from, never merely its date. */
  onReplaceRecipe: (localDate: string, mealType: PlannedMealType, replaceSlotId: string) => void;
  /** Day squares in window coordinates, measured by the rail above this agenda. */
  dayTargets: readonly DayTarget[];
  /** The day currently under a dragged row, so the rail can mark it. */
  onHoverDate: (localDate: string | null) => void;
  /** Asks the rail to re-measure as a drag begins. */
  onLiftSlot: () => void;
  /** Disables editing affordances while a save is in flight. */
  busy?: boolean;
}

type PendingDestination =
  | { kind: 'move'; slotId: string }
  | { kind: 'copy-batch'; slotId: string }
  | { kind: 'copy-leftovers'; slotId: string };

/**
 * The dated agenda, and every editing operation on it.
 *
 * One day at a time in both views, chosen from the single day rail the page
 * carries above this agenda, rather than seven columns compressed onto a phone
 * — the brief is explicit that these are meal slots, not appointments on a time
 * grid.
 *
 * Every mutation goes through the pure helpers in `model.ts`, which validate
 * before returning, so an occupied slot or an over-allocated batch surfaces as a
 * question rather than a corrupted plan.
 */
export function PlannerAgenda({
  draft, selectedDate, target, eatenEntries,
  onSelectDate, onCommit, onOpenSlot, onChooseRecipe, onReplaceRecipe,
  dayTargets, onHoverDate, onLiftSlot, busy,
}: Props) {
  const [actionSlotId, setActionSlotId] = useState<string | null>(null);
  const [portionSlotId, setPortionSlotId] = useState<string | null>(null);
  const [batchSlotId, setBatchSlotId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDestination | null>(null);

  const days = weekDays(draft);
  const day = slotsForDate(draft, selectedDate);

  const resolvedOrNull = (slotId: string | null): ResolvedSlot | null => {
    if (!slotId) return null;
    try {
      return resolveSlotById(draft, slotId);
    } catch {
      return null;
    }
  };

  const actionSlot = resolvedOrNull(actionSlotId);
  const portionSlot = resolvedOrNull(portionSlotId);
  const batchSlot = resolvedOrNull(batchSlotId);

  const apply = useCallback((next: () => PlannerDraft, message: string) => {
    try {
      onCommit(next(), message);
    } catch (error) {
      if (error instanceof PlannerConflictError) throw error;
      Alert.alert('That change is not possible', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [onCommit]);

  /**
   * Every destination-choosing path lands here. An occupied slot always asks
   * before it overwrites, and Cancel leaves the plan untouched — the same rule
   * whether the destination came from a tap or from a drop.
   */
  const commitDestination = (localDate: string, mealType: PlannedMealType) => {
    if (!pending) return;
    const { slotId, kind } = pending;
    const occupied = isOccupied(draft, localDate, mealType);
    const run = (replace: boolean) => {
      setPending(null);
      const message = kind === 'move'
        ? `Moved to ${slotPhrase(localDate, mealType)}`
        : `Added to ${slotPhrase(localDate, mealType)}`;
      apply(() => {
        if (kind === 'move') return moveSlotTo(draft, { slotId, localDate, mealType, replace });
        if (kind === 'copy-batch') return copyAsNewBatch(draft, { slotId, localDate, mealType, replace });
        return copyFromSameBatch(draft, { slotId, localDate, mealType, replace });
      }, message);
    };

    if (occupied && occupied.id !== slotId) {
      const title = draft.snapshots.find((snapshot) =>
        snapshot.id === draft.batches.find((batch) => batch.id === occupied.batchId)?.snapshotId)?.title;
      Alert.alert(
        `Replace ${slotPhrase(localDate, mealType)}?`,
        title ? `${title} is already there. It will come off the plan.` : 'A meal is already there.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => run(true) },
        ],
      );
      return;
    }
    run(false);
  };

  const onSlotAction = (action: SlotAction) => {
    const slotId = actionSlotId;
    if (!slotId) return;
    setActionSlotId(null);
    switch (action) {
      case 'move':
      case 'copy-batch':
      case 'copy-leftovers':
        setPending({ kind: action, slotId });
        return;
      case 'replace': {
        const resolved = resolvedOrNull(slotId);
        if (resolved) onReplaceRecipe(resolved.slot.localDate, resolved.slot.mealType, resolved.slot.id);
        return;
      }
      case 'skip':
        apply(() => setSlotStatus(draft, slotId, 'skipped'), 'Marked skipped');
        return;
      case 'unskip':
        apply(() => setSlotStatus(draft, slotId, 'planned'), 'Back on the plan');
        return;
      case 'batch':
        setBatchSlotId(slotId);
        return;
      case 'remove': {
        const resolved = resolvedOrNull(slotId);
        const shared = resolved?.shared ?? false;
        Alert.alert(
          'Remove this meal?',
          shared
            ? 'The batch stays, because another meal still eats from it.'
            : 'Its ingredients come off the grocery list too. Anything already logged stays in your history.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => apply(() => removeSlot(draft, slotId), 'Removed from the plan'),
            },
          ],
        );
        return;
      }
    }
  };

  const onDrop = (slotId: string, localDate: string) => {
    // Dropping onto a day only chooses the day. The meal is still an explicit
    // decision, so a drag can never silently overwrite lunch with dinner.
    setPending({ kind: 'move', slotId });
    onSelectDate(localDate);
  };

  const pendingTitle = pending?.kind === 'move' ? 'Move to…'
    : pending?.kind === 'copy-batch' ? 'Cook another batch on…'
      : 'Use portions on…';

  const otherEntriesForDay = (excludeSlotId: string): PlannerNutrition[] => {
    const planned = draft.slots
      .filter((slot) => slot.localDate === selectedDate && slot.id !== excludeSlotId && slot.status === 'planned')
      .flatMap((slot) => {
        const resolved = resolvedOrNull(slot.id);
        return resolved ? [resolved.snapshot.nutritionPerPortion] : [];
      });
    return [...eatenEntries, ...planned];
  };

  return (
    <View>
      <SectionLabel style={styles.dayLabel}>{friendlyDate(day.localDate)}</SectionLabel>

      <View style={styles.slots}>
        {day.entries.map((entry) => (
          <DraggableSlot
            key={entry.mealType}
            slotId={entry.resolved?.slot.id}
            targets={dayTargets}
            onHover={onHoverDate}
            onDrop={onDrop}
            onLift={onLiftSlot}
            enabled={!busy}
          >
            <MealSlotRow
              mealType={entry.mealType}
              resolved={entry.resolved}
              onPress={() => entry.resolved
                ? onOpenSlot(entry.resolved.slot.id)
                : onChooseRecipe(day.localDate, entry.mealType)}
              onMore={entry.resolved && !busy ? () => setActionSlotId(entry.resolved!.slot.id) : undefined}
              lifted={false}
            />
          </DraggableSlot>
        ))}
      </View>

      {day.entries.some((entry) => entry.resolved) ? (
        <View style={styles.dayActions}>
          {day.entries.flatMap((entry) => entry.resolved ? [entry.resolved] : []).map((resolved) => (
            <Body
              key={resolved.slot.id}
              onPress={() => setPortionSlotId(resolved.slot.id)}
              accessibilityRole="button"
              accessibilityLabel={`Adjust portions for ${MEAL_TYPE_LABEL[resolved.slot.mealType].toLowerCase()}`}
              style={styles.link}
            >
              Adjust {MEAL_TYPE_LABEL[resolved.slot.mealType].toLowerCase()} portions
            </Body>
          ))}
        </View>
      ) : (
        <Caption muted style={styles.dayActions}>
          Nothing scheduled for this day yet. A partial week is fine — plan only the meals you want to.
        </Caption>
      )}

      <SlotActionSheet
        visible={actionSlotId !== null}
        onClose={() => setActionSlotId(null)}
        resolved={actionSlot}
        capacity={actionSlot ? batchCapacity(draft, actionSlot.batch.id) : null}
        onAction={onSlotAction}
      />

      <SlotDestinationSheet
        visible={pending !== null}
        onClose={() => setPending(null)}
        title={pendingTitle}
        days={days}
        draft={draft}
        excludeSlotId={pending?.kind === 'move' ? pending.slotId : undefined}
        defaultDate={selectedDate}
        onSelect={commitDestination}
      />

      <PortionSheet
        visible={portionSlotId !== null}
        onClose={() => setPortionSlotId(null)}
        resolved={portionSlot}
        otherEntries={portionSlotId ? otherEntriesForDay(portionSlotId) : []}
        target={target}
        maxPortions={portionSlot
          ? batchCapacity(draft, portionSlot.batch.id).remaining + portionSlot.slot.eatenPortions
          : 1}
        onApply={(eaten) => {
          const slotId = portionSlotId;
          setPortionSlotId(null);
          if (slotId) apply(() => setEatenPortions(draft, slotId, eaten), 'Portion updated');
        }}
      />

      <BatchSheet
        visible={batchSlotId !== null}
        onClose={() => setBatchSlotId(null)}
        resolved={batchSlot}
        draft={draft}
        capacity={batchSlot ? batchCapacity(draft, batchSlot.batch.id) : null}
        onChangeProduction={(produced) => {
          const batchId = batchSlot?.batch.id;
          setBatchSlotId(null);
          if (batchId) apply(() => setProducedPortions(draft, batchId, produced), 'Batch size updated');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dayLabel: { marginTop: space.base, marginBottom: space.xs },
  slots: { borderTopWidth: 1, borderTopColor: color.line },
  dayActions: { marginTop: space.md, gap: space.sm },
  link: { color: color.action, minHeight: layout.minTouchTarget, paddingTop: space.md },
});
