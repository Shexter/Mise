import { readThemePreference } from '@/constants/themePreference';
import { themePalettes } from '@/constants/themePalettes';
import type { DailyNutritionMetric } from '@/logic/dailyNutritionSummary';

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
