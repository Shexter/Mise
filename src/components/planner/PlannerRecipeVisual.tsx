import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DishVisual } from '@/components/DishVisual';
import { color } from '@/constants/theme';
import { resolveFoodVisualAccessibility, resolveSizeDimensions, type FoodVisualSize } from '@/media/foodVisuals';
import {
  authoredVisualKey,
  plannerVisualFromSnapshot,
  resolvePlannerRecipeVisual,
  type PlannerRecipeVisualSource,
} from '@/media/plannerRecipeVisuals';
import type { PlannerRecipeSnapshot } from '@/types';

interface Props {
  /** A scheduled meal. Its snapshot carries the identity the art resolves from. */
  snapshot?: PlannerRecipeSnapshot | null;
  /** An unscheduled recipe, described directly. Ignored when `snapshot` is set. */
  source?: PlannerRecipeVisualSource;
  size?: FoodVisualSize;
  /**
   * Screen-reader label. Omit it wherever the recipe name is already adjacent
   * text, and the picture is hidden as decorative — the same rule the food and
   * dish visuals follow.
   */
  alt?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The picture beside a planner recipe, wherever one appears.
 *
 * One component for the picker, the preview, the agenda rows, the cooking guide
 * and Up next, so a dish looks the same everywhere it is mentioned and a
 * failure behaves the same way too. A photo that will not decode, or a bundled
 * asset that is not there, falls through to the next tier rather than leaving a
 * gap — and the row's title and action never depended on the picture anyway.
 */
export function PlannerRecipeVisual({ snapshot, source, size = 'md', alt, style }: Props) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  const identity = snapshot ? plannerVisualFromSnapshot(snapshot, source?.photoUri) : source ?? {};
  const resolved = resolvePlannerRecipeVisual(identity, failed);

  const { dimension } = resolveSizeDimensions(size);
  const a11y = resolveFoodVisualAccessibility(alt);
  const a11yProps = a11y.announced
    ? ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: a11y.label } as const)
    : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);

  if (resolved.kind === 'plate') {
    return (
      <DishVisual
        dish={resolved.title}
        foodClasses={resolved.foodClasses}
        size={size}
        alt={alt}
        style={style}
      />
    );
  }

  const key = resolved.kind === 'photo' ? resolved.uri : authoredVisualKey(resolved.assetId);

  return (
    <View
      style={[
        styles.container,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        style,
      ]}
      {...a11yProps}
    >
      <Image
        source={resolved.kind === 'photo' ? { uri: resolved.uri } : resolved.source}
        style={{ width: dimension, height: dimension }}
        resizeMode="cover"
        onError={() => setFailed((current) => new Set([...current, key]))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // The painted artwork carries its own ivory paper, so the frame behind it
    // matches rather than showing a ring of a different warm tone at the edges.
    backgroundColor: color.surface,
  },
});
