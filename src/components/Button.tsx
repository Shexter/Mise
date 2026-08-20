import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { ButtonLabel, Caption } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface Props {
  label: string;
  /**
   * One quiet line under the label, for an action whose name cannot carry
   * the whole explanation on its own. It stacks the button's content, so
   * keep it to a short phrase rather than a sentence.
   */
  detail?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Fills the available width. Primary actions usually do. */
  block?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

export function Button({
  label,
  detail,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  block = true,
  style,
  accessibilityHint,
}: Props) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? detail}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        detail && styles.stacked,
        variantStyles[variant],
        block && styles.block,
        pressed && !inactive && { opacity: opacity.pressed },
        inactive && { opacity: opacity.disabled },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant]} />
      ) : (
        <View style={styles.labels}>
          <ButtonLabel style={{ color: labelColor[variant] }}>{label}</ButtonLabel>
          {detail ? (
            // Hidden from assistive technology because it is already the
            // button's hint; announcing it twice is noise.
            <Caption
              muted={variant !== 'primary'}
              importantForAccessibility="no"
              style={[styles.detail, variant === 'primary' && { color: color.onAction }]}
            >
              {detail}
            </Caption>
          ) : null}
        </View>
      )}
      {/* Keeps the row height stable between the label and spinner states. */}
      <View style={styles.spacer} />
    </Pressable>
  );
}

const labelColor: Record<ButtonVariant, string> = {
  primary: color.onAction,
  secondary: color.ink,
  ghost: color.ink,
  destructive: color.paprika,
};

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  block: { alignSelf: 'stretch' },
  /** A detail line needs the row to grow rather than clip at the touch target. */
  stacked: { paddingVertical: space.base },
  labels: { alignItems: 'center', gap: space.xs },
  detail: { textAlign: 'center' },
  spacer: { width: 0 },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: color.action },
  secondary: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  ghost: { backgroundColor: 'transparent' },
  destructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.line,
  },
};
