import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasApiKey } from '@/api/keyStore';
import { Card } from '@/components/Card';
import { CountingNumber } from '@/components/CountingNumber';
import { DateStrip } from '@/components/DateStrip';
import { DayRail } from '@/components/DayRail';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { MacroBars } from '@/components/MacroBars';
import { MealRow } from '@/components/MealRow';
import { Body, Caption, ScreenTitle, SectionLabel } from '@/components/Type';
import { useToast } from '@/components/Toast';
import {
  color,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';
import { friendlyDate, isToday } from '@/logic/dates';
import { roundCalories } from '@/logic/scaling';
import { useDayStore } from '@/store/dayStore';

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ savedMealId?: string }>();

  const {
    selectedDate,
    loading,
    meals,
    target,
    consumed,
    loggedDates,
    selectDate,
    refresh,
    removeMeal,
    undoRemove,
  } = useDayStore();

  const [keyMissing, setKeyMissing] = useState(false);
  const [highlightMealId, setHighlightMealId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void hasApiKey().then((present) => setKeyMissing(!present));
    }, [refresh]),
  );

  // A meal saved from the review flow arrives as a route param; highlight its
  // new segment for the entering animation, then clear so revisits don't replay.
  useEffect(() => {
    if (params.savedMealId) {
      setHighlightMealId(params.savedMealId);
      const timer = setTimeout(() => setHighlightMealId(null), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [params.savedMealId]);

  const targetCalories = target?.targetCalories ?? 0;
  const remaining = targetCalories - roundCalories(consumed.calories);
  const isOver = remaining < 0;

  const onDelete = (mealId: string) => {
    void removeMeal(mealId);
    toast.show({
      message: 'Meal removed.',
      actionLabel: 'Undo',
      onAction: () => void undoRemove(),
      durationMs: 5_000,
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: space.xxxl * 2 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ScreenTitle>{friendlyDate(selectedDate)}</ScreenTitle>
          <Pressable
            onPress={() => router.push('/debug/tokens')}
            onLongPress={() => router.push('/debug/tokens')}
            accessibilityRole="button"
            accessibilityLabel="Design tokens"
            style={styles.debugDot}
          />
        </View>

        <DateStrip
          selectedDate={selectedDate}
          loggedDates={loggedDates}
          onSelect={(date) => void selectDate(date)}
        />

        <View style={styles.hero}>
          <SectionLabel muted>
            {isOver ? 'Over target' : 'Remaining today'}
          </SectionLabel>
          <CountingNumber
            value={Math.abs(remaining)}
            dimmed={isOver}
            accessibilityLabel={
              isOver
                ? `${Math.abs(remaining)} calories over target`
                : `${remaining} calories remaining`
            }
          />
          {isOver ? (
            <Caption muted numeric>
              {Math.abs(remaining)} over — a fact, not a verdict.
            </Caption>
          ) : (
            <Caption muted numeric>
              of {targetCalories} target
            </Caption>
          )}
        </View>

        <DayRail
          meals={meals}
          targetCalories={targetCalories}
          highlightMealId={highlightMealId}
          onSelectMeal={(mealId) => scrollToMeal(mealId)}
        />

        {target ? (
          <View style={styles.macros}>
            <MacroBars
              consumed={consumed}
              targetProteinG={target.proteinG}
              targetCarbsG={target.carbsG}
              targetFatG={target.fatG}
            />
          </View>
        ) : null}

        {keyMissing ? (
          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            accessibilityRole="button"
            accessibilityLabel="No API key set. Open Settings to add one."
            style={({ pressed }) => [
              styles.banner,
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <Body>No API key set. You’re logging by hand.</Body>
            <Caption muted>Add one in Settings for photo estimates.</Caption>
          </Pressable>
        ) : null}

        <View style={styles.list}>
          <SectionLabel muted style={styles.listLabel}>
            {isToday(selectedDate) ? 'Today’s meals' : 'Meals'}
          </SectionLabel>

          {loading && meals.length === 0 ? null : meals.length === 0 ? (
            <Card>
              <EmptyState
                title="Nothing logged yet"
                detail="Photograph your first meal to start the day."
                actionLabel="Take a photo"
                onAction={() => router.push('/capture')}
              />
            </Card>
          ) : (
            <Card padded={false}>
              {meals.map((meal, index) => (
                <View key={meal.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <MealRow
                    meal={meal}
                    onDelete={onDelete}
                    onPress={() => scrollToMeal(meal.id)}
                  />
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <View style={[styles.fab, { bottom: insets.bottom + space.base }]}>
        <Fab
          onPress={() => router.push('/capture')}
          onSecondary={() => router.push('/manual')}
        />
      </View>
    </View>
  );
}

// The rail's tap-to-meal is a nicety; a full scroll-to would need row layout
// measurement. For now, selecting a segment is acknowledged silently — the row
// list is short enough to be on screen already.
function scrollToMeal(_mealId: string): void {}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground },
  content: {
    paddingHorizontal: layout.screenGutter,
    gap: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debugDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: color.line,
  },
  hero: { alignItems: 'center', gap: space.xs },
  macros: {},
  banner: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: layout.cardPadding,
    gap: space.xs,
  },
  list: { gap: space.sm },
  listLabel: { marginLeft: space.xs },
  divider: {
    height: 1,
    backgroundColor: color.line,
    marginLeft: layout.cardPadding + 44 + space.md,
  },
  fab: { position: 'absolute', right: layout.screenGutter },
});
