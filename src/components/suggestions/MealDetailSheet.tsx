import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { FoodVisual } from '@/components/FoodVisual';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Body, ButtonLabel, Caption, MealCalories, RowTitle, SectionLabel } from '@/components/Type';
import { color, macroColor, opacity, radius, space, swipeTokens } from '@/constants/theme';
import { formatQuantity } from '@/logic/scaling';
import type { CanonicalItem, Suggestion } from '@/types';

/**
 * The cooking plan for a card the user swiped right on.
 *
 * `@gorhom/bottom-sheet` is not a dependency of this project, so this composes
 * the app's own `Sheet` — which already owns the scrim, the safe-area inset,
 * the keyboard avoidance, and a footer pinned outside the scroll area — rather
 * than introducing a second, parallel sheet implementation. `detents` opts in
 * to the half-and-full resting heights, which only this sheet asks for.
 */

interface Props {
  meal: Suggestion | null;
  servingsMade: number;
  servingsEaten: number;
  saving?: boolean;
  /** Resolves ingredient ids to their catalogue names. */
  canonicals?: ReadonlyMap<string, CanonicalItem>;
  onServingsMade: (value: number) => void;
  onServingsEaten: (value: number) => void;
  onClose: () => void;
  onCook: () => void;
  /** Passing from inside the sheet, subordinate to cooking. */
  onPass?: () => void;
}

export function MealDetailSheet({
  meal,
  servingsMade,
  servingsEaten,
  saving = false,
  canonicals,
  onServingsMade,
  onServingsEaten,
  onClose,
  onCook,
  onPass,
}: Props) {
  return (
    <Sheet
      visible={meal !== null}
      onClose={onClose}
      title="Cooking plan"
      detents
      footer={
        <View style={styles.footer}>
          <Button label="Cook it" onPress={onCook} loading={saving} />
          {onPass ? (
            <Pressable
              onPress={onPass}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Pass on this meal"
              hitSlop={space.md}
              style={({ pressed }) => [styles.passLink, pressed && { opacity: opacity.pressed }]}
            >
              <ButtonLabel muted>Pass</ButtonLabel>
            </Pressable>
          ) : null}
        </View>
      }
    >
      {meal ? (
        <View style={styles.body}>
          <MacroSummary meal={meal} servingsEaten={servingsEaten} />
          <RowTitle>{meal.dish}</RowTitle>

          <View style={styles.field}>
            <SectionLabel muted>Servings made</SectionLabel>
            <Caption muted>Scales what comes out of the pantry.</Caption>
            <Stepper
              value={servingsMade}
              onChange={onServingsMade}
              min={1}
              max={20}
              step={1}
              label="Servings made"
            />
          </View>
          <View style={styles.field}>
            <SectionLabel muted>Servings eaten</SectionLabel>
            <Caption muted>Scales what is logged against today.</Caption>
            <Stepper
              value={servingsEaten}
              onChange={onServingsEaten}
              min={0.25}
              max={20}
              step={0.25}
              label="Servings eaten"
            />
          </View>

          <View style={styles.section}>
            <SectionLabel muted>Ingredients</SectionLabel>
            {meal.uses.map((use) => (
              <IngredientRow
                key={use.canonicalId}
                canonicalId={use.canonicalId}
                category={canonicals?.get(use.canonicalId)?.foodClass}
                name={canonicals?.get(use.canonicalId)?.displayName ?? use.canonicalId}
                detail={`${formatQuantity(use.qty * servingsMade)} ${use.unit}`}
                held
              />
            ))}
            {meal.missing.map((item, index) => (
              <IngredientRow
                key={`${item.name}-${index}`}
                canonicalId={item.canonicalId}
                category={item.canonicalId ? canonicals?.get(item.canonicalId)?.foodClass : 'other'}
                name={item.name}
                detail={item.note}
                held={false}
              />
            ))}
          </View>

          <View style={styles.steps}>
            <SectionLabel muted>Outline</SectionLabel>
            {meal.method.map((step, index) => (
              <View key={index} style={styles.step}>
                <MealCalories style={styles.stepNumber}>{index + 1}</MealCalories>
                <Body style={styles.stepBody}>{step}</Body>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

/** Calories and macros for the portion actually being eaten, live. */
function MacroSummary({ meal, servingsEaten }: { meal: Suggestion; servingsEaten: number }) {
  const perServing = meal.estimatedNutritionPerServing ?? null;
  const kcal = Math.round(meal.kcalPerServing * servingsEaten);
  const scale = (grams: number | undefined) =>
    grams === undefined || !Number.isFinite(grams) ? null : Math.round(grams * servingsEaten);

  return (
    <View style={styles.summary}>
      <View style={styles.summaryHead}>
        <MealCalories>{kcal}</MealCalories>
        <Caption muted>kcal eaten</Caption>
      </View>
      <View style={styles.summaryMacros}>
        <SummaryMacro label="Protein" grams={scale(perServing?.proteinG)} dot={macroColor.protein} />
        <SummaryMacro label="Carbs" grams={scale(perServing?.carbsG)} dot={macroColor.carbs} />
        <SummaryMacro label="Fat" grams={scale(perServing?.fatG)} dot={macroColor.fat} />
      </View>
    </View>
  );
}

function SummaryMacro({ label, grams, dot }: { label: string; grams: number | null; dot: string }) {
  return (
    <View
      style={styles.summaryMacro}
      accessibilityLabel={`${label} ${grams === null ? 'unknown' : `${grams} grams`}`}
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Caption>{grams === null ? '—' : `${grams}g`}</Caption>
      <Caption muted>{label}</Caption>
    </View>
  );
}

/**
 * Every ingredient is a row, always. Nothing is collapsed behind a disclosure;
 * the whole point of the sheet is seeing what a meal will actually cost you.
 */
function IngredientRow({
  name,
  detail,
  held,
  canonicalId,
  category,
}: {
  name: string;
  detail: string | null;
  held: boolean;
  canonicalId?: string | null;
  category?: string | null;
}) {
  return (
    <View style={styles.ingredient} accessibilityLabel={`${name}${held ? '' : ', missing'}`}>
      <FoodVisual
        canonicalId={canonicalId}
        category={category}
        size="sm"
      />
      <View style={styles.ingredientInfo}>
        <Body muted={!held} style={styles.ingredientName}>
          {name}
        </Body>
        {detail ? <Caption muted>{detail}</Caption> : null}
      </View>
      {held ? null : <Caption style={styles.missing}>Missing</Caption>}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  summary: {
    gap: space.md,
    padding: space.base,
    borderRadius: radius.card,
    backgroundColor: color.surface,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  summaryMacros: { flexDirection: 'row', flexWrap: 'wrap', gap: space.base },
  summaryMacro: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: space.md, height: space.md, borderRadius: radius.full },
  dotHeld: { backgroundColor: swipeTokens.badge.exactFitBg },
  dotMissing: { backgroundColor: color.line },
  field: { gap: space.sm },
  section: { gap: space.sm },
  ingredient: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ingredientInfo: { flex: 1, gap: space.xs },
  ingredientName: { flexShrink: 1 },
  missing: { color: swipeTokens.overlay.passColor },
  steps: { gap: space.base },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  stepNumber: { minWidth: space.lg },
  stepBody: { flex: 1 },
  footer: { gap: space.sm },
  passLink: { alignSelf: 'center', paddingVertical: space.md, paddingHorizontal: space.base },
});
