import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { PlannerRecipeVisual } from '@/components/planner/PlannerRecipeVisual';
import { SkeletonLine } from '@/components/Skeleton';
import { Body, Caption, DisplayTitle, RowTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { addWeeks, friendlyDate, fullDate, weekOf, weekRangeLabel } from '@/logic/dates';
import type { PlannerView } from '@/logic/todayRoute';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import { PlannerAgenda } from '@/components/planner/PlannerAgenda';
import { PlanViewControl } from '@/components/planner/PlanViewControl';
import { WeekDayRail, type DayTarget } from '@/components/planner/WeekDayRail';
import { formatPortions } from '@/components/planner/MealSlotRow';
import { usePlannerCommit } from '@/components/planner/usePlannerCommit';
import { dismissPlannerIntro, plannerIntroDismissed } from '@/components/planner/plannerIntroPreference';
import { WeekTemplateSheet } from '@/components/planner/WeekTemplateSheet';
import {
  dayIsComplete,
  MEAL_TYPE_LABEL,
  nextUpcomingSlot,
  weekSummary,
} from '@/components/planner/model';
import type { DailyTarget, PlannedMealType, PlannerNutrition } from '@/types';

interface Props {
  /** The planning date. May be in the future; it is not a logging date. */
  selectedDate: string;
  onSelectDate: (localDate: string) => void;
  target: DailyTarget | null;
  eatenEntries: readonly PlannerNutrition[];
  /** Controlled, so a route handoff can change the view after first render. */
  view: PlannerView;
  onChangeView: (view: PlannerView) => void;
}

/**
 * Today's `Meal plan` page: the week's schedule and every way into editing it.
 *
 * This page owns the planning date. It is deliberately separate from the logged
 * date the `Calories` page uses, because a plan reaches into next week and a
 * meal log never does — showing tomorrow's dinner under today's heading is the
 * failure this split exists to prevent.
 *
 * One date navigator: the week pager and the day rail below the title. The
 * Day/Week choice is a compact menu rather than a second segmented control, so
 * the only tab bar on screen is the one that switches tasks.
 *
 * The single main action follows state — open the next scheduled meal, plan an
 * empty week, continue a partial one, or view the week when the day is done —
 * so there is one filled button on screen and it always names the next real
 * thing to do. Planning is never required to log a meal or ask for a dinner idea.
 */
export function PlannerHome({
  selectedDate,
  onSelectDate,
  target,
  eatenEntries,
  view,
  onChangeView,
}: Props) {
  const router = useRouter();
  const commit = usePlannerCommit();
  const [editing, setEditing] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(() => plannerIntroDismissed());
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [dayTargets, setDayTargets] = useState<DayTarget[]>([]);
  const [measureKey, setMeasureKey] = useState(0);

  const draft = useMealScheduleStore((state) => state.draft);
  const status = useMealScheduleStore((state) => state.status);
  // Held stable across renders: the rail measures itself whenever this array's
  // identity changes, and a fresh array every render would never settle.
  const weekStart = draft?.weekStart ?? null;
  const days = useMemo(() => (weekStart === null ? [] : weekOf(weekStart)), [weekStart]);
  const error = useMealScheduleStore((state) => state.error);
  const retry = useMealScheduleStore((state) => state.retry);

  const onCommit = useCallback((next: Parameters<typeof commit>[0], message: string) => {
    void commit(next, message);
  }, [commit]);

  const chooseRecipe = (localDate: string, mealType: PlannedMealType) => {
    router.push({ pathname: '/plan/picker', params: { date: localDate, mealType } });
  };

  const replaceRecipe = (localDate: string, mealType: PlannedMealType, replaceSlotId: string) => {
    router.push({ pathname: '/plan/picker', params: { date: localDate, mealType, replaceSlotId } });
  };

  const header = (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <DisplayTitle>{friendlyDate(selectedDate)}</DisplayTitle>
          <Caption muted>{fullDate(selectedDate)}</Caption>
        </View>
        <PlanViewControl view={view} onChange={onChangeView} />
      </View>
      <View style={styles.rule} />
    </>
  );

  // A schedule that has never loaded shows a stable skeleton, never an empty
  // week that would read as "you have planned nothing" while it is still
  // reading from disk.
  if (status === 'loading' || (status === 'idle' && !draft)) {
    return (
      <View>
        {header}
        <View style={styles.loading}>
          <SkeletonLine width="40%" />
          <SkeletonLine width="80%" />
          <SkeletonLine width="65%" />
          <Caption muted>Loading your week…</Caption>
        </View>
      </View>
    );
  }

  if (status === 'error' && !draft) {
    return (
      <View>
        {header}
        <View style={styles.loading}>
          <RowTitle>Your plan could not be loaded</RowTitle>
          <Caption muted>{error ?? 'Nothing has been changed.'}</Caption>
          <Button label="Try again" variant="secondary" onPress={() => void retry()} />
        </View>
      </View>
    );
  }

  if (!draft) return null;

  const summary = weekSummary(draft);
  const next = nextUpcomingSlot(draft, selectedDate);
  const complete = dayIsComplete(draft, selectedDate);
  const busy = status === 'saving';

  const openWeek = () => { onChangeView('week'); setEditing(true); };

  const mainAction = next
    ? {
      label: `Open ${MEAL_TYPE_LABEL[next.slot.mealType].toLowerCase()} plan`,
      onPress: () => router.push({ pathname: '/plan/meal', params: { slotId: next.slot.id } }),
    }
    : complete
      ? { label: 'View week', onPress: openWeek }
      : summary.empty
        ? { label: 'Plan your week', onPress: openWeek }
        : { label: 'Continue planning', onPress: openWeek };

  return (
    <View>
      {header}

      {/* One date navigator for this page: the week it is showing, and the days
          in it. Planning reaches forward, so neither control refuses a future
          date the way the logged-date strip on Calories does. */}
      <View style={styles.weekPager}>
        <PagerButton direction="left" onPress={() => onSelectDate(addWeeks(selectedDate, -1))} />
        <Caption muted numeric style={styles.weekLabel}>{weekRangeLabel(selectedDate)}</Caption>
        <PagerButton direction="right" onPress={() => onSelectDate(addWeeks(selectedDate, 1))} />
      </View>

      <WeekDayRail
        days={days}
        selectedDate={selectedDate}
        draft={draft}
        onSelect={onSelectDate}
        hoveredDate={hoveredDate}
        onMeasure={setDayTargets}
        measureKey={measureKey}
      />

      <Pressable
        onPress={() => router.push('/dinner')}
        accessibilityRole="button"
        accessibilityLabel="What's for dinner?"
        accessibilityHint="Ideas from what is already in your pantry"
        style={({ pressed }) => [styles.dinnerLink, pressed && { opacity: opacity.pressed }]}
      >
        <Body style={styles.dinnerText}>What's for dinner?</Body>
        <Feather name="chevron-right" size={18} color={color.action} />
      </Pressable>

      {/* One dismissible cue for an install that predates planning. It is not
          shown to anyone who already has a plan, and dismissing it is final. */}
      {!introDismissed && summary.empty ? (
        <View style={styles.intro}>
          <RowTitle>Mise can plan your week now</RowTitle>
          <Caption muted>
            Choose meals, and Mise turns them into the groceries to buy. Your logging, pantry and dinner ideas are
            unchanged.
          </Caption>
          <Pressable
            onPress={() => { dismissPlannerIntro(); setIntroDismissed(true); }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss the planning introduction"
            style={({ pressed }) => [styles.dismiss, pressed && { opacity: opacity.pressed }]}
          >
            <Body style={styles.dinnerText}>Got it</Body>
          </Pressable>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.saveError}>
          <Body>Couldn't save this change</Body>
          <Caption muted>{error ?? 'Your edit is kept. The last saved plan is still shown.'}</Caption>
          <Button label="Retry" variant="secondary" onPress={() => void retry()} />
        </View>
      ) : null}

      {view === 'day' && next ? (
        <View style={styles.upNext}>
          <SectionLabel>Up next · {MEAL_TYPE_LABEL[next.slot.mealType]}</SectionLabel>
          <View style={styles.upNextRow}>
            <PlannerRecipeVisual snapshot={next.snapshot} size="sm" alt="" />
            <View style={styles.upNextText}>
              <RowTitle numberOfLines={2}>{next.snapshot.title}</RowTitle>
              <Caption muted>
                {formatPortions(next.slot.eatenPortions)} portion
                {next.slot.eatenPortions === 1 ? '' : 's'}
                {next.snapshot.durationMinutes ? ` · ${next.snapshot.durationMinutes} min` : ''}
              </Caption>
            </View>
          </View>
        </View>
      ) : null}

      {view === 'day' && !next && complete ? (
        <View style={styles.upNext}>
          <RowTitle>Today's plan is complete</RowTitle>
          <Caption muted>Everything you planned for today is logged or skipped.</Caption>
        </View>
      ) : null}

      {view === 'day' && !next && !complete && summary.empty ? (
        <View style={styles.upNext}>
          <RowTitle>Choose your meals. We'll make the grocery list.</RowTitle>
          <Caption muted>
            No pantry setup, no targets and no API key needed. Pick what you want to eat and Mise works out what to buy.
          </Caption>
        </View>
      ) : null}

      <Button label={mainAction.label} onPress={mainAction.onPress} block style={styles.mainAction} />

      <PlannerAgenda
        draft={draft}
        selectedDate={selectedDate}
        target={target}
        eatenEntries={eatenEntries}
        onSelectDate={onSelectDate}
        onCommit={onCommit}
        onOpenSlot={(slotId) => router.push({ pathname: '/plan/meal', params: { slotId } })}
        onChooseRecipe={chooseRecipe}
        onReplaceRecipe={replaceRecipe}
        dayTargets={dayTargets}
        onHoverDate={setHoveredDate}
        onLiftSlot={() => setMeasureKey((key) => key + 1)}
        busy={busy}
      />

      {view === 'week' ? (
        <View style={styles.weekFooter}>
          <Caption muted>
            {summary.scheduledSlots === 0
              ? `Nothing scheduled for ${friendlyDate(days[0]!)} – ${friendlyDate(days[6]!)} yet.`
              : `${summary.scheduledSlots} meal${summary.scheduledSlots === 1 ? '' : 's'} scheduled across ${summary.filledDays} day${summary.filledDays === 1 ? '' : 's'} · ${summary.batches} batch${summary.batches === 1 ? '' : 'es'}`}
          </Caption>
          <Pressable
            onPress={() => router.push('/(tabs)/shop')}
            accessibilityRole="button"
            accessibilityLabel="Review groceries"
            style={({ pressed }) => [styles.weekLink, pressed && { opacity: opacity.pressed }]}
          >
            <Body style={styles.dinnerText}>Review groceries</Body>
            <Feather name="chevron-right" size={18} color={color.action} />
          </Pressable>
          <Pressable
            onPress={() => setTemplatesOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Save or reuse a week"
            style={({ pressed }) => [styles.weekLink, pressed && { opacity: opacity.pressed }]}
          >
            <Body style={styles.dinnerText}>Save or reuse a week</Body>
            <Feather name="chevron-right" size={18} color={color.action} />
          </Pressable>
          {editing ? (
            <Pressable
              onPress={() => { setEditing(false); onChangeView('day'); }}
              accessibilityRole="button"
              accessibilityLabel="Done planning"
              accessibilityHint="Stops editing. A partial week is fine."
              style={({ pressed }) => [styles.weekLink, pressed && { opacity: opacity.pressed }]}
            >
              <Body style={styles.dinnerText}>Done planning</Body>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <WeekTemplateSheet
        visible={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        draft={draft}
        onApply={onCommit}
      />
    </View>
  );
}

function PagerButton({ direction, onPress }: { direction: 'left' | 'right'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? 'Previous week' : 'Next week'}
      hitSlop={space.sm}
      style={({ pressed }) => [styles.pagerButton, pressed && { opacity: opacity.pressed }]}
    >
      <Feather name={`chevron-${direction}`} size={22} color={color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: { flex: 1, gap: space.xs },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.line,
    marginTop: space.lg,
  },
  weekPager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  weekLabel: { flex: 1, textAlign: 'center' },
  pagerButton: {
    width: 32,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { gap: space.sm, paddingVertical: space.lg },
  dinnerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.minTouchTarget,
    marginTop: space.md,
  },
  dinnerText: { color: color.action },
  saveError: {
    marginTop: space.md,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: color.paprika,
    borderRadius: radius.card,
    gap: space.sm,
  },
  intro: {
    marginTop: space.md,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
    gap: space.xs,
  },
  dismiss: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
  upNext: { marginTop: space.base, gap: space.sm },
  upNextRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  upNextText: { flex: 1, gap: space.xs },
  mainAction: { marginTop: space.base },
  weekFooter: { marginTop: space.base, gap: space.sm },
  weekLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.minTouchTarget,
  },
});
