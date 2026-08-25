import { View, StyleSheet } from 'react-native';

import { Segmented } from '@/components/Choice';
import { Caption, SectionLabel } from '@/components/Type';
import { space } from '@/constants/theme';
import {
  SERVINGS_MULTIPLIERS,
  pantryDepletionEnabled,
  transitionMealType,
  transitionMealVenue,
  transitionServingsMultiplier,
  type MealModifierState,
} from '@/logic/mealModifiers';
import { MEAL_TYPES, MEAL_VENUES } from '@/types';
import type { MealType, MealVenue } from '@/types';

const MEAL_TYPE_OPTIONS = MEAL_TYPES.map((type) => ({
  value: type,
  label: type.charAt(0).toUpperCase() + type.slice(1),
}));

const VENUE_LABELS: Record<MealVenue, string> = {
  home: 'Home',
  out: 'Out',
  leftovers: 'Leftovers',
};

const VENUE_OPTIONS = MEAL_VENUES.map((venue) => ({
  value: venue,
  label: VENUE_LABELS[venue],
}));

const SERVINGS_OPTIONS = SERVINGS_MULTIPLIERS.map((servings) => ({
  value: String(servings),
  label: `${servings}x`,
}));

interface Props {
  value: MealModifierState;
  onChange: (value: MealModifierState) => void;
  onVenueChange?: (venue: MealVenue) => void;
}

export function MealModifierControls({ value, onChange, onVenueChange }: Props) {
  return (
    <View style={styles.group}>
      <View style={styles.control}>
        <SectionLabel muted style={styles.label}>Meal type</SectionLabel>
        <Segmented
          options={MEAL_TYPE_OPTIONS}
          value={value.mealType}
          onChange={(mealType: MealType) => onChange(transitionMealType(value, mealType))}
        />
      </View>

      <View style={styles.control}>
        <SectionLabel muted style={styles.label}>Venue</SectionLabel>
        <Segmented
          options={VENUE_OPTIONS}
          value={value.venue}
          onChange={(venue) => {
            onVenueChange?.(venue);
            onChange(transitionMealVenue(value, venue));
          }}
        />
      </View>

      <View style={styles.control}>
        <SectionLabel muted style={styles.label}>Servings made</SectionLabel>
        {pantryDepletionEnabled(value.venue) ? (
          <Segmented
            options={SERVINGS_OPTIONS}
            value={String(value.servingsMult)}
            onChange={(servings) => {
              onChange(transitionServingsMultiplier(value, Number(servings)));
            }}
          />
        ) : (
          <View accessibilityRole="text" style={styles.locked}>
            <Caption muted>
              1x locked — non-home meals never use pantry stock.
            </Caption>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.base },
  control: { gap: space.sm },
  label: { marginLeft: space.xs },
  locked: { minHeight: 36, justifyContent: 'center', paddingHorizontal: space.sm },
});
