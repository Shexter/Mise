import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { color, tabularNums, type } from '@/constants/theme';

/**
 * The only place text styles are constructed. Every component composes these
 * rather than reaching for `type` directly, so a role can never drift.
 */

interface Props extends TextProps {
  /** Secondary colour for captions, units, timestamps. */
  muted?: boolean;
  /** Applies tabular figures. On by default for the numeric roles. */
  numeric?: boolean;
  /** Renders in ink at reduced opacity — used for going over target. */
  dimmed?: boolean;
}

function make(role: TextStyle, defaults: { numeric?: boolean } = {}) {
  return function Styled({
    style,
    muted,
    numeric = defaults.numeric ?? false,
    dimmed,
    ...rest
  }: Props) {
    return (
      <RNText
        {...rest}
        style={[
          role,
          { color: muted ? color.muted : color.ink },
          numeric && tabularNums,
          dimmed && { opacity: 0.55 },
          style,
        ]}
      />
    );
  };
}

/** The remaining-calorie figure, and nothing smaller. */
export const Hero = make(type.hero as TextStyle, { numeric: true });

/** Per-meal calorie totals and the onboarding reveal. */
export const MealCalories = make(type.mealCalories as TextStyle, {
  numeric: true,
});

export const ScreenTitle = make(type.screenTitle as TextStyle);
export const SectionLabel = make(type.sectionLabel as TextStyle);
export const Body = make(type.body as TextStyle);
export const RowTitle = make(type.rowTitle as TextStyle);
export const Caption = make(type.caption as TextStyle);
export const ButtonLabel = make(type.button as TextStyle);
