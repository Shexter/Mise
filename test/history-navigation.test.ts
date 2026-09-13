import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

// The logged-date navigator moved with the calorie content when Today split
// into its two task pages (decision 201). It is still exactly one navigator.
const today = readFileSync('src/components/today/CaloriesPage.tsx', 'utf8');
const strip = readFileSync('src/components/DateStrip.tsx', 'utf8');
const calendar = readFileSync('src/components/HistoryCalendarSheet.tsx', 'utf8');
const store = readFileSync('src/store/dayStore.ts', 'utf8');
const schema = readFileSync('src/db/schema.ts', 'utf8');

describe('history navigation surfaces', () => {
  test('the day header opens a bounded month calendar', () => {
    expect(today).toContain('Open meal history calendar');
    expect(today).toContain('<HistoryCalendarSheet');
    expect(calendar).toContain('earliestLoggedDate');
    expect(calendar).toContain('date < earliestLoggedDate');
    expect(calendar).toContain('isFuture(date)');
    expect(calendar).toContain('No meal history yet');
  });

  test('unlogged dates render no calorie total or target marker', () => {
    expect(calendar).toContain("summary ? (");
    expect(calendar).toContain('<View style={styles.totalPlaceholder} />');
    expect(calendar).toContain("summary.targetCalories === null");
  });

  test('the strip supports swipe and button paging without passing today', () => {
    expect(strip).toContain('PanResponder.create');
    expect(strip).toContain('Previous week');
    expect(strip).toContain('Next week');
    expect(strip).toContain('displayedWeekStart < currentWeekStart');
    expect(strip).toContain('label="Today"');
    expect(strip).toContain('loggedDates.has(date)');
  });

  test('each uncached month calls the one grouped query once', () => {
    expect(store.match(/getDaySummaries\(/g)).toHaveLength(1);
    expect(store).toContain('monthSummaries[key]');
  });

  test('the change adds neither a calendar package nor a migration', () => {
    expect(calendar).not.toMatch(/react-native-calendars|calendar-kit/);
    expect(schema).not.toContain('history_calendar');
  });
});
