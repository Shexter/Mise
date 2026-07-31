import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, layout, space } from '@/constants/theme';

interface Props {
  children?: ReactNode;
  /** Wraps the content in a scroll view. Off for screens that own their list. */
  scroll?: boolean;
  /** Applies the 20px screen gutter. */
  gutter?: boolean;
  /** Pinned to the bottom, outside the scroll area. */
  footer?: ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/**
 * Safe-area insets, the ground background, and keyboard avoidance — the three
 * things every screen needs and none should re-derive.
 */
export function Screen({
  children,
  scroll = false,
  gutter = true,
  footer,
  style,
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const padding = gutter ? { paddingHorizontal: layout.screenGutter } : null;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        padding,
        { paddingBottom: space.xl },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, contentStyle]}>{children}</View>
  );

  return (
    <View
      style={[
        styles.flex,
        styles.ground,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
        style,
      ]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        {body}
        {footer ? (
          <View style={[styles.footer, gutter && padding]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ground: { backgroundColor: color.ground },
  footer: { paddingTop: space.base, paddingBottom: space.sm },
});
