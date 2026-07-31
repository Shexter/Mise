import { StyleSheet, View, type ViewStyle } from 'react-native';

import { color } from '@/constants/theme';

interface Props {
  width: number;
  height: number;
  style?: ViewStyle;
}

const STRIPE_WIDTH = 2;
const STRIPE_GAP = 6;

/**
 * Diagonal hatching, drawn as rotated bars. Used for the overage segment on the
 * Day Rail — the one place the app needs a texture rather than a fill, and not
 * worth an SVG dependency.
 */
export function Hatch({ width, height, style }: Props) {
  const span = width + height;
  const count = Math.ceil(span / (STRIPE_WIDTH + STRIPE_GAP));

  return (
    <View style={[styles.container, { width, height }, style]}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.stripe,
            {
              height: span * 1.5,
              left: index * (STRIPE_WIDTH + STRIPE_GAP) - height,
              top: -span * 0.25,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    width: STRIPE_WIDTH,
    backgroundColor: color.ink,
    opacity: 0.28,
    transform: [{ rotate: '45deg' }],
  },
});
