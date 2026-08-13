import { Button, type ButtonVariant } from '@/components/Button';

interface Props {
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
}

/** Shared wording and accessibility contract for user-owned edit affordances. */
export function EditAction({ onPress, disabled = false, variant = 'secondary' }: Props) {
  return (
    <Button
      label="Edit item"
      variant={variant}
      onPress={onPress}
      disabled={disabled}
      accessibilityHint="Change the values you entered for this item"
    />
  );
}
