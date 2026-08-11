import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasApiKey } from '@/api/keyStore';
import { Card } from '@/components/Card';
import { CountingNumber } from '@/components/CountingNumber';
import { DateStrip } from '@/components/DateStrip';
import { DayRail } from '@/components/DayRail';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { HistoryCalendarSheet } from '@/components/HistoryCalendarSheet';
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
    loggedDateSet,
    earliestLoggedDate,
    loadMonthSummaries,
    selectDate,
    syncToToday,
    resumeFollowing,
    refresh,
    removeMeal,
    undoRemove,
  } = useDayStore();

  const [keyMissing, setKeyMissing] = useState(false);
  const [highlightMealId, setHighlightMealId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // The Today tab opens on today: sync (which resets `selectedDate` only
  // when `following` is true) before refreshing, so a day chosen earlier in
  // this same visit still holds while a stale or day-old context corrects
  // itself. Leaving the tab restores tracking, so the exception is scoped to
  // one continuous visit rather than surviving until explicitly cleared.
  useFocusEffect(
    useCallback(() => {
      void syncToToday().then(() => refresh());
      void hasApiKey().then((present) => setKeyMissing(!present));
      return () => resumeFollowing();
    }, [syncToToday, refresh, resumeFollowing]),
  );

  // Tab focus alone misses the app sitting open on this tab across midnight;
  // foreground alone misses nothing extra but costs nothing to add. Together
  // the stale value has no window to be observed in.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void syncToToday();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [syncToToday]);

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
  const remaining = consumed.calories === null ? null : targetCalories - roundCalories(consumed.calories);
  const isOver = remaining !== null && remaining < 0;

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
            onPress={() => setCalendarOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open meal history calendar"
            style={({ pressed }) => [
              styles.calendarButton,
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <Feather name="calendar" size={20} color={color.ink} />
          </Pressable>
        </View>

        <DateStrip
          selectedDate={selectedDate}
          loggedDates={loggedDateSet}
          earliestLoggedDate={earliestLoggedDate}
          onSelect={(date) => void selectDate(date)}
        />

        <View style={styles.hero}>
          <SectionLabel muted>
            {remaining === null ? 'Calories unavailable' : isOver ? 'Over target' : 'Remaining today'}
          </SectionLabel>
          {remaining === null ? (
            <ScreenTitle>—</ScreenTitle>
          ) : <CountingNumber
            value={Math.abs(remaining)}
            dimmed={isOver}
            accessibilityLabel={isOver ? `${Math.abs(remaining)} calories over target` : `${remaining} calories remaining`}
          />}
          {remaining === null ? (
            <Caption muted>One or more meals have unknown calories.</Caption>
          ) : isOver ? (
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
          onSelectMeal={(mealId) => router.push(`/meal/${mealId}`)}
        />

        {target ? (
          <View style={styles.macros}>
            <MacroBars
              consumed={consumed}
              targetProteinG={target.proteinG}
              targetCarbsG={target.carbsG}
              targetFatG={target.fatG}
              targetFibreG={target.fibreG}
              onRequest={(macro) => router.push({ pathname: '/dinner', params: { macro } })}
            />
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push('/dinner')}
          accessibilityRole="button"
          accessibilityLabel="What's for dinner?"
          style={({ pressed }) => [styles.banner, pressed && { opacity: opacity.pressed }]}
        >
          <Body>What's for dinner?</Body>
          <Caption muted>Ideas from what's already in your pantry.</Caption>
        </Pressable>

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
                    onPress={(mealId) => router.push(`/meal/${mealId}`)}
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

      <HistoryCalendarSheet
        visible={calendarOpen}
        selectedDate={selectedDate}
        earliestLoggedDate={earliestLoggedDate}
        loggedDates={loggedDateSet}
        loadSummaries={loadMonthSummaries}
        onSelect={(date) => void selectDate(date)}
        onClose={() => setCalendarOpen(false)}
      />
    </View>
  );
}

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
  calendarButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
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
