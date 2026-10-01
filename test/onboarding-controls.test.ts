import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { FIELD_GUIDANCE, GUIDANCE_FIELDS } from '@/copy/fieldGuidance';
import { computeAge, supportedBirthdayRange, todayCalendarDate, validateAge } from '@/logic/age';
import { cmToIn, inToCm, kgToLb, lbToKg, parseDecimalString, snapToNearest } from '@/logic/measurements';
import { AGE_RANGE, HEIGHT_RANGE_CM, WEIGHT_RANGE_KG } from '@/logic/onboardingDomain';

const birthday = readFileSync('src/components/onboarding/BirthdayPicker.tsx', 'utf8');
const measurement = readFileSync('src/components/onboarding/MeasurementPicker.tsx', 'utf8');
const formulaSex = readFileSync('src/components/onboarding/FormulaSexControl.tsx', 'utf8');
const scroller = readFileSync('src/components/onboarding/SnappedScroller.tsx', 'utf8');
const guidanceView = readFileSync('src/components/onboarding/FieldGuidance.tsx', 'utf8');

const TODAY = { year: 2026, month: 8, day: 20 };

/** User-facing copy only: a comment about a rule is not a breach of it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('field guidance copy', () => {
  test('every supported field has a purpose and an accepted input', () => {
    const expected = [
      'formula-sex', 'birthday', 'height', 'weight', 'body-fat',
      'dexa-measurement-date', 'dexa-lean-tissue', 'dexa-bone-mineral-content',
      'inbody-measurement-date', 'inbody-fat-free-mass', 'inbody-bmr',
    ];
    expect(GUIDANCE_FIELDS.sort()).toEqual(expected.sort());
    for (const field of GUIDANCE_FIELDS) {
      expect(FIELD_GUIDANCE[field].purpose.length, field).toBeGreaterThan(20);
      expect(FIELD_GUIDANCE[field].accepted.length, field).toBeGreaterThan(10);
    }
  });

  /**
   * The line this test defends: a calculation input may be described, but the
   * person may not be graded. "Healthy", "ideal", and "athletic range" turn a
   * number the user typed into a verdict the app is not entitled to deliver.
   */
  const FORBIDDEN = [
    'healthy', 'unhealthy', 'ideal', 'athletic', 'average', 'normal',
    'obese', 'overweight', 'underweight', 'excellent', 'poor', 'optimal',
    'good range', 'target range', 'should be', 'too high', 'too low',
  ];

  test.each(FORBIDDEN)('no guidance string grades a body with %s', (term) => {
    for (const field of GUIDANCE_FIELDS) {
      const copy = FIELD_GUIDANCE[field];
      const all = [copy.purpose, copy.accepted, copy.vocabulary ?? ''].join(' ').toLowerCase();
      expect(all, `${field}: ${term}`).not.toContain(term);
    }
  });

  test('ranges are quoted from the domain constants, never retyped', () => {
    const source = readFileSync('src/copy/fieldGuidance.ts', 'utf8');
    expect(source).toContain("from '@/logic/onboardingDomain'");
    expect(FIELD_GUIDANCE.height.accepted).toContain(String(HEIGHT_RANGE_CM.min));
    expect(FIELD_GUIDANCE.height.accepted).toContain(String(HEIGHT_RANGE_CM.max));
    expect(FIELD_GUIDANCE.weight.accepted).toContain(String(WEIGHT_RANGE_KG.min));
    expect(FIELD_GUIDANCE.birthday.accepted).toContain(String(AGE_RANGE.min));
  });

  test('report fields carry the report own vocabulary', () => {
    expect(FIELD_GUIDANCE['inbody-fat-free-mass'].vocabulary).toContain('Fat Free Mass');
    expect(FIELD_GUIDANCE['dexa-lean-tissue'].vocabulary).toContain('Lean Tissue');
    expect(FIELD_GUIDANCE['dexa-bone-mineral-content'].vocabulary).toContain('Bone Mineral Content');
  });

  test('the guidance view only spends theme tokens', () => {
    expect(guidanceView).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(guidanceView).not.toMatch(/fontSize: \d/);
  });
});

