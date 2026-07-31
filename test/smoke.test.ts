import { expect, test } from 'vitest';

import { closeTestDatabase, db, openTestDatabase } from './stubs/db';

test('the runner runs', () => {
  expect(1 + 1).toBe(2);
});

test('the node:sqlite stub opens and answers queries', async () => {
  openTestDatabase();
  const row = await db().getFirstAsync<{ answer: number }>('SELECT 42 AS answer');
  expect(row?.answer).toBe(42);
  closeTestDatabase();
});
