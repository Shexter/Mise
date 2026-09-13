import { Feather } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { CountingNumber } from '@/components/CountingNumber';
import { DailyTargetSummary } from '@/components/DailyTargetSummary';
import { DateStrip } from '@/components/DateStrip';
import { DayRail } from '@/components/DayRail';
import { HistoryCalendarSheet } from '@/components/HistoryCalendarSheet';
import { MealRow } from '@/components/MealRow';
import { NavCoachMark } from '@/components/NavCoachMark';
import { StateIllustration } from '@/components/StateIllustration';
import { useToast } from '@/components/Toast';
import { Body, Caption, DisplayTitle, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { scrollMemoryKey, useRememberedScroll } from '@/components/today/useRememberedScroll';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { resetDatabase } from '@/db';
import { populateDemoData } from '@/db/demoData';
import {
  getBodyMeasurements,
  getLoggedDates,
  listPendingCaptures,
  listPantryItems,
  listRecipes,
  listReceipts,
} from '@/db/queries';
import { dailyNutritionSummary } from '@/logic/dailyNutritionSummary';
import { friendlyDate, fullDate, isToday, localDateString } from '@/logic/dates';
import { roundCalories } from '@/logic/scaling';
import { deleteAllPhotos } from '@/media/photos';
import { useDayStore } from '@/store/dayStore';
import { useProfileStore } from '@/store/profileStore';
import type { SuggestionTargetMacro } from '@/types';

interface Props {
  /** The meal a save just created, highlighted once on arrival. */
  highlightMealId: string | null;
  /** Whether an API key is configured, for the setup banners below the day. */
  keyMissing: boolean;
  maskedKey: string | null;
}

/**
 * Today's `Calories` page: what was actually eaten on one logged day.
 *
 * The summaries come first, before the contribution rail, the meal history and
 * any setup banner, so opening this page answers "how is today going" without
 * scrolling. Planning content never precedes them — that is the whole reason
 * this page exists separately from `Meal plan`.
 *
 * This page owns the logged date, which keeps its existing refusal of future
 * days. A plan may reach into next week; a meal log may not.
 */
export function CaloriesPage({ highlightMealId, keyMissing, maskedKey }: Props) {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const toast = useToast();

  const {
    selectedDate,
    loading,
    meals,
    target,
    loggedDateSet,
    earliestLoggedDate,
    loadMonthSummaries,
    selectDate,
    removeMeal,
    undoRemove,
  } = useDayStore();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const scroll = useRememberedScroll(scrollMemoryKey('calories', selectedDate));

  const nutritionSummary = dailyNutritionSummary(selectedDate, meals, target);
  const energy = nutritionSummary.metrics.energy;
  const targetCalories = energy.target ?? 0;
  const remaining = energy.knownValue === null || energy.target === null
    ? null
    : energy.target - roundCalories(energy.knownValue);
  const isOver = remaining !== null && remaining < 0;

  // The coach mark floats over the scroll area, so the content has to end
  // above it rather than scroll underneath and be covered.
  const showAddHint = !loading && meals.length === 0;

  const onDelete = (mealId: string) => {
    void removeMeal(mealId);
    toast.show({
      kind: 'success',
      message: 'Meal removed.',
      actionLabel: 'Undo',
      onAction: () => void undoRemove(),
      durationMs: 5_000,
    });
  };

  const onMacroRequest = (macro: SuggestionTargetMacro) =>
    router.push({ pathname: '/dinner', params: { macro } });

  const onLoadDemoData = () => {
    Alert.alert(
      'Replace with rich demo data?',
      'This replaces your current local profile with 57 meals across 28 days (with accurate calories, macros, and fibre trends), 24 pantry items across fridge/freezer/pantry/counter, recipes, categorized shopping list, and body composition data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load demo dataset',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                deleteAllPhotos('meals');
                deleteAllPhotos('receipts');
                deleteAllPhotos('pantry-captures');
                deleteAllPhotos('recipes');
                await resetDatabase();
                const summary = await populateDemoData();
                await useProfileStore.getState().load();
                useDayStore.setState({
                  selectedDate: localDateString(),
                  following: true,
                  monthSummaries: {},
                  pendingUndo: null,
                  lastDepletion: null,
                });
                await useDayStore.getState().refresh();
                router.replace('/(tabs)');
                toast.show({ message: `Demo loaded: ${summary.meals} meals, ${summary.pantryItems} pantry items, ${summary.recipes} recipes, and ${summary.shoppingItems} shopping items.` });
              } catch (error) {
                console.warn('Demo data load failed.', error);
                const detail = error instanceof Error ? error.message : String(error);
                toast.show({ kind: 'recoverable-error', message: `Demo data could not be loaded: ${detail}` });
              }
            })();
          },
        },
      ],
    );
  };

  const onConfirmDemoData = () => {
    Alert.alert(
      'Replace your logged data with demo data?',
      'You already have meals, pantry items, or saved recipes on this device. Loading the demo dataset will replace them — your existing records cannot be recovered from this action.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace with demo',
          style: 'destructive',
          onPress: () => void onLoadDemoData(),
        },
      ],
    );
  };

  const hasExistingUserRecords = async () => {
    try {
      const loggedDates = await getLoggedDates();
      if (loggedDates.length > 0) return true;

      const pantryItems = await listPantryItems();
      if (pantryItems.length > 0) return true;

      const recipes = await listRecipes();
      if (recipes.length > 0) return true;

      const receipts = await listReceipts();
      if (receipts.length > 0) return true;

      const pendingCaptures = await listPendingCaptures();
      if (pendingCaptures.length > 0) return true;

      const bodyMeasurements = await getBodyMeasurements();
      if (bodyMeasurements.length > 0) return true;

      return false;
    } catch (error) {
      console.warn('Failed to check for existing user records:', error);
      return true;
    }
  };

  const onDemoCardPress = () => {
    void (async () => {
      if (await hasExistingUserRecords()) {
        onConfirmDemoData();
      } else {
        onLoadDemoData();
      }
    })();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        onContentSizeChange={scroll.onContentSizeChange}
        scrollEventThrottle={scroll.scrollEventThrottle}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + space.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <DisplayTitle>{friendlyDate(selectedDate)}</DisplayTitle>
            <Caption muted>{fullDate(selectedDate)}</Caption>
          </View>
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

        <View style={styles.rule} />

        <DateStrip
          selectedDate={selectedDate}
          loggedDates={loggedDateSet}
          earliestLoggedDate={earliestLoggedDate}
          onSelect={(date) => void selectDate(date)}
        />

        {/* Energy, then the four nutrients this app can defend, before anything
            else. A populated week used to push all five below the fold; that is
            the ordering decision 201 supersedes. */}
        <Pressable
          style={styles.hero}
          accessibilityRole="button"
          accessibilityHint="Shows which meals contributed to today's energy."
          onPress={() => router.push({ pathname: '/analytics', params: { metric: 'energy', date: selectedDate } })}
        >
          <View style={styles.heroFigure}>
            <SectionLabel style={!isOver && remaining !== null ? styles.heroLabel : undefined}>
              {remaining === null ? 'Calories unavailable' : isOver ? 'Over target' : 'Remaining'}
            </SectionLabel>
            {remaining === null ? (
              <ScreenTitle>—</ScreenTitle>
            ) : (
              <View style={styles.heroNumber}>
                <CountingNumber
                  value={Math.abs(remaining)}
                  dimmed={isOver}
                  tint={isOver ? undefined : color.positive}
                  accessibilityLabel={isOver ? `${Math.abs(remaining)} calories over target` : `${remaining} calories remaining`}
                />
                <Body style={!isOver ? styles.heroLabel : undefined}>kcal</Body>
              </View>
            )}
            {remaining === null ? (
              <Caption muted>One or more meals have unknown calories.</Caption>
            ) : isOver ? (
              <Caption muted numeric>
                A fact, not a verdict.
              </Caption>
            ) : null}
          </View>

          {/* The context column. Target and consumed are the two figures that
              make the headline mean anything, and they belong beside it rather
              than compressed into a caption underneath. */}
          <View style={styles.heroContext}>
            <View style={styles.heroStat}>
              <Caption muted>Daily target</Caption>
              <Body numeric>{target === null ? 'No target' : `${targetCalories} kcal`}</Body>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Caption muted>Consumed</Caption>
              <Body numeric>
                {energy.knownValue === null ? '—' : `${roundCalories(energy.knownValue)} kcal`}
              </Body>
            </View>
          </View>
        </Pressable>

        {target ? (
          <DailyTargetSummary
            summary={nutritionSummary}
            onSelect={(metric) => router.push({ pathname: '/analytics', params: { metric, date: selectedDate } })}
            onRequest={onMacroRequest}
          />
        ) : (
          <Caption muted>
            No daily target is recorded, so these nutrients are shown without one. Set your target in Settings to
            measure a day against it.
          </Caption>
        )}

        <DayRail
          meals={meals}
          targetCalories={targetCalories}
          highlightMealId={highlightMealId}
          onSelectMeal={(mealId) => router.push(`/meal/${mealId}`)}
        />

        {maskedKey === null ? (
          <Pressable
            onPress={onDemoCardPress}
            accessibilityRole="button"
            accessibilityLabel="Discover demo data"
            style={({ pressed }) => [
              styles.banner,
              { backgroundColor: color.tintWheat },
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <View style={styles.bannerText}>
              <RowTitle>First time here? Try a quick demo.</RowTitle>
              <Caption muted>Load a rich dataset with meals, pantry, recipes, and more — no entry required.</Caption>
            </View>
            <Feather name="chevron-right" size={20} color={color.muted} />
          </Pressable>
        ) : null}

        {keyMissing ? (
          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            accessibilityRole="button"
            accessibilityLabel="No API key set. Open Settings to add one."
            style={({ pressed }) => [
              styles.banner,
              { backgroundColor: color.tintBlue },
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <View style={styles.bannerText}>
              <RowTitle>No API key set. You’re logging by hand.</RowTitle>
              <Caption muted>Add one in Settings for photo estimates.</Caption>
            </View>
            <Feather name="chevron-right" size={20} color={color.muted} />
          </Pressable>
        ) : null}

        <View style={styles.list}>
          <ScreenTitle>
            {isToday(selectedDate) ? 'Recent meals' : 'Meals'}
          </ScreenTitle>

          {loading && meals.length === 0 ? null : meals.length === 0 ? (
            // No action here on purpose. The coach mark below points at the
            // one add control the app has; a button in this card would be the
            // second way to do the same thing from the same screen.
            <Card variant="outline">
              <StateIllustration
                name="first-saved-meal"
                accessibilityLabel="A laid place setting, waiting for the day's first meal"
              />
              <Body>Nothing logged yet</Body>
              <Caption muted>Your first meal of the day starts here.</Caption>
            </Card>
          ) : (
            <>
              <Card variant="outline" padded={false}>
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
              <Pressable
                onPress={() => router.push({ pathname: '/analytics', params: { metric: 'energy', date: selectedDate } })}
                accessibilityRole="button"
                accessibilityLabel="See all meals"
                style={({ pressed }) => [
                  styles.seeAll,
                  pressed && { opacity: opacity.pressed },
                ]}
              >
                <Body style={styles.seeAllLabel}>See all meals</Body>
                <Feather name="chevron-right" size={18} color={color.action} />
              </Pressable>
            </>
          )}
        </View>

        {/* The only add affordance on this screen is the one in the
            navigation. When the day is empty, this says so and points at it. */}
        <NavCoachMark visible={showAddHint}>Tap + to log a meal</NavCoachMark>
      </ScrollView>

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
  root: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.base,
    gap: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: { flex: 1, gap: space.xs },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.line,
  },
  calendarButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
  },
  // Figure and context side by side, not stacked and centred. The number is
  // the point of the screen and it should not have to share the centre line
  // with the two figures that merely qualify it.
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.base,
  },
  heroFigure: { flex: 1, gap: space.xs },
  heroLabel: { color: color.positive },
  heroNumber: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  heroContext: {
    width: 128,
    paddingTop: space.sm,
    gap: space.sm,
  },
  heroStat: { gap: space.xs },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.line,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    padding: layout.cardPadding,
  },
  bannerText: { flex: 1, gap: space.xs },
  seeAll: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.xs,
  },
  seeAllLabel: { color: color.action },
  list: { gap: space.md },
  divider: {
    height: 1,
    backgroundColor: color.line,
    marginLeft: layout.cardPadding + 44 + space.md,
  },
});
