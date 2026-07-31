import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Hatch } from '@/components/Hatch';
import { Caption } from '@/components/Type';
import {
  color,
  duration,
  fillParent,
  layout,
  macroColor,
  radius,
} from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { macrosOfItems, roundCalories } from '@/logic/scaling';
import type { MealWithItems } from '@/types';

/**
 * The Day Rail.
 *
 * One bar, the width of the day's target. Each meal is a segment sized by its
 * calories and filled with its own photograph. It carries the scalar and the
 * composition of the day at once, and doubles as a visual index of what was
 * eaten — which a ring cannot do.
 */

const SEGMENT_GAP = 2;
/** Fixed width of the hatched overage segment when the day goes over target. */
const OVERAGE_WIDTH = 28;

interface Props {
  meals: readonly MealWithItems[];
  targetCalories: number;
  /** Segment to animate in — the meal that was just saved. */
  highlightMealId?: string | null;
  onSelectMeal?: (mealId: string) => void;
}

interface Segment {
  meal: MealWithItems;
  calories: number;
  width: number;
}

export function DayRail({
  meals,
  targetCalories,
  highlightMealId = null,
  onSelectMeal,
}: Props) {
  const [railWidth, setRailWidth] = useState(0);

  const perMeal = meals.map((meal) => ({
    meal,
    calories: macrosOfItems(meal.items).calories,
  }));
  const consumed = perMeal.reduce((sum, entry) => sum + entry.calories, 0);
  const isOver = consumed > targetCalories && targetCalories > 0;

  const usableWidth = Math.max(0, railWidth - (isOver ? OVERAGE_WIDTH : 0));
  const scaleBasis = isOver ? consumed : targetCalories;
  const gapTotal = Math.max(0, perMeal.length - 1) * SEGMENT_GAP;

  const segments: Segment[] =
    railWidth === 0 || scaleBasis <= 0
      ? []
      : perMeal.map((entry) => ({
          ...entry,
          width: Math.max(
            0,
            (entry.calories / scaleBasis) * (usableWidth - gapTotal),
          ),
        }));

  const consumedWidth =
    segments.reduce((sum, segment) => sum + segment.width, 0) + gapTotal;
  const remainder = Math.max(0, usableWidth - consumedWidth);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={railLabel(consumed, targetCalories, meals.length)}
      style={styles.rail}
      onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
    >
      {meals.length === 0 ? (
        <View style={styles.empty}>
          <Caption muted>Your day starts with the first photo.</Caption>
        </View>
      ) : (
        <View style={styles.track}>
          {segments.map((segment, index) => (
            <RailSegment
              key={segment.meal.id}
              segment={segment}
              isLast={index === segments.length - 1}
              animate={segment.meal.id === highlightMealId}
              onPress={onSelectMeal}
            />
          ))}
          {remainder > 0 ? (
            <View style={[styles.remainder, { width: remainder }]} />
          ) : null}
          {isOver ? (
            <View style={styles.overage}>
              <Hatch width={OVERAGE_WIDTH} height={layout.dayRailHeight} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

interface SegmentProps {
  segment: Segment;
  isLast: boolean;
  animate: boolean;
  onPress?: (mealId: string) => void;
}

function RailSegment({ segment, isLast, animate, onPress }: SegmentProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    progress.value = reduceMotion
      ? withTiming(1, { duration: duration.reduced })
      : withSpring(1, { damping: 18, stiffness: 140 });
  }, [animate, progress, reduceMotion]);

  // RN scales about the centre; the two translations move the origin to the
  // left edge so the segment grows outward the way the spec describes.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -segment.width / 2 },
      { scaleX: progress.value },
      { translateX: segment.width / 2 },
    ],
    opacity: reduceMotion ? progress.value : 1,
  }));

  const dominant = dominantMacroColor(segment.meal);

  return (
    <Animated.View
      style={[
        styles.segment,
        { width: segment.width, marginRight: isLast ? 0 : SEGMENT_GAP },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={() => onPress?.(segment.meal.id)}
        accessibilityRole="button"
        accessibilityLabel={`${segment.meal.name}, ${roundCalories(
          segment.calories,
        )} calories`}
        style={styles.segmentPressable}
      >
        {segment.meal.photoUri ? (
          <>
            <Image
              source={{ uri: segment.meal.photoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {/* True desaturation needs a native filter, which Expo Go cannot
                load. A warm scrim plus the ink overlay gets the bar reading as
                one object rather than a photo collage. */}
            <View style={styles.scrim} />
            <View style={styles.inkOverlay} />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: dominant }]} />
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Manual entries have no photo, so they take the colour of their largest macro. */
function dominantMacroColor(meal: MealWithItems): string {
  const macros = macrosOfItems(meal.items);
  const byCalories = [
    { color: macroColor.protein, value: macros.proteinG * 4 },
    { color: macroColor.carbs, value: macros.carbsG * 4 },
    { color: macroColor.fat, value: macros.fatG * 9 },
  ];
  return byCalories.reduce((best, entry) =>
    entry.value > best.value ? entry : best,
  ).color;
}

function railLabel(
  consumed: number,
  target: number,
  mealCount: number,
): string {
  if (mealCount === 0) return 'Nothing logged yet';
  const suffix = mealCount === 1 ? '1 meal' : `${mealCount} meals`;
  return `${roundCalories(consumed)} of ${target} calories, ${suffix}`;
}

const styles = StyleSheet.create({
  rail: {
    height: layout.dayRailHeight,
    borderRadius: radius.card,
    backgroundColor: color.ground,
    overflow: 'hidden',
  },
  track: { flex: 1, flexDirection: 'row' },
  segment: { height: '100%', overflow: 'hidden' },
  segmentPressable: { flex: 1 },
  scrim: { ...fillParent, backgroundColor: color.ground, opacity: 0.32 },
  inkOverlay: { ...fillParent, backgroundColor: color.ink, opacity: 0.15 },
  remainder: {
    height: '100%',
    backgroundColor: color.ground,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
  },
  overage: { width: OVERAGE_WIDTH, height: '100%' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
  },
});
