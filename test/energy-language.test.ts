import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const files = [
  'app/onboarding/energy.tsx',
  'src/logic/bodyComposition.ts',
  'app/(tabs)/settings.tsx',
  'src/components/settings/ProfileSheet.tsx',
];
const forbidden = ['diagnosis', 'assessment', 'health claim', 'fitness', 'progress'];

test('energy-source copy does not evaluate the user', () => {
  const addedCopy = files.map((file) => readFileSync(resolve(process.cwd(), file), 'utf8').toLowerCase()).join('\n');
  for (const word of forbidden) expect(addedCopy).not.toContain(word);
});
