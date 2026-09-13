import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Body, Caption } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { dayRailOffset } from '@/components/planner/dayRailScroll';
import { dayOfMonth, friendlyDate, isToday, weekdayInitial } from '@/logic/dates';
import type { PlannerDraft } from '@/types';

export interface DayTarget {
  localDate: string;
  /** Window coordinates, in the same space a gesture's `absoluteX/Y` uses. */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  days: readonly string[];
  selectedDate: string;
  draft: PlannerDraft;
  onSelect: (localDate: string) => void;
  /** Set while a row is being dragged, so the day under the finger is marked. */
  hoveredDate?: string | null;
  /** Reports each square's position so a drag can hit-test against it. */
  onMeasure?: (targets: DayTarget[]) => void;
  /**
   * Bumped by the caller when a drag begins. Positions measured earlier go
   * stale as soon as either scroll view moves, so they are taken again at the
   * moment they are about to be used rather than trusted from layout time.
   */
  measureKey?: number;
}

/**
 * The week's day rail, and the cross-day drop target for drag placement.
 *
 * The selected day is marked by a filled square *and* by its own "Selected"
 * screen-reader state and a rule under the label — never by colour alone. The
 * scheduled-meal count is written as a number rather than a dot, because three
 * dots and two dots are not distinguishable at a glance with food on your hands.
 *
 * Seven days rarely fit a phone, so the rail keeps the selected one on screen.
 * Without that, a Sunday opens with today clipped against the right edge — the
 * one day the page is about is the one you cannot see.
 *
 * Two coordinate systems are in play and they are deliberately not mixed. A
 * drop is tested against **window** coordinates, because that is what a gesture
 * reports. A scroll offset is a **content** coordinate, because that is what
 * `scrollTo` consumes. Conflating them is what made drag placement miss.
 */
export function WeekDayRail({
  days,
  selectedDate,
  draft,
  onSelect,
  hoveredDate,
  onMeasure,
  measureKey = 0,
}: Props) {
  const views = useRef(new Map<string, View>());
  const reported = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();

  /** Content-space geometry, for scrolling. Separate from the window-space measure below. */
  const scroller = useRef<ScrollView | null>(null);
  const frames = useRef(new Map<string, { x: number; width: number }>());
  const viewport = useRef(0);
  const content = useRef(0);
  /** The week this rail has already been positioned for, so it places once. */
  const positionedWeek = useRef<string | null>(null);

  /**
   * Window coordinates, not parent-relative ones. A rail that scrolls inside a
   * page that also scrolls has no fixed offset from anything, so the only
   * position a drop can be tested against is the one on screen.
   */
  const measure = useCallback(() => {
    if (!onMeasure) return;
    const measured: DayTarget[] = [];
    let pending = days.length;
    if (pending === 0) return;
    const report = () => {
      // Layout fires more often than positions change. Reporting an equal set
      // would hand the parent a new array on every pass, which is a render
      // loop rather than an update.
      const signature = measured
        .map((target) => `${target.localDate}:${target.x}:${target.y}:${target.width}:${target.height}`)
        .sort()
        .join('|');
      if (signature === reported.current) return;
      reported.current = signature;
      onMeasure(measured);
    };
    for (const day of days) {
      const view = views.current.get(day);
      if (!view) {
        pending -= 1;
        if (pending === 0 && measured.length > 0) report();
        continue;
      }
      view.measureInWindow((x, y, width, height) => {
        measured.push({ localDate: day, x, y, width, height });
        pending -= 1;
        if (pending === 0) report();
      });
    }
  }, [days, onMeasure]);

  useEffect(() => {
    measure();
  }, [measure, measureKey, selectedDate]);

  /**
   * Brings the selected day fully into view, centred where the week allows it
   * and flush to an end where it does not.
   *
   * A week the rail has not shown before is *placed*, not slid to: all seven
   * tiles changed, and animating between two unrelated sets reads as drift
   * rather than as movement. Changing day inside the week already on screen
   * animates, because that is one thing moving. Reduce Motion takes the cut in
   * both cases.
   */
  const revealSelected = useCallback(() => {
    const frame = frames.current.get(selectedDate);
    const width = viewport.current;
    if (!frame || width === 0) return;

    const target = dayRailOffset({
      tileX: frame.x,
      tileWidth: frame.width,
      viewportWidth: width,
      contentWidth: content.current,
    });

    const week = days[0] ?? null;
    const animated = positionedWeek.current === week && !reduceMotion;
    positionedWeek.current = week;
    scroller.current?.scrollTo({ x: target, animated });
  }, [days, selectedDate, reduceMotion]);

  useEffect(() => {
    revealSelected();
  }, [revealSelected]);

  // Layout is what first tells the rail where its tiles are, so it drives the
  // initial placement of each week; the effect above handles every later change
  // of day within a week already laid out.
  const onTileLayout = (day: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    frames.current.set(day, { x, width });
    measure();
    if (positionedWeek.current !== (days[0] ?? null)) revealSelected();
  };

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      onScrollEndDrag={measure}
      onMomentumScrollEnd={measure}
      onLayout={(event) => {
        viewport.current = event.nativeEvent.layout.width;
        if (positionedWeek.current !== (days[0] ?? null)) revealSelected();
      }}
      onContentSizeChange={(width) => {
        content.current = width;
        if (positionedWeek.current !== (days[0] ?? null)) revealSelected();
      }}
      accessibilityRole="tablist"
    >
      {days.map((day) => {
        const count = draft.slots.filter((slot) => slot.localDate === day).length;
        const selected = day === selectedDate;
        const hovered = day === hoveredDate;
        return (
          <Pressable
            key={day}
            ref={(node) => {
              if (node) {
                views.current.set(day, node as unknown as View);
              } else {
                views.current.delete(day);
                frames.current.delete(day);
              }
            }}
            onLayout={onTileLayout(day)}
            onPress={() => onSelect(day)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${friendlyDate(day)}. ${count === 0 ? 'Nothing scheduled' : `${count} meal${count === 1 ? '' : 's'} scheduled`}.`}
            style={({ pressed }) => [
              styles.day,
              selected && styles.daySelected,
              hovered && !selected && styles.dayHovered,
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <Caption
              muted={!selected}
              style={selected ? styles.selectedText : undefined}
            >
              {weekdayInitial(day)}
            </Caption>
            <Body numeric style={selected ? styles.selectedText : undefined}>
              {dayOfMonth(day)}
            </Body>
            <Caption
              muted={!selected}
              numeric
              style={selected ? styles.selectedText : undefined}
            >
              {count === 0 ? '·' : String(count)}
            </Caption>
            {isToday(day) ? (
              <View style={[styles.todayRule, selected && styles.todayRuleSelected]} />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.sm, paddingRight: space.base },
  day: {
    minWidth: 52,
    minHeight: layout.minTouchTarget + space.lg,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  daySelected: { backgroundColor: color.action, borderColor: color.action },
  dayHovered: { borderColor: color.action, borderWidth: 2, backgroundColor: color.tintPaprika },
  selectedText: { color: color.onAction },
  todayRule: { height: 2, width: 16, backgroundColor: color.ink, borderRadius: radius.pill },
  todayRuleSelected: { backgroundColor: color.onAction },
});
