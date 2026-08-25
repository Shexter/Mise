import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasApiKey, maskedApiKey } from '@/api/keyStore';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CountingNumber } from '@/components/CountingNumber';
import { DailyTargetSummary } from '@/components/DailyTargetSummary';
import { DateStrip } from '@/components/DateStrip';
import { DayRail } from '@/components/DayRail';
import { Fab } from '@/components/Fab';
import { HistoryCalendarSheet } from '@/components/HistoryCalendarSheet';
import { MealRow } from '@/components/MealRow';
import { Body, Caption, ScreenTitle, SectionLabel } from '@/components/Type';
import { useToast } from '@/components/Toast';
import {
  color,
  duration,
  layout,
  opacity,
  radius,
  space,
} from '@/constants/theme';
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
import { friendlyDate, isToday, localDateString } from '@/logic/dates';
import { dailyNutritionSummary } from '@/logic/dailyNutritionSummary';
import { roundCalories } from '@/logic/scaling';
import { deleteAllPhotos } from '@/media/photos';
import { useDayStore } from '@/store/dayStore';
import { useProfileStore } from '@/store/profileStore';
import type { SuggestionTargetMacro } from '@/types';

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
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [highlightMealId, setHighlightMealId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // The Today tab opens on today: sync (which resets `selectedDate` only
  // when `following` is true) before refreshing, so a day chosen earlier in
  // this same visit still holds while a stale or day-old context corrects
  // itself. Leaving the tab restores tracking, so the exception is scoped to
  // one continuous visit rather than surviving until explicitly cleared.
  useFocusEffect(
    useCallback(() => {
      void syncToToday().then(() => refresh());
      void (async () => {
        const keyPresent = await hasApiKey();
        setKeyMissing(!keyPresent);
        setMaskedKey(await maskedApiKey());
      })();
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
      const timer = setTimeout(() => {
        setHighlightMealId(null);
        router.setParams({ savedMealId: undefined });
      }, duration.count);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [params.savedMealId]);

  const nutritionSummary = dailyNutritionSummary(selectedDate, meals, target);
  const energy = nutritionSummary.metrics.energy;
  const targetCalories = energy.target ?? 0;
  const remaining = energy.knownValue === null || energy.target === null
    ? null
    : energy.target - roundCalories(energy.knownValue);
  const isOver = remaining !== null && remaining < 0;

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
              setDemoLoading(true);
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
              } finally {
                setDemoLoading(false);
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

        <Pressable
          style={styles.hero}
          accessibilityRole="button"
          accessibilityHint="Shows which meals contributed to today's energy."
          onPress={() => router.push({ pathname: '/analytics', params: { metric: 'energy', date: selectedDate } })}
        >
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
        </Pressable>

        <DayRail
          meals={meals}
          targetCalories={targetCalories}
          highlightMealId={highlightMealId}
          onSelectMeal={(mealId) => router.push(`/meal/${mealId}`)}
        />

        {target ? (
          <View style={styles.macros}>
            <DailyTargetSummary
              summary={nutritionSummary}
              onSelect={(metric) => router.push({ pathname: '/analytics', params: { metric, date: selectedDate } })}
              onRequest={onMacroRequest}
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

        {maskedKey === null ? (
          <Pressable
            onPress={onDemoCardPress}
            accessibilityRole="button"
            accessibilityLabel="Discover demo data"
            style={({ pressed }) => [
              styles.banner,
              pressed && { opacity: opacity.pressed },
              { backgroundColor: color.olive, borderColor: color.olive }]}
          >
            <Body>First time here? Try a quick demo.</Body>
            <Caption>Load a rich dataset with meals, pantry, recipes, and more — no entry required.</Caption>
          </Pressable>
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
              <Body>Nothing logged yet</Body>
              <Caption muted>Photograph your first meal to start the day.</Caption>
              <Button label="Take a photo" variant="secondary" block={false} onPress={() => router.push('/capture')} style={styles.emptyAction} />
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
  emptyAction: { marginTop: space.sm },
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
