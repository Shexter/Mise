import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';

import { Caption, ScreenTitle } from '@/components/Type';
import {
  cardShadowStyle,
  color,
  fillParent,
  font,
  macroColor,
  radius,
  space,
  swipeTokens,
} from '@/constants/theme';
import {
  calorieFit,
  detectCuisine,
  pantryAccessibilityLabel,
  pantryCoverage,
  pantryLabel,
  pantryStatusFor,
  prepSpeed,
  PREP_SPEED_LABELS,
  type CalorieFitKind,
} from '@/logic/mealCard';
import type { MealBudgetEvaluation, SuggestionNutritionProvenance } from '@/logic/suggest';
import type { Suggestion } from '@/types';

interface Props {
  meal: Suggestion;
  /** Owned by the deck; drives the stamps on the UI thread only. */
  translateX: SharedValue<number>;
  cardWidth: number;
  /** Daily allowance left to spend. Null when no target is set. */
  remainingCalories?: number | null;
  /**
   * Counted by the caller. Omit to derive it from the suggestion, optionally
   * re-checked against `onHandCanonicalIds`.
   */
  pantryStatus?: { held: number; total: number };
  /** The top card carries the deeper shadow; peeking cards sit flatter. */
  isTopCard?: boolean;
  /**
   * TODO(reconcile with the deck): `budget`, `elevationLevel`, and
   * `onHandCanonicalIds` are the deck's existing vocabulary for the three
   * props above. They are accepted so the two halves of this change compose
   * today; one pair should be dropped once the deck settles.
   */
  budget?: MealBudgetEvaluation | null;
  elevationLevel?: 1 | 2 | 3;
  onHandCanonicalIds?: ReadonlySet<string>;
  /** Supplied by the deck when it has resolved catalogue certainty. */
  provenance?: SuggestionNutritionProvenance;
  /** Overrides the name-derived cuisine. Null hides the pill entirely. */
  cuisine?: string | null;
}

/** Fraction of the card width at which a stamp reaches full opacity. */
const STAMP_FULL_AT = 0.35;

const BADGE_FILL: Record<CalorieFitKind, string> = {
  'exact-fit': swipeTokens.badge.exactFitBg,
  'fits-budget': swipeTokens.badge.fitsBudgetBg,
  'over-budget': swipeTokens.badge.overBudgetBg,
  estimated: swipeTokens.badge.estimatedBg,
  unknown: color.line,
};

const BADGE_TEXT: Record<CalorieFitKind, string> = {
  'exact-fit': swipeTokens.badge.exactFitText,
  'fits-budget': swipeTokens.badge.fitsBudgetText,
  'over-budget': swipeTokens.badge.overBudgetText,
  estimated: swipeTokens.badge.estimatedText,
  unknown: swipeTokens.badge.neutralText,
};

/**
 * Icons are drawn from the same restrained glyph set the rest of the app uses
 * rather than a new icon dependency. Each one is decorative — the badge's
 * meaning is carried by `accessibilityLabel`, never by the glyph.
 */
const BADGE_GLYPH: Record<CalorieFitKind, string> = {
  'exact-fit': '◎',
  'fits-budget': '✓',
  'over-budget': '↑',
  estimated: '~',
  unknown: '·',
};

