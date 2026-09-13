import { Pressable, StyleSheet, View } from 'react-native';

import { RowTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import type { TodayPage } from '@/logic/todayRoute';

interface Props {
  page: TodayPage;
  onSelect: (page: TodayPage) => void;
}

/**
 * The two tasks Today holds, always in the same place.
 *
 * The labels are exactly `Meal plan` and `Calories`. Not "Nutrition": this page
 * shows the energy and four nutrients the app can defend from logged meals, and
 * a label may not promise more than the data behind it.
 *
 * It lives outside both pages' scroll views, so a populated week never buries
 * the way back to the day's calories. Selection is carried by a rule and by
 * type weight as well as colour, and each tab announces its selected state, so
 * it survives a monochrome rendering and a screen reader alike.
 */
export function TodayTaskSelector({ page, onSelect }: Props) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {([
        ['meal-plan', 'Meal plan'],
        ['calories', 'Calories'],
      ] as const).map(([value, label]) => {
        const selected = page === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.tab, pressed && { opacity: opacity.pressed }]}
          >
            <RowTitle style={selected ? styles.selectedLabel : styles.label}>{label}</RowTitle>
            <View style={[styles.rule, selected && styles.ruleSelected]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: layout.screenGutter,
    backgroundColor: color.ground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  // Each tab takes half the bar and centres its label, so the pair reads as one
  // control rather than two links that happen to sit beside each other.
  tab: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: space.sm,
    gap: space.sm,
  },
  label: { color: color.muted },
  selectedLabel: { color: color.ink },
  // Drawn under both tabs at zero contrast so the selected rule does not change
  // the bar's height when the selection moves, and enlarged text cannot make
  // one tab taller than the other.
  rule: { height: 2, alignSelf: 'stretch', backgroundColor: 'transparent' },
  ruleSelected: { backgroundColor: color.action },
});
