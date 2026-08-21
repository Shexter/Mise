import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const sex = readFileSync('app/onboarding/sex.tsx', 'utf8');
const age = readFileSync('app/onboarding/age.tsx', 'utf8');
const height = readFileSync('app/onboarding/height.tsx', 'utf8');
const weight = readFileSync('app/onboarding/weight.tsx', 'utf8');
const profileSheet = readFileSync('src/components/settings/ProfileSheet.tsx', 'utf8');

const STEPS = [
  { name: 'sex', source: sex, next: '/onboarding/age' },
  { name: 'age', source: age, next: '/onboarding/height' },
  { name: 'height', source: height, next: '/onboarding/weight' },
  { name: 'weight', source: weight, next: '/onboarding/activity' },
];

describe('estimated path shape', () => {
  test.each(STEPS)('$name still routes to $next', ({ source, next }) => {
    expect(source).toContain(`router.push('${next}')`);
  });

  test('each step is still one screen with one Continue', () => {
    for (const { name, source } of STEPS) {
      expect(source.match(/<StepShell/g) ?? [], name).toHaveLength(1);
      expect(source, name).toContain('primaryLabel="Continue"');
      expect(source.match(/router\.push\(/g) ?? [], name).toHaveLength(1);
    }
  });

  test('no scan question was added to the estimated path', () => {
    for (const { name, source } of STEPS) {
      for (const term of ['dexa', 'inbody', 'scan', 'photo', 'camera', 'api key', 'apiKey']) {
        expect(source.toLowerCase(), `${name}: ${term}`).not.toContain(term);
      }
    }
  });
});

describe('nothing is written before it is answered', () => {
  test.each(STEPS)('$name disables Continue until confirmed', ({ source }) => {
    expect(source).toMatch(/primaryDisabled=\{(sex === null|age === null|confirmed === null)\}/);
  });

  test('the draft is written on Continue, never on render or on scroll', () => {
    for (const { name, source } of [STEPS[1]!, STEPS[2]!, STEPS[3]!]) {
      // The only `set({ ... })` with a value is inside onPrimary.
      const onPrimary = source.slice(source.indexOf('onPrimary={'), source.indexOf('</StepShell>'));
      expect(onPrimary, name).toContain('set({');
      const outside = source.replace(onPrimary, '');
      expect(outside.match(/set\(\{ (age|heightCm|weightKg)/g) ?? [], name).toHaveLength(0);
    }
  });

  test('an anchor is never what gets stored', () => {
    for (const source of [height, weight]) {
      expect(source).toContain('anchor={');
      // The anchor goes to the control as a cursor position, and nowhere else.
      expect(source).not.toMatch(/set\(\{ (heightCm|weightKg): [A-Z_]*ANCHOR/);
    }
  });
});

describe('back navigation restores what was answered', () => {
  test.each([
    { name: 'sex', source: sex, field: 'state.sex' },
    { name: 'age', source: age, field: 'state.age' },
    { name: 'height', source: height, field: 'state.heightCm' },
    { name: 'weight', source: weight, field: 'state.weightKg' },
  ])('$name seeds from the stored draft', ({ source, field }) => {
    expect(source).toContain(field);
  });

  test('height and weight seed the control itself, not just the local flag', () => {
    expect(height).toContain('value={heightCm ?? null}');
    expect(weight).toContain('value={weightKg ?? null}');
  });
});

describe('the birth date never becomes stored data', () => {
  test('the age step stores an integer and nothing else', () => {
    expect(age).toContain('set({ age })');
    expect(age).not.toMatch(/set\(\{[^}]*(year|month|day|birth)/i);
  });

  test('no onboarding step keeps a date tuple in local state either', () => {
    for (const { name, source } of STEPS) {
      // Naming the picker is fine; holding year/month/day up here is not.
      expect(source, name).not.toMatch(/useState[^\n]*(year|month|day)/i);
      expect(source, name).not.toMatch(/birthDate|dateOfBirth/i);
    }
    // The route holds one number, and the picker hands back one number.
    expect(age.match(/useState</g) ?? []).toHaveLength(1);
    expect(age).toContain('useState<number | null>(stored ?? null)');
    expect(age).toContain('<BirthdayPicker onConfirm={setAge} />');
  });

  test('Settings does not reconstruct a birthday from the saved age', () => {
    expect(profileSheet).toContain('there is no date to put back into the picker');
    expect(profileSheet).not.toMatch(/new Date\([^)]*profile\.age/);
    expect(profileSheet).not.toMatch(/year: .*- profile\.age/);
  });
});

describe('Settings seeds from saved values, not anchors', () => {
  test('each reused control is handed the persisted value', () => {
    expect(profileSheet).toContain('value={profile.heightCm}');
    expect(profileSheet).toContain('value={profile.weightKg}');
    expect(profileSheet).toContain('useState<Sex | null>(profile.sex)');
  });

  test('the formula constant is no longer defaulted to one of the two options', () => {
    expect(profileSheet).not.toContain("profile.sex ?? 'female'");
    expect(profileSheet).not.toContain("profile.sex ?? 'male'");
  });

  test('every editor writes only inside its own Save press', () => {
    const saves = profileSheet.match(/onSave\(/g) ?? [];
    const inPress = profileSheet.match(/onPress=\{\(\) => \{[\s\S]{0,220}?onSave\(/g) ?? [];
    expect(inPress.length).toBe(saves.length);
  });
});
