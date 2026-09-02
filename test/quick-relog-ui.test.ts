import fs from 'node:fs';

import { describe, expect, test } from 'vitest';

describe('quick re-log UI contract', () => {
  test('meal detail exposes an accessible persisted favorite toggle', () => {
    const detail = fs.readFileSync('app/meal/[id].tsx', 'utf8');
    expect(detail).toContain('toggleMealFavorite(draft.original.id)');
    expect(detail).toContain("draft.original.isFavorite ? 'Remove from favorites' : 'Add to favorites'");
    expect(detail).toContain('accessibilityState={{ selected: draft.original.isFavorite ?? false');
  });

  // The long press moved from Today's floating action button to the centre add
  // button in the tab bar, which replaced it. The sheet now lives beside that
  // button so it is reachable from every tab, not only from Today.
  test('the centre add button long press and Manual both open the recent meal sheet', () => {
    const tabs = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    const today = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
    const manual = fs.readFileSync('app/manual.tsx', 'utf8');
    expect(tabs).toContain('onLongPress={');
    expect(tabs).toContain('showRecentMeals()');
    expect(tabs).toContain('Long press to repeat a recent meal.');
    expect(manual).toContain('label="Pick from recent or favorites"');
    expect(tabs).toContain('<RecentMealsSheet');
    expect(manual).toContain('<RecentMealsSheet');

    // Today must not grow a second way in. The nav button is the only one.
    expect(today).not.toContain('<RecentMealsSheet');
    expect(today).not.toContain('<Fab');
  });

  test('selection requires a visible venue choice before opening review', () => {
    const sheet = fs.readFileSync('src/components/meals/RecentMealsSheet.tsx', 'utf8');
    const tabs = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    expect(sheet).toContain('label="Leftovers"');
    expect(sheet).toContain("choose('leftovers')");
    expect(sheet).toContain('label="Cooked again"');
    expect(sheet).toContain("choose('home')");
    expect(sheet).toContain('Log nutrition without using pantry stock again');
    expect(tabs).toContain('cloneMealForLogging(meal, localDateString(), venue)');
    expect(tabs).toContain("router.push('/review')");
  });

  test('the sheet displays names, calories, dates, frequency, and favorite state', () => {
    const sheet = fs.readFileSync('src/components/meals/RecentMealsSheet.tsx', 'utf8');
    expect(sheet).toContain('{entry.meal.name}');
    expect(sheet).toContain('roundCalories(totals.calories)');
    expect(sheet).toContain('friendlyDate(entry.meal.localDate)');
    expect(sheet).toContain('entry.timesLogged > 1');
    expect(sheet).toContain('entry.isFavorite');
  });
});
