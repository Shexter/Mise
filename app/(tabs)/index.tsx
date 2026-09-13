import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasApiKey, maskedApiKey } from '@/api/keyStore';
import { CaloriesPage } from '@/components/today/CaloriesPage';
import { MealPlanPage } from '@/components/today/MealPlanPage';
import { TodayTaskSelector } from '@/components/today/TodayTaskSelector';
import {
  readTodayPagePreference,
  writeTodayPagePreference,
} from '@/components/today/todayPagePreference';
import { color, duration, space } from '@/constants/theme';
import { dailyNutritionSummary } from '@/logic/dailyNutritionSummary';
import {
  clearedRouteParams,
  resolveTodayPage,
  resolveTodayRouteIntent,
  type PlannerView,
  type TodayPage,
} from '@/logic/todayRoute';
import { useDayStore } from '@/store/dayStore';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import type { PlannerNutrition } from '@/types';

/**
 * Today, which holds two tasks: planning the week, and reviewing what was eaten.
 *
 * This screen is the shell for both. It owns the task selector, which page is
 * showing, and the one-time resolution of an arrival's intent — nothing else.
 * Each page owns its own content, its own scroll position and its own date, so
 * a plan for next Tuesday and a logged Monday can be on screen in turn without
 * either heading describing the other's day.
 */
export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    todayPage?: string;
    savedMealId?: string;
    date?: string;
    plannerView?: string;
  }>();

  const selectedDate = useDayStore((state) => state.selectedDate);
  const meals = useDayStore((state) => state.meals);
  const target = useDayStore((state) => state.target);
  const syncToToday = useDayStore((state) => state.syncToToday);
  const refresh = useDayStore((state) => state.refresh);
  const resumeFollowing = useDayStore((state) => state.resumeFollowing);
  const plannerDate = useMealScheduleStore((state) => state.selectedDate);

  const [page, setPage] = useState<TodayPage>(() =>
    resolveTodayPage(resolveTodayRouteIntent(params), readTodayPagePreference()));
  const [view, setView] = useState<PlannerView>('day');
  const [keyMissing, setKeyMissing] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [highlightMealId, setHighlightMealId] = useState<string | null>(null);

  // The Today tab opens on today: sync (which resets `selectedDate` only
  // when `following` is true) before refreshing, so a day chosen earlier in
  // this same visit still holds while a stale or day-old context corrects
  // itself. Leaving the tab restores tracking, so the exception is scoped to
  // one continuous visit rather than surviving until explicitly cleared.
  useFocusEffect(
    useCallback(() => {
      void syncToToday().then(() => refresh());
      // The planner reloads the week it is already showing rather than the
      // logged day's week, so returning to a plan for next Tuesday does not
      // silently snap it back to this week. A pending draft survives: the store
      // persists every edit as it is made and reads it back on load.
      const planner = useMealScheduleStore.getState();
      void planner.load(planner.selectedDate);
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

  /**
   * One arrival, applied once.
   *
   * Route intent outranks the stored preference, and clearing the parameters
   * afterwards is what stops a later manual tab switch from being undone by a
   * replay of the save that brought the person here.
   */
  const appliedIntent = useRef<string | null>(null);
  useEffect(() => {
    const intent = resolveTodayRouteIntent(params);
    if (intent.consumed.length === 0) return;
    const signature = JSON.stringify(intent);
    if (appliedIntent.current === signature) return;
    appliedIntent.current = signature;

    if (intent.page) setPage(intent.page);
    if (intent.plannerView) setView(intent.plannerView);
    if (intent.plannerDate) {
      const planner = useMealScheduleStore.getState();
      void planner.load(intent.plannerDate);
    }
    if (intent.highlightMealId) setHighlightMealId(intent.highlightMealId);

    // A meal saved from the review flow arrives as a route param; the highlight
    // runs for the entering animation, then the parameters clear so revisits
    // do not replay them.
    const timer = setTimeout(() => {
      setHighlightMealId(null);
      router.setParams(clearedRouteParams(intent));
      appliedIntent.current = null;
    }, duration.count);
    return () => clearTimeout(timer);
  }, [params.todayPage, params.savedMealId, params.date, params.plannerView]);

  const onSelectPage = (next: TodayPage) => {
    setPage(next);
    // Only a deliberate tap becomes the remembered default. Landing on Calories
    // because a meal was saved must not make Calories the page a planner opens
    // on tomorrow.
    writeTodayPagePreference(next);
  };

  const nutritionSummary = dailyNutritionSummary(selectedDate, meals, target);
  // What is already eaten, as one entry the planner can compare a proposed
  // portion against — and only when the plan is looking at the same day the
  // meals were logged on. For any other date the app has not read that day's
  // meals, and claiming zero eaten would be an invention.
  const eatenEntries: PlannerNutrition[] = plannerDate === selectedDate && nutritionSummary.hasMeals
    ? [{
      calories: nutritionSummary.metrics.energy.knownValue,
      proteinG: nutritionSummary.metrics.protein.knownValue,
      carbsG: nutritionSummary.metrics.carbohydrate.knownValue,
      fatG: nutritionSummary.metrics.fat.knownValue,
      fibreG: nutritionSummary.metrics.fibre.knownValue,
      source: null,
    }]
    : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <TodayTaskSelector page={page} onSelect={onSelectPage} />

      {/* Only the selected page is mounted. A hidden tree would keep its
          controls in the accessibility order, so the scroll position is what is
          remembered instead — see `useRememberedScroll`. Planner drafts live in
          the schedule store, not in this tree, so switching tasks cannot lose
          an edit. */}
      {page === 'meal-plan' ? (
        <MealPlanPage
          view={view}
          onChangeView={setView}
          target={target}
          eatenEntries={eatenEntries}
        />
      ) : (
        <CaloriesPage
          highlightMealId={highlightMealId}
          keyMissing={keyMissing}
          maskedKey={maskedKey}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground },
});
