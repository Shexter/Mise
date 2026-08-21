import { readThemePreference } from '@/constants/themePreference';
import { readableOn } from '@/logic/contrast';
import { themePalettes } from '@/constants/themePalettes';
import type { DailyNutritionMetric } from '@/logic/dailyNutritionSummary';
import type { ViewStyle } from 'react-native';

/**
 * The single source of truth for colour, type, space, shape and motion.
 *
 * Nothing outside this file should contain a hex value, a font family string, or
 * an off-scale spacing number. `npm run typecheck` will not catch a stray `#fff`,
 * so the rule is enforced by review — see README, "Design system".
 */

/** Resolved before module-level StyleSheets are created. */
export const themeId = readThemePreference();
export const color = themePalettes[themeId];

export type ColorToken = keyof typeof color;

/**
 * Colours used only behind the live camera and its full-bleed overlays. These
 * are the one context where the warm ground would fight the viewfinder, so a
 * true black backdrop and ink-tinted scrims are used instead — kept here so no
 * component carries a raw hex value.
 */
export const camera = {
  backdrop: '#000000',
  /** Circular control buttons over the viewfinder. */
  controlScrim: 'rgba(28, 26, 23, 0.5)',
  /** "Preparing your photo" cover on the capture screen. */
  overlayScrim: 'rgba(28, 26, 23, 0.55)',
  /** "Reading your plate" cover on the review screen. */
  analyzingScrim: 'rgba(28, 26, 23, 0.6)',
} as const;

/** Macro colours reuse the app's intentionally small chromatic system. */
export const macroColor = {
  protein: color.paprika,
  carbs: color.wheat,
  fat: color.olive,
  fibre: color.ink,
} as const;

/** A dedicated, per-theme-validated categorical palette for the five daily nutrition metrics. */
export const metricColor: Record<DailyNutritionMetric, string> = {
  energy: color.chart1,
  protein: color.chart2,
  carbohydrate: color.chart3,
  fat: color.chart4,
  fibre: color.chart5,
};

export const font = {
  /** Display serif. Large numerals only — never below 22px. */
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  /** Everything else. Never above 22px. */
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
} as const;

/**
 * Type roles from the design spec. Tracking is expressed in points, already
 * resolved from the percentages in the spec at each size.
 */
export const type = {
  hero: {
    fontFamily: font.display,
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: -1.44,
  },
  mealCalories: {
    fontFamily: font.displayMedium,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.22,
  },
  screenTitle: {
    fontFamily: font.semibold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.42,
  },
  sectionLabel: {
    fontFamily: font.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  rowTitle: {
    fontFamily: font.medium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  button: {
    fontFamily: font.semibold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
  },
} as const;

export type TypeRole = keyof typeof type;

/** Applied to every number that updates in place. Non-negotiable. */
export const tabularNums = {
  fontVariant: ['tabular-nums'] as ('tabular-nums')[],
};

/** `position: absolute` filling the parent. Spreadable, unlike `absoluteFill`. */
export const fillParent = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

/** Spacing scale. Nothing off-scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const layout = {
  screenGutter: 20,
  cardPadding: space.base,
  minRowHeight: 64,
  minTouchTarget: 44,
  /**
   * Widest a single column of reading and form content is allowed to get.
   * A phone never reaches it; a desktop browser would otherwise stretch one
   * paragraph across the whole viewport.
   */
  contentMaxWidth: 560,
  dayRailHeight: 72,
  nutritionChartHeight: 192,
  nutritionChartPoint: 12,
  nutritionChartStrokeWidth: 2,
} as const;

export const radius = {
  /** Inputs and chips. */
  input: 8,
  /** Cards and sheets. */
  card: 16,
  /** The FAB, and nothing else. */
  full: 999,
} as const;

/** The only shadow in the app. No stacking, no glow, no default elevation. */
export const elevation = {
  shadowColor: color.ink,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
} as const;

export const duration = {
  /** Every transition that is not the save sequence. */
  quick: 180,
  /** The new Day Rail segment scaling in. */
  segment: 400,
  /** The hero figure counting to its new value. */
  count: 600,
  /** Ceiling when Reduce Motion is on. */
  reduced: 160,
} as const;

/** Translate distance for the standard 180ms enter transition. */
export const motionOffset = 4;

export const opacity = {
  /** Going over target renders in ink at reduced opacity, never in red. */
  over: 0.55,
  disabled: 0.4,
  pressed: 0.7,
} as const;

/**
 * The chart and spice colours are mid-luminance: they were chosen to sit
 * beside each other in a chart, not to carry text. On several of them neither
 * `onAction` nor `ink` reaches the 4.5:1 body-text ratio, so a filled badge
 * needs a text colour drawn from beyond the palette's own range.
 *
 * These two are the only such values, and they exist for exactly this reason.
 * Whichever reads more clearly on a given fill wins, measured rather than
 * assumed — the palettes run from cream to near-black, so the answer differs
 * per theme. `test/swipe-deck-ui.test.ts` holds every fill in every theme to
 * 4.5:1, so a new palette cannot land below AA unnoticed.
 */
export const badgeTextCandidates = ['#0B0A09', '#FFFFFF'] as const;

function badgeText(fill: string): string {
  return readableOn(fill, badgeTextCandidates);
}

/** The swipe-deck visual and motion contract. Components consume no raw values. */
export const swipeTokens = {
  card: {
    borderRadius: 20,
    titleFontSize: 22,
    titleLineHeight: 26,
    shadowAmbientColor: color.ink,
    shadowKeyColor: color.ink,
    shadowAmbientRadius: 8,
    shadowKeyRadius: 20,
    shadowKeyOffsetY: 6,
  },
  overlay: {
    cookColor: color.chart3,
    passColor: color.paprika,
    stampFontSize: 36,
    stampFontWeight: '800' as const,
    stampLetterSpacing: 0.14,
  },
  badge: {
    exactFitBg: color.chart3,
    fitsBudgetBg: color.chart5,
    overBudgetBg: color.paprika,
    estimatedBg: color.wheat,
    /** @deprecated Use the per-fill text tokens below — see `badgeText`. */
    textColor: color.onAction,
    exactFitText: badgeText(color.chart3),
    fitsBudgetText: badgeText(color.chart5),
    overBudgetText: badgeText(color.paprika),
    estimatedText: badgeText(color.wheat),
    /** For the neutral fill used when no daily target has been set. */
    neutralText: badgeText(color.line),
  },
  motion: {
    exitDurationMs: 300,
    exitRotationDeg: 15,
    scaleFrom: 0.95,
    scaleTo: 1,
    springStiffness: 220,
    springDamping: 22,
    reducedFadeDurationMs: 150,
  },
  a11y: {
    minTouchTargetDp: 44,
    focusRingWidth: 2,
    focusRingColor: color.action,
  },
} as const;

export function cardShadowStyle(level: 1 | 2 | 3): ViewStyle {
  // Lazy loading keeps this token module usable by pure Node tests while the
  // helper still delegates native selection to React Native at render time.
  const { Platform } = require('react-native') as typeof import('react-native');
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: swipeTokens.card.shadowKeyColor,
      shadowOffset: { width: 0, height: level * 2 },
      shadowOpacity: 0.12 + level * 0.04,
      shadowRadius: level * 6,
    },
    android: { elevation: level * 4 },
    default: {},
  }) ?? {};
}
