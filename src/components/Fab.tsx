import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { color, elevation, opacity, radius, space } from '@/constants/theme';

interface Props {
  onPress: () => void;
  onSecondary: () => void;
  onLongPress?: () => void;
  longPressHint?: string;
}

const SIZE = 64;

/**
 * Camera on tap, with a caller-defined long press and manual-entry shortcut.
 * The FAB is the only pill-shaped thing in the app.
 */
export function Fab({ onPress, onSecondary, onLongPress, longPressHint }: Props) {
  return (
    <View style={styles.group}>
      <Pressable
        onPress={onSecondary}
        accessibilityRole="button"
        accessibilityLabel="Enter a meal by hand"
        style={({ pressed }) => [
          styles.secondary,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <Feather name="edit-3" size={18} color={color.ink} />
      </Pressable>

      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onLongPress={onLongPress ?? onSecondary}
        accessibilityRole="button"
        accessibilityLabel="Photograph a meal"
        accessibilityHint={longPressHint ?? 'Long press to enter a meal by hand'}
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <Feather name="camera" size={26} color={color.onAction} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignItems: 'center', gap: space.md },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    backgroundColor: color.action,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation,
  },
  secondary: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
