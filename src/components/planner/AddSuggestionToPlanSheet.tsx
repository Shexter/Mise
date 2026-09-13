import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, SectionLabel } from '@/components/Type';
import { color, layout, space } from '@/constants/theme';
import { friendlyDate } from '@/logic/dates';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import { addRecipeToSlot, isOccupied, slotPhrase, weekDays } from '@/components/planner/model';
import { SlotDestinationSheet } from '@/components/planner/SlotDestinationSheet';
import { usePlannerCommit } from '@/components/planner/usePlannerCommit';
import type { CanonicalItem, PlannedMealType, Suggestion } from '@/types';
import { suggestionToSnapshot } from '@/components/planner/suggestionSnapshot';

interface Props {
  visible: boolean;
  onClose: () => void;
  suggestion: Suggestion | null;
  canonicals: ReadonlyMap<string, CanonicalItem>;
}

/**
 * Puts a dinner idea onto the schedule, but only after it is shown as a plan.
 *
 * Dinner's own "I cooked this" is untouched and remains the fast path. This is
 * the deliberate detour: a preview of what would be scheduled, an explicit
 * destination, and a confirmation. Cancelling at any point leaves both the
 * suggestion and the plan exactly as they were.
 */
export function AddSuggestionToPlanSheet({ visible, onClose, suggestion, canonicals }: Props) {
  const commit = usePlannerCommit();
  const draft = useMealScheduleStore((state) => state.draft);
  const [choosing, setChoosing] = useState(false);

  if (!suggestion || !draft) return null;

  const snapshot = suggestionToSnapshot({ suggestion, canonicals, mealType: 'dinner' });
  const nutrition = snapshot.nutritionPerPortion;
  const unknown = nutrition.calories === null;

  const schedule = (localDate: string, mealType: PlannedMealType) => {
    const run = (replace: boolean) => {
      try {
        const next = addRecipeToSlot(draft, {
          snapshot, localDate, mealType,
          eatenPortions: 1, producedPortions: snapshot.baseYield, replace,
        });
        void commit(next, `Saved to ${slotPhrase(localDate, mealType)}`)
          .then((ok) => { if (ok) { setChoosing(false); onClose(); } });
      } catch (error) {
        Alert.alert('That change is not possible', error instanceof Error ? error.message : 'Please try again.');
      }
    };

    const occupied = isOccupied(draft, localDate, mealType);
    if (occupied) {
      Alert.alert(
        `Replace ${slotPhrase(localDate, mealType)}?`,
        'A meal is already scheduled there.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => run(true) },
        ],
      );
      return;
    }
    run(false);
  };

  return (
    <>
      <Sheet
        visible={visible && !choosing}
        onClose={onClose}
        title="Add to your plan"
        footer={(
          <View style={styles.footer}>
            <Button label="Choose a day" onPress={() => setChoosing(true)} block />
            <Button label="Cancel" variant="ghost" onPress={onClose} block />
          </View>
        )}
      >
        <Body>{suggestion.dish}</Body>
        <Caption muted style={styles.detail}>
          Scheduling this only puts it on the plan. It does not log a meal, and it does not touch your pantry.
        </Caption>

        <SectionLabel style={styles.sectionLabel}>What would be scheduled</SectionLabel>
        <View style={styles.rows}>
          <View style={styles.row}>
            <Body>Batch makes</Body>
            <Body numeric>{snapshot.baseYield} portion{snapshot.baseYield === 1 ? '' : 's'}</Body>
          </View>
          <View style={styles.row}>
            <Body>Your portion</Body>
            <Body numeric>1</Body>
          </View>
          <View style={styles.row}>
            <Body>Estimated calories</Body>
            <Body numeric>
              {unknown ? 'Unknown' : `${Math.round(nutrition.calories!)} kcal`}
            </Body>
          </View>
        </View>
        {unknown ? (
          <Caption muted style={styles.sectionLabel}>
            Nutrition incomplete — the catalogue cannot price every ingredient in this idea. It is still schedulable;
            nothing is filled in with zero.
          </Caption>
        ) : null}
        <Caption muted style={styles.sectionLabel}>
          {snapshot.ingredients.length} ingredient{snapshot.ingredients.length === 1 ? '' : 's'} would join your grocery
          list once you apply it in Shop.
        </Caption>
      </Sheet>

      <SlotDestinationSheet
        visible={choosing}
        onClose={() => setChoosing(false)}
        title="Schedule it on…"
        days={weekDays(draft)}
        draft={draft}
        onSelect={schedule}
      />
    </>
  );
}

const styles = StyleSheet.create({
  detail: { marginTop: space.xs },
  sectionLabel: { marginTop: space.base },
  rows: { borderTopWidth: 1, borderTopColor: color.line },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    minHeight: layout.minRowHeight, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: color.line,
  },
  footer: { gap: space.sm },
});
