import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { RowTitle } from '@/components/Type';
import { color, elevation, opacity, radius, space } from '@/constants/theme';

interface Props {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}

const SIZE = 120;

/**
 * The one dominant control on the voice intake screen — same circular
 * language as `Fab.tsx`, sized up because here it stands alone rather than
 * sharing space with a secondary action.
 */
export function MicButton({ label, icon, onPress, disabled = false, accessibilityHint }: Props) {
  return (
    <View style={styles.group}>
      <Pressable
        onPress={() => {
          if (disabled) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.circle,
          disabled && { opacity: opacity.disabled },
          pressed && !disabled && { opacity: opacity.pressed },
        ]}
      >
        <Feather name={icon} size={44} color={color.onAction} />
      </Pressable>
      <RowTitle>{label}</RowTitle>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignItems: 'center', gap: space.sm },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    backgroundColor: color.action,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation,
  },
});
