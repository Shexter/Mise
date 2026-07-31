import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { color, elevation, opacity, radius, space } from '@/constants/theme';

interface Props {
  onPress: () => void;
  onSecondary: () => void;
}

const SIZE = 64;

/**
 * Camera on tap, manual entry on long-press or via the small secondary button.
 * The FAB is the only pill-shaped thing in the app.
 */
export function Fab({ onPress, onSecondary }: Props) {
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
        onLongPress={onSecondary}
        accessibilityRole="button"
        accessibilityLabel="Photograph a meal"
        accessibilityHint="Long press to enter a meal by hand"
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <Feather name="camera" size={26} color={color.surface} />
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
    backgroundColor: color.ink,
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
