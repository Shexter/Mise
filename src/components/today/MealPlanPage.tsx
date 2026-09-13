import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PlannerHome } from '@/components/planner/PlannerHome';
import { scrollMemoryKey, useRememberedScroll } from '@/components/today/useRememberedScroll';
import { layout, space } from '@/constants/theme';
import { weekOf } from '@/logic/dates';
import type { PlannerView } from '@/logic/todayRoute';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import type { DailyTarget, PlannerNutrition } from '@/types';

interface Props {
  view: PlannerView;
  onChangeView: (view: PlannerView) => void;
  target: DailyTarget | null;
  /** Nutrition already logged for the planning date. Empty when it is not known. */
  eatenEntries: readonly PlannerNutrition[];
}

/**
 * Today's `Meal plan` page.
 *
 * A thin scroll container: the planner's own composition lives in
 * `PlannerHome`. What this owns is the planning date, which is deliberately the
 * schedule store's and not the day store's — planning reaches into next week
 * and logging does not, so the two dates move independently and neither page's
 * heading can end up describing the other page's day.
 */
export function MealPlanPage({ view, onChangeView, target, eatenEntries }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const selectedDate = useMealScheduleStore((state) => state.selectedDate);
  const scroll = useRememberedScroll(scrollMemoryKey('meal-plan', selectedDate));

  // Selecting a date is not always a within-week move: the week pager and the
  // day rail can both land on another week. `selectDate` alone would leave the
  // planner showing the previously loaded week's slots against the new date, so
  // the week is reloaded whenever it actually changes. The draft for the week
  // being left is already persisted, so nothing in progress is discarded.
  const selectPlannerDate = useCallback((localDate: string) => {
    const planner = useMealScheduleStore.getState();
    const currentWeek = planner.draft?.weekStart ?? null;
    if (currentWeek !== weekOf(localDate)[0]) {
      void planner.load(localDate);
      return;
    }
    planner.selectDate(localDate);
  }, []);

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
        <PlannerHome
          selectedDate={selectedDate}
          onSelectDate={selectPlannerDate}
          target={target}
          eatenEntries={eatenEntries}
          view={view}
          onChangeView={onChangeView}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.base,
  },
});
