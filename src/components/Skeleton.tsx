import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { color, duration, radius, space } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type SkeletonVariant = 'box' | 'circle' | 'line' | 'text';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
  style?: ViewStyle;
  /** Makes placeholders legible over a live camera frame. */
  onDark?: boolean;
}

/**
 * A quiet loading primitive. Opacity is animated on the UI thread, while
 * reduced motion keeps the same layout and removes the animation entirely.
 */
export function Skeleton({
  variant = 'box',
  width = '100%',
  height,
  radius: radiusOverride,
  style,
  onDark = false,
}: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0.62);
  const defaultHeight = variant === 'text' ? space.base : variant === 'line' ? space.sm : space.base;
  const defaultRadius = variant === 'circle' ? radius.full : radiusOverride ?? radius.input;

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.72;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: duration.quick * 2 }),
      -1,
      true,
    );
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no"
      style={[
        styles.base,
        {
          width,
          height: height ?? defaultHeight,
          borderRadius: defaultRadius,
          backgroundColor: onDark ? color.surface : color.line,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonLine({ width = '100%', ...props }: Omit<SkeletonProps, 'variant'>) {
  return <Skeleton {...props} variant="line" width={width} />;
}

export function SkeletonText({ width = '72%', ...props }: Omit<SkeletonProps, 'variant'>) {
  return <Skeleton {...props} variant="text" width={width} />;
}

export function SkeletonCircle({ size = space.xl, ...props }: Omit<SkeletonProps, 'variant' | 'width' | 'height'> & { size?: number }) {
  return <Skeleton {...props} variant="circle" width={size} height={size} />;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});

export { space };
