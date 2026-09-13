import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { LabelledStepper } from '@/components/planner/LabelledStepper';
import { Body, Caption, SectionLabel } from '@/components/Type';
import { color, layout, space } from '@/constants/theme';
import { fitSingleMealPortion, scaleNutrition, sumNutrition } from '@/logic/plannerNutrition';
import { formatPortions } from '@/components/planner/MealSlotRow';
import { MEAL_TYPE_LABEL, type ResolvedSlot } from '@/components/planner/model';
import type { DailyTarget, PlannerNutrition } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  resolved: ResolvedSlot | null;
  /** Everything else already planned or eaten on the same day. */
  otherEntries: readonly PlannerNutrition[];
  target: DailyTarget | null;
  /** Portions the batch can still give this slot, its own share included. */
  maxPortions: number;
  onApply: (eatenPortions: number) => void;
}

const FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', targetKey: 'targetCalories' },
  { key: 'proteinG', label: 'Protein', unit: 'g', targetKey: 'proteinG' },
  { key: 'carbsG', label: 'Carbs', unit: 'g', targetKey: 'carbsG' },
  { key: 'fatG', label: 'Fat', unit: 'g', targetKey: 'fatG' },
] as const;

/**
 * Adjust portions for one meal against the day's existing target.
 *
 * Three rules the copy has to hold up:
 * - Scaling a recipe changes its size, never its macro ratio. The residual is
 *   shown after applying, so nobody reads a suggestion as a promise of a fit.
 * - Automatic fitting needs complete energy and P/C/F for every entry counted.
 *   Missing data disables the suggestion and says which nutrient is missing
 *   rather than quietly treating it as zero.
 * - Nothing is written until Apply. Cancel leaves the plan and the grocery list
 *   exactly as they were.
 */
export function PortionSheet({ visible, onClose, resolved, otherEntries, target, maxPortions, onApply }: Props) {
  const original = resolved?.slot.eatenPortions ?? 1;
  const [portions, setPortions] = useState(original);

  const perPortion = resolved?.snapshot.nutritionPerPortion ?? null;
  const others = useMemo(() => sumNutrition(otherEntries), [otherEntries]);

  const proposed = perPortion ? scaleNutrition(perPortion, portions) : null;
  const current = perPortion ? scaleNutrition(perPortion, original) : null;

  const unknownFields = perPortion
    ? FIELDS.filter((field) => perPortion[field.key] === null).map((field) => field.label)
    : FIELDS.map((field) => field.label);
  const othersIncomplete = FIELDS.some((field) => others[field.key] === null);

  const suggestion = useMemo(() => {
    if (!perPortion || !target) return null;
    return fitSingleMealPortion(perPortion, others, target, original);
  }, [perPortion, others, target, original]);

  const canSuggest = suggestion !== null && suggestion.improved
    && suggestion.multiplier <= maxPortions;

  if (!resolved) return null;

  const reset = () => setPortions(original);
  const close = () => { reset(); onClose(); };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Adjust portions"
      footer={(
        <View style={styles.footer}>
          <Button
            label="Apply portion"
            onPress={() => onApply(portions)}
            disabled={portions === original}
            block
          />
          <Button label="Cancel" variant="ghost" onPress={close} block />
        </View>
      )}
    >
      <Caption muted>
        {MEAL_TYPE_LABEL[resolved.slot.mealType]} · {resolved.snapshot.title}
      </Caption>

      <View style={styles.stepper}>
        <LabelledStepper
          label="Your portion"
          value={portions}
          onChange={setPortions}
          step={0.25}
          min={0.25}
          max={maxPortions}
          unit="portions"
        />
        <Caption muted>
          Original {formatPortions(original)} · this batch can give {formatPortions(maxPortions)}
        </Caption>
      </View>

      {target ? (
        <>
          <SectionLabel style={styles.sectionLabel}>Against today's target</SectionLabel>
          <View>
            {FIELDS.map((field) => {
              const targetValue = target[field.targetKey];
              const otherValue = others[field.key];
              const before = current?.[field.key] ?? null;
              const after = proposed?.[field.key] ?? null;
              const residual = otherValue === null || after === null ? null : targetValue - otherValue - after;
              return (
                <View key={field.key} style={styles.row}>
                  <View style={styles.rowLabel}>
                    <Body>{field.label}</Body>
                    <Caption muted>Target {Math.round(targetValue)} {field.unit}</Caption>
                  </View>
                  <View style={styles.rowValues}>
                    <Body numeric>
                      {before === null ? '—' : Math.round(before)}
                      {' → '}
                      {after === null ? '—' : Math.round(after)} {field.unit}
                    </Body>
                    <Caption muted numeric>
                      {residual === null
                        ? 'Remaining unknown'
                        : residual >= 0
                          ? `${Math.round(residual)} ${field.unit} left`
                          : `${Math.abs(Math.round(residual))} ${field.unit} over`}
                    </Caption>
                  </View>
                </View>
              );
            })}
          </View>

          {canSuggest ? (
            <Button
              label={`Try ${formatPortions(suggestion!.multiplier)} portions`}
              detail="Closest fit within 0.5–2 portions"
              variant="secondary"
              onPress={() => setPortions(suggestion!.multiplier)}
              style={styles.suggest}
            />
          ) : (
            <Caption muted style={styles.suggest}>
              {unknownFields.length > 0
                ? `No portion can be fitted automatically: ${unknownFields.join(', ')} ${unknownFields.length === 1 ? 'is' : 'are'} unknown for this recipe.`
                : othersIncomplete
                  ? 'No portion can be fitted automatically while another meal today has unknown nutrition.'
                  : 'No portion between 0.5 and 2 gets closer than the one you have. Changing the recipe is the way to change the balance.'}
            </Caption>
          )}
        </>
      ) : (
        <Caption muted style={styles.sectionLabel}>
          Add calorie and macro targets to compare portions against your day. You can still set the portion yourself.
        </Caption>
      )}

      {unknownFields.length > 0 ? (
        <Caption muted style={styles.sectionLabel}>
          Nutrition incomplete — {unknownFields.join(', ')} unknown. Scaling changes the amount, never the balance.
        </Caption>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stepper: { gap: space.sm, marginTop: space.base, marginBottom: space.base },
  sectionLabel: { marginTop: space.base },
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
  rowLabel: { gap: space.xs },
  rowValues: { alignItems: 'flex-end', gap: space.xs },
  suggest: { marginTop: space.base },
  footer: { gap: space.sm },
});
