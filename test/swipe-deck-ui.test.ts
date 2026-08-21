import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { badgeTextCandidates } from '@/constants/theme';
import { THEME_IDS, themePalettes } from '@/constants/themePalettes';
import { contrastRatio, readableOn, relativeLuminance } from '@/logic/contrast';
import {
  calorieFit,
  detectCuisine,
  pantryAccessibilityLabel,
  pantryCoverage,
  pantryLabel,
  pantryStatusFor,
  prepSpeed,
  remainingLabel,
} from '@/logic/mealCard';
import type { Suggestion } from '@/types';

const card = readFileSync('src/components/suggestions/MealSwipeCard.tsx', 'utf8');
const controls = readFileSync('src/components/suggestions/DeckControls.tsx', 'utf8');
const sheet = readFileSync('src/components/suggestions/MealDetailSheet.tsx', 'utf8');
const deck = readFileSync('src/components/suggestions/MealSwipeDeck.tsx', 'utf8');
const sheetShell = readFileSync('src/components/Sheet.tsx', 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(entry.name) ? [path] : [];
  });
}

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    dish: 'Pantry bowl',
    reasons: [],
    kcalPerServing: 500,
    servings: 2,
    effortMinutes: 15,
    uses: [],
    missing: [],
    method: ['Cook it'],
    estimatedNutritionPerServing: null,
    ...overrides,
  };
}

describe('prep speed tiers', () => {
  test.each([
    [5, 'quick'],
    [20, 'quick'],
    [21, 'medium'],
    [45, 'medium'],
    [46, 'slow'],
    [120, 'slow'],
  ])('%i minutes is %s', (minutes, expected) => {
    expect(prepSpeed(minutes)).toBe(expected);
  });
});

describe('calorie fit badge states', () => {
  test('within 75 kcal either way is an exact fit', () => {
    expect(calorieFit({ mealCalories: 640, remainingCalories: 600, estimated: false }).kind)
      .toBe('exact-fit');
    expect(calorieFit({ mealCalories: 540, remainingCalories: 600, estimated: false }).kind)
      .toBe('exact-fit');
  });

  test('comfortably under the allowance fits the budget', () => {
    const fit = calorieFit({ mealCalories: 300, remainingCalories: 600, estimated: false });
    expect(fit.kind).toBe('fits-budget');
    expect(fit.overBy).toBe(0);
  });

  test('over budget names the exact rounded delta', () => {
    const fit = calorieFit({ mealCalories: 780, remainingCalories: 600, estimated: false });
    expect(fit.kind).toBe('over-budget');
    expect(fit.label).toBe('+180 kcal over');
    expect(fit.overBy).toBe(180);
    expect(fit.accessibilityLabel).toBe('Over budget by 180 calories');
  });

  test('incomplete nutrition wins over any fit state and tildes the figure', () => {
    const fit = calorieFit({ mealCalories: 780, remainingCalories: 600, estimated: true });
    expect(fit.kind).toBe('estimated');
    expect(fit.calorieLabel).toBe('~780 kcal');
  });

  test('no daily target claims no fit at all', () => {
    const fit = calorieFit({ mealCalories: 500, remainingCalories: null, estimated: false });
    expect(fit.kind).toBe('unknown');
    expect(fit.label).toBe('Per serving');
  });

  test('exactly one state is ever returned', () => {
    const kinds = new Set(
      [0, 200, 600, 1200].map(
        (kcal) => calorieFit({ mealCalories: kcal, remainingCalories: 600, estimated: false }).kind,
      ),
    );
    expect(kinds.has('estimated')).toBe(false);
    expect([...kinds].every((kind) => typeof kind === 'string')).toBe(true);
  });

  test('a badge never speaks in icon names', () => {
    for (const estimated of [true, false]) {
      const fit = calorieFit({ mealCalories: 500, remainingCalories: 600, estimated });
      expect(fit.accessibilityLabel).not.toMatch(/icon|image|arrow|checkmark|glyph/i);
    }
  });
});