describe('birthday confirmation', () => {
  test('a confirmed birthday yields an age, and the range boundaries are reachable', () => {
    const { earliest, latest } = supportedBirthdayRange(TODAY);
    expect(computeAge(latest.year, latest.month, latest.day, TODAY)).toBe(AGE_RANGE.min);
    expect(validateAge(computeAge(earliest.year, earliest.month, earliest.day, TODAY))).toBe(true);
  });

  test('a day beyond either boundary is not a supported age', () => {
    const { earliest, latest } = supportedBirthdayRange(TODAY);
    expect(validateAge(computeAge(latest.year, latest.month, latest.day + 1, TODAY))).toBe(false);
    expect(validateAge(computeAge(earliest.year, earliest.month, earliest.day - 1, TODAY))).toBe(false);
  });

  test('the picker emits the age and never the date', () => {
    expect(birthday).toContain('onConfirm: (age: number) => void');
    expect(birthday).toContain('if (valid) onConfirm(age);');
    // No path hands a year, month, day, or date object to the caller.
    expect(birthday).not.toMatch(/onConfirm\((?!age\))/);
    expect(birthday).not.toMatch(/onConfirm\(birthday/);
  });

  test('the live report is an age too, and an untouched picker stays silent', () => {
    expect(birthday).toContain('onAgeChange?: (age: number | null) => void');
    expect(birthday).toContain('if (!touched) return;');
    expect(birthday).toContain('onAgeChange?.(valid ? age : null);');
    // Same contract as onConfirm: a number leaves, a date never does.
    expect(birthday).not.toMatch(/onAgeChange\?\.\((?!valid \? age)/);
  });

  test('nothing is emitted until Confirm, and never on cancel', () => {
    expect(birthday).toContain('onCancel?: () => void');
    const cancel = birthday.slice(birthday.indexOf('onCancel ?'));
    expect(cancel.slice(0, 120)).not.toContain('onConfirm');
  });

  test('confirm is blocked for a date outside the supported age range', () => {
    expect(birthday).toContain('const valid = isValidCalendarDate(birthday) && validateAge(age)');
    expect(birthday).toContain('disabled={!valid}');
    expect(birthday).toContain('outside the supported range');
  });

  test('the day column shortens with the month rather than offering a bad date', () => {
    expect(birthday).toContain('value <= daysInMonth(year, month)');
    expect(birthday).toContain('Math.min(day, daysInMonth(year, month))');
  });
});

describe('measurement conversion parity', () => {
  test('metric and imperial round-trip without drift over repeated switches', () => {
    let kg = 72.35;
    let cm = 173.4;
    for (let index = 0; index < 50; index += 1) {
      kg = lbToKg(kgToLb(kg));
      cm = inToCm(cmToIn(cm));
    }
    expect(kg).toBeCloseTo(72.35, 8);
    expect(cm).toBeCloseTo(173.4, 8);
  });

  test('range boundaries are accepted and outliers are reported, not clamped', () => {
    expect(parseDecimalString(String(WEIGHT_RANGE_KG.min), WEIGHT_RANGE_KG))
      .toEqual({ ok: true, value: WEIGHT_RANGE_KG.min });
    expect(parseDecimalString(String(WEIGHT_RANGE_KG.max), WEIGHT_RANGE_KG))
      .toEqual({ ok: true, value: WEIGHT_RANGE_KG.max });
    expect(parseDecimalString('1000', WEIGHT_RANGE_KG)).toEqual({ ok: false, reason: 'out-of-range' });
  });

  test('typed decimals survive the snap grid', () => {
    expect(parseDecimalString('72.35', WEIGHT_RANGE_KG)).toEqual({ ok: true, value: 72.35 });
    expect(snapToNearest(72.35, 0.5)).toBe(72.5);
  });
});

describe('measurement picker anchoring', () => {
  test('a fresh control opens on the anchor without answering', () => {
    expect(measurement).toContain('value === null ? anchorMeasurement(anchor) : seedMeasurement(value, origin)');
    expect(measurement).toContain('Not set yet');
  });

  test('onConfirm fires only once the value is actually answered', () => {
    expect(measurement).toContain('if (next.confirmed && next.value !== null) onConfirm(next.value, outOfRange);');
    // Exactly one emission path in the whole file.
    expect(measurement.match(/onConfirm\(/g) ?? []).toHaveLength(1);
  });

  test('a typed value answers as it is typed, against the same bounds', () => {
    // The field commits through settle() rather than waiting for the return
    // key, so the caller's Continue lights up while the keyboard is still up.
    expect(measurement).toContain('onChangeText={typeInto}');
    expect(measurement).toContain('if (parsed.ok) settle(adjustMeasurement(state, toCanonical(parsed.value, kind, unit)));');
    // One set of bounds for typing and for submitting — never two.
    expect(measurement.match(/parseDecimalString\((?:text|typed), displayBounds\)/g) ?? []).toHaveLength(2);
    expect(measurement).toContain('min: toDisplay(range.min, kind, unit), max: toDisplay(range.max, kind, unit)');
    // A half-typed number is not yet an error.
    expect(measurement).toContain('setTypedError(null);');
  });

  test('the explicit confirm action is offered only while unanswered', () => {
    expect(measurement).toContain('{answered ? null : (');
    expect(measurement).toContain('label={`Use ${formatDisplay(positionDisplay, kind, unit)} ${units}`}');
  });

  test('conversion always runs from the canonical value, never display to display', () => {
    expect(measurement).toContain('One canonical metric value in, one display number out');
    expect(measurement).toContain('function toCanonical(');
    expect(measurement).toContain('toCanonical(display, kind, unit)');
  });

  test('an out-of-range entry is reported to the caller rather than clamped', () => {
    expect(measurement).toContain('allowOutOfRange');
    expect(measurement).toContain('// Reported, not clamped');
    expect(measurement).not.toMatch(/Math\.min\(range\.max/);
    expect(measurement).not.toMatch(/Math\.max\(range\.min/);
  });

  test('switching units re-renders the same measurement, it does not reset', () => {
    expect(measurement).toContain('onUnitChange?: (unit: Units) => void');
    // The unit toggle changes only the display; state holds the canonical value.
    const segmented = measurement.slice(measurement.indexOf('<Segmented'), measurement.indexOf('</View>'));
    expect(segmented).not.toContain('setState');
    expect(segmented).not.toContain('anchorMeasurement');
  });
});

describe('formula sex control', () => {
  test('neither option is preselected', () => {
    expect(formulaSex).toContain('value: Sex | null');
    expect(formulaSex).toContain('Null until answered');
    expect(formulaSex).not.toMatch(/value=\{value \?\? '(male|female)'\}/);
    expect(formulaSex).not.toMatch(/useState<Sex>\('(male|female)'\)/);
  });

  test('the copy names the formula rather than the person', () => {
    expect(formulaSex).toContain('Mifflin-St Jeor');
    expect(FIELD_GUIDANCE['formula-sex'].purpose).toContain('Mifflin-St Jeor');
    // What the person actually reads — comments explaining the rule are not it.
    const visible = [
      ...stripComments(formulaSex).matchAll(/(?:label|detail): '([^']+)'/g),
    ].map((match) => match[1]);
    expect(visible).toContain('Male');
    const all = [...visible, FIELD_GUIDANCE['formula-sex'].purpose, FIELD_GUIDANCE['formula-sex'].accepted]
      .join(' ')
      .toLowerCase();
    for (const term of ['gender', 'identity', 'identify as', 'sex assigned', 'born as']) {
      expect(all, term).not.toContain(term);
    }
  });

  test('it is an accessible radio group', () => {
    expect(formulaSex).toContain('accessibilityRole="radiogroup"');
  });
});

describe('control accessibility floor', () => {
  test('the scroller is operable without scrolling at all', () => {
    expect(scroller).toContain('accessibilityRole="adjustable"');
    expect(scroller).toContain("{ name: 'increment' as const, label: 'Increase' }");
    expect(scroller).toContain("{ name: 'decrement' as const, label: 'Decrease' }");
    expect(scroller).toContain('onAccessibilityAction={onAction}');
    // Every tick is also directly tappable.
    expect(scroller).toContain('onPress={() => onSelectIndex(index)}');
  });

  test('the announced value carries its unit and accepted range', () => {
    expect(scroller).toContain('accessibilityValue={{ text:');
    expect(scroller).toContain('rangeHint');
    expect(measurement).toContain('rangeHint={`${formatDisplay(displayRange.min, kind, unit)}');
  });

  test('ticks meet the touch target and reduced motion snaps immediately', () => {
    expect(scroller).toContain('const TICK_VERTICAL = layout.minTouchTarget;');
    expect(scroller).toContain('scrollTo(selectedIndex, !reduceMotion)');
    expect(scroller).toContain('useReducedMotion()');
  });

  test('the controls carry no haptics and no raw colour', () => {
    for (const source of [scroller, measurement, birthday, formulaSex]) {
      expect(source).not.toContain('expo-haptics');
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/rgba?\(/);
    }
  });

  test('typed entry is offered beside every numeric picker', () => {
    expect(measurement).toContain('label={`Or type it in (${units})`}');
    expect(measurement).toContain("keyboardType=\"decimal-pad\"");
  });
});