export function MealSwipeCard({
  meal,
  translateX,
  cardWidth,
  remainingCalories,
  pantryStatus,
  isTopCard,
  provenance,
  cuisine,
  budget,
  elevationLevel,
  onHandCanonicalIds,
}: Props) {
  const cookOpacity = useDerivedValue(() =>
    interpolate(translateX.value, [0, cardWidth * STAMP_FULL_AT], [0, 1], Extrapolation.CLAMP),
  );
  const passOpacity = useDerivedValue(() =>
    interpolate(translateX.value, [0, -(cardWidth * STAMP_FULL_AT)], [0, 1], Extrapolation.CLAMP),
  );
  const cookStyle = useAnimatedStyle(() => ({ opacity: cookOpacity.value }));
  const passStyle = useAnimatedStyle(() => ({ opacity: passOpacity.value }));

  const estimated = provenance
    ? provenance.estimated
    : meal.missing.length > 0 || !meal.estimatedNutritionPerServing;
  const fit = calorieFit({
    mealCalories: meal.kcalPerServing,
    remainingCalories: remainingCalories ?? budget?.remainingCalories ?? null,
    estimated,
  });
  const nutrition = meal.estimatedNutritionPerServing ?? null;
  const speed = prepSpeed(meal.effortMinutes);
  const label = cuisine === undefined ? detectCuisine(meal.dish) : cuisine;
  const pantry = pantryStatus ?? pantryStatusFor(meal, onHandCanonicalIds);
  const coverage = pantryCoverage(pantry.held, pantry.total);
  const depth = elevationLevel ?? (isTopCard === false ? 1 : 3);
  const badgeFill = BADGE_FILL[fit.kind];
  const badgeText = BADGE_TEXT[fit.kind];

  return (
    <View
      style={[styles.card, cardShadowStyle(depth)]}
      accessible
      accessibilityLabel={`${meal.dish}. ${fit.accessibilityLabel}.`}
      accessibilityHint="Swipe right to cook, swipe left to pass"
    >
      <View style={styles.topRow}>
        {label === null ? (
          <View style={styles.pillPlaceholder} />
        ) : (
          <View style={styles.cuisinePill}>
            <Caption style={styles.cuisineText}>{label}</Caption>
          </View>
        )}
        <View style={styles.prep} accessibilityLabel={`${PREP_SPEED_LABELS[speed]} to make`}>
          <Caption muted={speed === 'slow'} style={speed === 'quick' ? styles.prepQuick : undefined}>
            ◷ {PREP_SPEED_LABELS[speed]}
          </Caption>
        </View>
      </View>

      <View style={styles.middle}>
        <ScreenTitle numberOfLines={2} ellipsizeMode="tail">
          {meal.dish}
        </ScreenTitle>
        <View style={styles.macroRow}>
          <MacroChip label="Protein" grams={nutrition?.proteinG ?? null} dot={macroColor.protein} />
          <MacroChip label="Carbs" grams={nutrition?.carbsG ?? null} dot={macroColor.carbs} />
          <MacroChip label="Fat" grams={nutrition?.fatG ?? null} dot={macroColor.fat} />
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View
          style={[styles.fitBadge, { backgroundColor: badgeFill }]}
          accessibilityLabel={fit.accessibilityLabel}
        >
          <Caption style={{ color: badgeText }}>
            {BADGE_GLYPH[fit.kind]} {fit.calorieLabel} · {fit.label}
          </Caption>
        </View>
        <View
          style={styles.pantryBadge}
          accessibilityLabel={pantryAccessibilityLabel(pantry.held, pantry.total)}
        >
          <Caption style={coverage === 'full' ? styles.pantryFull : styles.pantryLow}>
            {pantryLabel(pantry.held, pantry.total)}
          </Caption>
        </View>
      </View>

      <View pointerEvents="none" style={styles.overlay} importantForAccessibility="no-hide-descendants">
        <Animated.Text style={[styles.stamp, styles.cookStamp, cookStyle]}>COOK</Animated.Text>
        <Animated.Text style={[styles.stamp, styles.passStamp, passStyle]}>PASS</Animated.Text>
      </View>
    </View>
  );
}

function MacroChip({ label, grams, dot }: { label: string; grams: number | null; dot: string }) {
  const value = grams === null || !Number.isFinite(grams) ? '—' : `${Math.round(grams)}g`;
  return (
    <View style={styles.macroChip} accessibilityLabel={`${label} ${grams === null ? 'unknown' : value}`}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Caption>
        {value} {label}
      </Caption>
    </View>
  );
}

const STAMP_SIZE = swipeTokens.overlay.stampFontSize;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderRadius: swipeTokens.card.borderRadius,
    padding: space.lg,
    justifyContent: 'space-between',
    gap: space.base,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  // Reserves the pill's height so a card with no cuisine does not shift.
  pillPlaceholder: { minHeight: space.lg },
  cuisinePill: {
    flexShrink: 1,
    borderRadius: radius.full,
    backgroundColor: color.ground,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  cuisineText: {
    fontFamily: font.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prep: { paddingVertical: space.xs },
  prepQuick: { color: swipeTokens.overlay.cookColor },
  // Takes the slack so a one-word dish name never leaves a gap above the badges.
  middle: { flex: 1, justifyContent: 'center', gap: space.base },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.card - space.xs,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  dot: { width: space.md, height: space.md, borderRadius: radius.full },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
  fitBadge: {
    flexShrink: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  pantryBadge: {
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  pantryFull: { color: swipeTokens.badge.exactFitBg },
  pantryLow: { color: swipeTokens.badge.estimatedBg },
  overlay: { ...fillParent },
  stamp: {
    position: 'absolute',
    top: space.xl,
    fontFamily: font.semibold,
    fontSize: STAMP_SIZE,
    fontWeight: swipeTokens.overlay.stampFontWeight,
    letterSpacing: STAMP_SIZE * swipeTokens.overlay.stampLetterSpacing,
    borderWidth: swipeTokens.a11y.focusRingWidth,
    borderRadius: radius.input,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  cookStamp: {
    left: space.lg,
    color: swipeTokens.overlay.cookColor,
    borderColor: swipeTokens.overlay.cookColor,
    transform: [{ rotate: `-${swipeTokens.motion.exitRotationDeg}deg` }],
  },
  passStamp: {
    right: space.lg,
    color: swipeTokens.overlay.passColor,
    borderColor: swipeTokens.overlay.passColor,
    transform: [{ rotate: `${swipeTokens.motion.exitRotationDeg}deg` }],
  },
});
