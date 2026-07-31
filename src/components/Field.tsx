import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ViewStyle,
} from 'react-native';

import { Caption, SectionLabel } from '@/components/Type';
import {
  color,
  layout,
  radius,
  space,
  tabularNums,
  type,
} from '@/constants/theme';

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Shown under the field in the caption role. */
  hint?: string;
  /** Shown under the field in place of the hint, in paprika. */
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Right-hand unit or suffix, e.g. "kg". */
  suffix?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  numeric?: boolean;
  maxLength?: number;
  style?: ViewStyle;
  onSubmitEditing?: () => void;
}

export function Field({
  value,
  onChangeText,
  label,
  placeholder,
  hint,
  error,
  keyboardType,
  suffix,
  multiline = false,
  autoFocus = false,
  secureTextEntry = false,
  numeric = false,
  maxLength,
  style,
  onSubmitEditing,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={style}>
      {label ? (
        <SectionLabel muted style={styles.label}>
          {label}
        </SectionLabel>
      ) : null}
      <View
        style={[
          styles.box,
          focused && styles.boxFocused,
          error !== undefined && styles.boxError,
          multiline && styles.boxMultiline,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.muted}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          secureTextEntry={secureTextEntry}
          autoCapitalize={secureTextEntry ? 'none' : 'sentences'}
          autoCorrect={!secureTextEntry}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={label}
          style={[styles.input, numeric && tabularNums]}
        />
        {suffix ? (
          <Caption muted style={styles.suffix}>
            {suffix}
          </Caption>
        ) : null}
      </View>
      {error !== undefined ? (
        <Caption style={styles.error}>{error}</Caption>
      ) : hint ? (
        <Caption muted style={styles.hint}>
          {hint}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: space.sm, marginLeft: space.xs },
  box: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.input,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.base,
    flexDirection: 'row',
    alignItems: 'center',
  },
  boxFocused: { borderColor: color.ink },
  boxError: { borderColor: color.paprika },
  boxMultiline: { minHeight: 96, alignItems: 'flex-start', paddingVertical: space.md },
  input: {
    flex: 1,
    ...type.body,
    color: color.ink,
    paddingVertical: space.md,
  },
  suffix: { marginLeft: space.sm },
  hint: { marginTop: space.sm, marginLeft: space.xs },
  error: { marginTop: space.sm, marginLeft: space.xs, color: color.paprika },
});
