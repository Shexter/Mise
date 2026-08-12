import { describe, expect, test } from 'vitest';

import fs from 'node:fs';

describe('shopping list UI contract', () => {
  test('Pantry exposes Shop while Today stays free of shopping UI', () => {
    const pantry = fs.readFileSync('app/(tabs)/pantry.tsx', 'utf8');
    const today = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
    expect(pantry).toContain("{ value: 'shop', label: 'Shop' }");
    expect(pantry).toContain('<ShoppingListSection />');
    expect(today).not.toContain('ShoppingListSection');
  });

  test('recipe detail offers missing-ingredient capture', () => {
    const recipe = fs.readFileSync('app/recipe/[id].tsx', 'utf8');
    expect(recipe).toContain('Add missing ingredients');
    expect(recipe).toContain("kind: 'recipe_missing'");
  });
});
