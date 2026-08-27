import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { getRecentAndFavoriteMeals, type QuickRelogMeal } from '@/db/queries';
import { friendlyDate } from '@/logic/dates';
import type { QuickRelogVenue } from '@/logic/mealCloning';
import { macrosOfItems, roundCalories } from '@/logic/scaling';
import type { MealWithItems } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (meal: MealWithItems, venue: QuickRelogVenue) => void;
}

export function RecentMealsSheet({ visible, onClose, onSelect }: Props) {
  const [entries, setEntries] = useState<QuickRelogMeal[]>([]);
  const [selected, setSelected] = useState<QuickRelogMeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setSelected(null);
    setLoading(true);
    setFailed(false);
    void getRecentAndFavoriteMeals()
      .then((items) => {
        if (active) setEntries(items);
      })
      .catch(() => {
        if (active) {
          setEntries([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const choose = (venue: QuickRelogVenue) => {
    if (selected) onSelect(selected.meal, venue);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Recent & favorites"
    >
      {selected ? (
        <View style={styles.choice}>
          <MealSummary entry={selected} />
          <Body>How are you having this meal?</Body>
          <Button
            label="Leftovers"
            detail="Log nutrition without using pantry stock again"
            onPress={() => choose('leftovers')}
          />
          <Button
            label="Cooked again"
            detail="Log this as a fresh cook and review pantry use"
            variant="secondary"
            onPress={() => choose('home')}
          />
          <Button label="Choose another meal" variant="ghost" onPress={() => setSelected(null)} />
        </View>
      ) : loading ? (
        <Caption muted>Loading your meals…</Caption>
      ) : failed ? (
        <View style={styles.choice}>
          <Body>Recent meals could not be loaded.</Body>
          <Caption muted>Close this sheet and try again.</Caption>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.choice}>
          <Body>No recent meals yet</Body>
          <Caption muted>Meals from the last 14 days and starred meals will appear here.</Caption>
        </View>
      ) : (
        <Card padded={false}>
          {entries.map((entry, index) => {
            const totals = macrosOfItems(entry.meal.items);
            const calories = totals.calories === null ? 'calories unknown' : `${roundCalories(totals.calories)} kcal`;
            return (
              <View key={entry.meal.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => setSelected(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.meal.name}, ${calories}${entry.isFavorite ? ', favorite' : ''}`}
                  accessibilityHint="Choose whether to log as leftovers or cooked again"
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <View style={styles.copy}>
                    <View style={styles.titleRow}>
                      <RowTitle>{entry.meal.name}</RowTitle>
                      {entry.isFavorite ? (
                        <Feather name="star" size={16} color={color.action} />
                      ) : null}
                    </View>
                    <Caption muted numeric>
                      {calories} · {friendlyDate(entry.meal.localDate)}
                      {entry.timesLogged > 1 ? ` · ${entry.timesLogged} times recently` : ''}
                    </Caption>
                  </View>
                  <Feather name="chevron-right" size={18} color={color.muted} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}
    </Sheet>
  );
}

function MealSummary({ entry }: { entry: QuickRelogMeal }) {
  const totals = macrosOfItems(entry.meal.items);
  return (
    <Card>
      <View style={styles.titleRow}>
        <RowTitle>{entry.meal.name}</RowTitle>
        {entry.isFavorite ? <Feather name="star" size={16} color={color.action} /> : null}
      </View>
      <Caption muted numeric>
        {totals.calories === null ? 'Calories unknown' : `${roundCalories(totals.calories)} kcal`}
      </Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  copy: { flex: 1, gap: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  choice: { gap: space.base },
});
