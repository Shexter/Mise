import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const source = readFileSync('src/db/index.ts', 'utf8');

describe('database opening lifecycle contract', () => {
  test('shared attempt is cleared in finally and partial handles close on failure', () => {
    expect(source).toContain('if (opening) return opening');
    expect(source).toMatch(/finally \{\s*opening = null;/);
    expect(source).toContain('database = null');
    expect(source).toContain('await handle.closeAsync()');
  });

  test('database publication follows migration and is revoked before retry', () => {
    expect(source.indexOf('await migrate(handle)')).toBeLessThan(source.indexOf('database = handle'));
    expect(source).toContain('__resetDatabaseLifecycleForTests');
  });
});
