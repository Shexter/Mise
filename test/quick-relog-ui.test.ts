import fs from 'node:fs';

import { describe, expect, test } from 'vitest';

describe('quick re-log UI contract', () => {
  test('meal detail exposes an accessible persisted favorite toggle', () => {
    const detail = fs.readFileSync('app/meal/[id].tsx', 'utf8');
    expect(detail).toContain('toggleMealFavorite(draft.original.id)');
    expect(detail).toContain("draft.original.isFavorite ? 'Remove from favorites' : 'Add to favorites'");
    expect(detail).toContain('accessibilityState={{ selected: draft.original.isFavorite ?? false');
  });

  test('Today long press and Manual both open the recent meal sheet', () => {
    const today = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
    const manual = fs.readFileSync('app/manual.tsx', 'utf8');
    expect(today).toContain('onLongPress={() => setRecentMealsOpen(true)}');
    expect(today).toContain('longPressHint="Long press to repeat a recent or favorite meal"');
    expect(manual).toContain('label="Pick from recent or favorites"');
    expect(today).toContain('<RecentMealsSheet');
    expect(manual).toContain('<RecentMealsSheet');
  });

  test('selection requires a visible venue choice before opening review', () => {
    const sheet = fs.readFileSync('src/components/meals/RecentMealsSheet.tsx', 'utf8');
    const today = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
    expect(sheet).toContain('label="Leftovers"');
    expect(sheet).toContain("choose('leftovers')");
    expect(sheet).toContain('label="Cooked again"');
    expect(sheet).toContain("choose('home')");
    expect(sheet).toContain('Log nutrition without using pantry stock again');
    expect(today).toContain('cloneMealForLogging(meal, localDateString(), venue)');
    expect(today).toContain("router.push('/review')");
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
