import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

describe('user-owned editing coverage', () => {
  test('keeps every persisted user-created record in the edit inventory', () => {
    const matrix = readFileSync('docs/editing-coverage.md', 'utf8');
    for (const record of ['Pantry item', 'Logged meal', 'Saved recipe', 'Capture result', 'Shopping item', 'Profile/preferences']) {
      expect(matrix).toContain(`| ${record} |`);
    }
  });
});