describe('pantry coverage badge', () => {
  test('everything on hand reads full', () => {
    expect(pantryCoverage(4, 4)).toBe('full');
    expect(pantryLabel(4, 4)).toBe('4/4 on hand');
    expect(pantryAccessibilityLabel(4, 4)).toBe('All 4 ingredients on hand');
  });

  test('under half on hand is the shopping signal', () => {
    expect(pantryCoverage(1, 4)).toBe('low');
    expect(pantryCoverage(2, 4)).toBe('partial');
    expect(pantryAccessibilityLabel(1, 4)).toBe('1 of 4 ingredients on hand, 3 to buy');
  });

  test('a live on-hand set overrides the suggestion own count', () => {
    const meal = suggestion({
      uses: [
        { canonicalId: 'rice', qty: 1, unit: 'g' },
        { canonicalId: 'egg', qty: 2, unit: 'piece' },
      ],
      missing: [{ canonicalId: null, name: 'spring onion', note: null }],
    });
    expect(pantryStatusFor(meal)).toEqual({ held: 2, total: 3 });
    expect(pantryStatusFor(meal, new Set(['rice']))).toEqual({ held: 1, total: 3 });
  });
});

describe('cuisine pill', () => {
  test('recognises a dish it has a term for', () => {
    expect(detectCuisine('Chicken katsu curry')).toBe('Japanese');
    expect(detectCuisine('Mushroom risotto')).toBe('Italian');
  });

  test('an unrecognised dish yields null so no pill is rendered', () => {
    expect(detectCuisine('Fridge clear-out bowl')).toBeNull();
  });

  test('the card reserves the pill space rather than shifting the layout', () => {
    expect(card).toContain('pillPlaceholder');
    expect(card).toMatch(/label === null \? \(\s*<View style=\{styles\.pillPlaceholder\}/);
  });
});

describe('deck count indicator', () => {
  test('one meal is singular', () => {
    expect(remainingLabel(1)).toBe('1 meal remaining');
  });

  test('every other count is plural', () => {
    expect(remainingLabel(0)).toBe('0 meals remaining');
    expect(remainingLabel(3)).toBe('3 meals remaining');
  });

  test('the deck renders the count from live state, never a cached number', () => {
    expect(deck).toContain('<DeckCountIndicator remaining={state.meals.length} />');
  });
});

describe('badge fill contrast', () => {
  const FILLS = ['exactFitBg', 'fitsBudgetBg', 'overBudgetBg', 'estimatedBg'] as const;

  function fillsFor(id: (typeof THEME_IDS)[number]): Record<(typeof FILLS)[number], string> {
    const palette = themePalettes[id];
    return {
      exactFitBg: palette.chart3,
      fitsBudgetBg: palette.chart5,
      overBudgetBg: palette.paprika,
      estimatedBg: palette.wheat,
    };
  }

  test('every badge fill clears AA body text in every theme', () => {
    for (const id of THEME_IDS) {
      const fills = fillsFor(id);
      for (const fill of FILLS) {
        const text = readableOn(fills[fill], badgeTextCandidates);
        const ratio = contrastRatio(fills[fill], text);
        expect(ratio, `${id}/${fill} on ${text}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('the neutral fill clears AA too', () => {
    for (const id of THEME_IDS) {
      const line = themePalettes[id].line;
      expect(contrastRatio(line, readableOn(line, badgeTextCandidates))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('badge text comes from the token block, not from the component', () => {
    expect(card).toContain('swipeTokens.badge.exactFitText');
    expect(card).toContain('swipeTokens.badge.fitsBudgetText');
    expect(card).toContain('swipeTokens.badge.overBudgetText');
    expect(card).toContain('swipeTokens.badge.estimatedText');
    expect(card).toContain('swipeTokens.badge.neutralText');
    expect(card).toContain('const badgeText = BADGE_TEXT[fit.kind];');
  });

  test('every fit state has both a fill and a text token', () => {
    const kinds = ["'exact-fit'", "'fits-budget'", "'over-budget'", 'estimated', 'unknown'];
    const fillBlock = card.slice(card.indexOf('const BADGE_FILL'), card.indexOf('const BADGE_TEXT'));
    const textBlock = card.slice(card.indexOf('const BADGE_TEXT'), card.indexOf('const BADGE_GLYPH'));
    for (const kind of kinds) {
      expect(fillBlock).toContain(kind);
      expect(textBlock).toContain(kind);
    }
  });

  test('contrast maths matches the WCAG reference points', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(relativeLuminance('not a colour')).toBeNull();
  });
});

describe('card visual layer stack', () => {
  test('the stamps are driven from translateX on the UI thread only', () => {
    expect(card).toContain('useDerivedValue');
    expect(card).toContain('Extrapolation.CLAMP');
    expect(card).toContain('cardWidth * STAMP_FULL_AT');
    expect(card).toContain('-(cardWidth * STAMP_FULL_AT)');
  });

  test('the overlay never intercepts a touch or a screen reader', () => {
    expect(card).toMatch(/pointerEvents="none"[\s\S]{0,120}importantForAccessibility="no-hide-descendants"/);
  });

  test('the top card is shadowed more deeply than the card behind it', () => {
    expect(card).toContain('cardShadowStyle(depth)');
    expect(card).toContain('isTopCard === false ? 1 : 3');
  });

  test('the dish name wraps to two lines and then ellipsizes', () => {
    expect(card).toContain('numberOfLines={2}');
    expect(card).toContain('ellipsizeMode="tail"');
  });

  test('a short dish name does not leave a gap above the badges', () => {
    expect(card).toContain("middle: { flex: 1, justifyContent: 'center'");
  });

  test('macro chips fall back to a dash rather than inventing a zero', () => {
    expect(card).toContain("? '—'");
  });

  test('the card carries the swipe hint for a screen reader', () => {
    expect(card).toContain('accessibilityHint="Swipe right to cook, swipe left to pass"');
  });
});

describe('deck controls', () => {
  test('undo is hidden rather than disabled when there is nothing to undo', () => {
    expect(controls).toContain('{canUndo ? (');
    expect(controls).not.toMatch(/disabled=\{!canUndo\}/);
  });

  test('every control meets the minimum touch target and adds hit slop', () => {
    expect(controls).toContain('const TOUCH = swipeTokens.a11y.minTouchTargetDp;');
    expect(controls).toContain('minWidth: TOUCH');
    expect(controls).toContain('minHeight: TOUCH');
    expect(controls).toContain('hitSlop={space.sm}');
  });

  test('reduced motion grows the buttons into the primary interaction', () => {
    expect(controls).toContain('actionTall');
    expect(deck).toContain('reduceMotion={reduceMotion}');
  });

  test('icon-only controls announce their action, not their glyph', () => {
    expect(controls).toContain('accessibilityRole="button"');
    expect(controls).toContain('accessibilityLabel={label}');
    expect(controls).toContain('importantForAccessibility="no"');
    expect(controls).toContain('label="Undo last pass"');
  });

  test('focus is shown with a two-point ring in the token colour', () => {
    expect(controls).toContain('borderWidth: swipeTokens.a11y.focusRingWidth');
    expect(controls).toContain('borderColor: swipeTokens.a11y.focusRingColor');
    expect(controls).toContain('onFocus={() => setFocused(true)}');
  });

  test('the empty deck offers recovery and draws no ghost card', () => {
    expect(controls).toContain('All caught up');
    expect(controls).toContain('We will refresh when you come back.');
    expect(controls).toContain('label="Refresh"');
    expect(controls).toContain('label="Log manually"');
    expect(controls).toContain('fontSize: space.xxxl');
    expect(controls).not.toMatch(/borderStyle: 'dashed'/);
  });
});

describe('detail sheet', () => {
  test('the macro panel is the first thing under the handle', () => {
    const body = sheet.slice(sheet.indexOf('<View style={styles.body}>'));
    expect(body.indexOf('<MacroSummary')).toBeLessThan(body.indexOf('<RowTitle>'));
  });

  test('the macro panel scales with servings eaten rather than servings made', () => {
    expect(sheet).toContain('Math.round(meal.kcalPerServing * servingsEaten)');
    expect(sheet).toContain('Math.round(grams * servingsEaten)');
  });

  test('macro dots reuse the app macro scheme so card and sheet agree', () => {
    for (const source of [card, sheet]) {
      expect(source).toContain('macroColor.protein');
      expect(source).toContain('macroColor.carbs');
      expect(source).toContain('macroColor.fat');
    }
  });

  test('held and missing ingredients are told apart by dot and by label', () => {
    expect(sheet).toContain('dotHeld');
    expect(sheet).toContain('dotMissing');
    expect(sheet).toContain('<Caption style={styles.missing}>Missing</Caption>');
    expect(sheet).toContain('missing: { color: swipeTokens.overlay.passColor }');
  });

  test('no ingredient row is ever collapsed behind a disclosure', () => {
    // No truncation, no disclosure — every row in `uses` and `missing` maps.
    expect(sheet).not.toMatch(/\.slice\(0,|showAll|expanded/);
    expect(sheet).toContain('meal.uses.map');
    expect(sheet).toContain('meal.missing.map');
  });

  test('steps are numbered large with room between blocks and no trailing rule', () => {
    expect(sheet).toContain('<MealCalories style={styles.stepNumber}>{index + 1}</MealCalories>');
    expect(sheet).toContain('steps: { gap: space.base }');
    expect(sheet).not.toContain('<Divider');
  });

  test('Cook it is the pinned primary and Pass is subordinate to it', () => {
    const footer = sheet.slice(sheet.indexOf('footer={'), sheet.indexOf('{meal ? ('));
    expect(footer.indexOf('label="Cook it"')).toBeLessThan(footer.indexOf('Pass</ButtonLabel>'));
    expect(footer).toContain('<ButtonLabel muted>Pass</ButtonLabel>');
    // A link, not a second button: no variant, no border, no fill.
    expect(footer).not.toContain("variant='secondary'");
    expect(footer).toContain('accessibilityLabel="Pass on this meal"');
  });

  test('both serving steppers are labelled with what they change', () => {
    expect(sheet).toContain('Scales what comes out of the pantry.');
    expect(sheet).toContain('Scales what is logged against today.');
    expect(sheet).toContain('label="Servings made"');
    expect(sheet).toContain('label="Servings eaten"');
  });
});

describe('sheet detents', () => {
  test('the two resting heights are half and nine tenths of the window', () => {
    expect(sheetShell).toContain('const COLLAPSED = 0.5;');
    expect(sheetShell).toContain('const EXPANDED = 0.9;');
    expect(sheetShell).toContain('useWindowDimensions()');
  });

  test('the drag runs on the UI thread and snaps to the nearer detent', () => {
    expect(sheetShell).toContain('.onUpdate((event) => {');
    expect(sheetShell).toContain('start.value - event.translationY');
    expect(sheetShell).toContain('Math.min(expanded, Math.max(collapsed,');
    expect(sheetShell).toContain('? expanded : collapsed');
  });

  test('release velocity can carry the sheet past the midpoint', () => {
    expect(sheetShell).toContain('event.velocityY * VELOCITY_PROJECTION_SECONDS');
  });

  test('reduced motion snaps by timing rather than spring', () => {
    expect(sheetShell).toContain('useReducedMotion()');
    expect(sheetShell).toContain('withTiming(to, { duration: duration.reduced })');
  });

  test('the handle is reachable without a gesture and meets the touch target', () => {
    expect(sheetShell).toContain('onPress={toggle}');
    expect(sheetShell).toContain('accessibilityLabel="Resize sheet"');
    expect(sheetShell).toContain('minHeight: swipeTokens.a11y.minTouchTargetDp');
  });

  test('the footer stays out of the scroll area at either height', () => {
    const shell = sheetShell.slice(sheetShell.indexOf('<ScrollView'));
    expect(shell.indexOf('</ScrollView>')).toBeLessThan(shell.indexOf('styles.footer'));
    expect(sheetShell).toContain('bodyFlexible: { flex: 1 }');
  });

  test('gestures inside the modal get their own handler root', () => {
    expect(sheetShell).toContain('<GestureHandlerRootView style={styles.root}>');
  });

  test('detents are opt-in, and only the cooking plan opts in', () => {
    expect(sheetShell).toContain('detents = false');
    expect(sheetShell).toContain("sheetByContent: { maxHeight: '88%' }");
    expect(sheet).toMatch(/title="Cooking plan"\s+detents/);

    const others = sourceFiles('src/components')
      .concat(sourceFiles('app'))
      // Exact paths: `endsWith('Sheet.tsx')` would excuse every sheet in the app.
      .filter((path) => path !== join('src', 'components', 'Sheet.tsx')
        && path !== join('src', 'components', 'suggestions', 'MealDetailSheet.tsx'));
    for (const path of others) {
      expect(readFileSync(path, 'utf8')).not.toMatch(/^\s+detents$/m);
    }
  });
});

describe('token discipline', () => {
  test('no swipe component carries a raw colour or font family', () => {
    for (const source of [card, controls, sheet]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/rgba?\(/);
      expect(source).not.toMatch(/fontFamily: '/);
    }
  });
});
