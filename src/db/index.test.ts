import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  seed: vi.fn(),
}));

vi.mock('expo-sqlite', () => ({ openDatabaseAsync: mocks.open }));
vi.mock('@/db/queries', () => ({ loadSeedData: mocks.seed }));

import { __resetDatabaseLifecycleForTests, db, openDatabase } from './index';

interface FakeHandle {
  execAsync: ReturnType<typeof vi.fn>;
  getFirstAsync: ReturnType<typeof vi.fn>;
  withExclusiveTransactionAsync: ReturnType<typeof vi.fn>;
  closeAsync: ReturnType<typeof vi.fn>;
}

function handle(version = Number.MAX_SAFE_INTEGER): FakeHandle {
  return {
    execAsync: vi.fn().mockResolvedValue(undefined),
    getFirstAsync: vi.fn().mockResolvedValue({ user_version: version }),
    withExclusiveTransactionAsync: vi.fn(async (work: (txn: { execAsync: ReturnType<typeof vi.fn> }) => Promise<void>) => {
      await work({ execAsync: vi.fn().mockResolvedValue(undefined) });
    }),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  await __resetDatabaseLifecycleForTests();
  mocks.open.mockReset();
  mocks.seed.mockReset().mockResolvedValue(undefined);
});

describe('database open attempt', () => {
  test('concurrent callers share a delayed attempt with no timeout-as-success', async () => {
    const gate = deferred<FakeHandle>();
    mocks.open.mockReturnValue(gate.promise);
    const first = openDatabase();
    const second = openDatabase();
    expect(first).toBe(second);
    expect(mocks.open).toHaveBeenCalledTimes(1);
    expect(() => db()).toThrow('Database used before it was opened.');
    const opened = handle();
    gate.resolve(opened);
    await expect(first).resolves.toBe(opened);
  });

  test('a rejected open can be retried successfully', async () => {
    const opened = handle();
    mocks.open.mockRejectedValueOnce(new Error('open failed')).mockResolvedValueOnce(opened);
    await expect(openDatabase()).rejects.toThrow('open failed');
    await expect(openDatabase()).resolves.toBe(opened);
    expect(mocks.open).toHaveBeenCalledTimes(2);
  });

  test('a seed failure closes and hides the partial handle before retry', async () => {
    const partial = handle();
    const recovered = handle();
    mocks.open.mockResolvedValueOnce(partial).mockResolvedValueOnce(recovered);
    mocks.seed.mockRejectedValueOnce(new Error('seed failed')).mockResolvedValueOnce(undefined);

    await expect(openDatabase()).rejects.toThrow('seed failed');
    expect(partial.closeAsync).toHaveBeenCalledOnce();
    expect(() => db()).toThrow('Database used before it was opened.');
    await expect(openDatabase()).resolves.toBe(recovered);
  });

  test('the handle is not published until seed completion', async () => {
    const opened = handle();
    const seed = deferred<void>();
    mocks.open.mockResolvedValue(opened);
    mocks.seed.mockReturnValue(seed.promise);
    const attempt = openDatabase();
    await vi.waitFor(() => expect(mocks.seed).toHaveBeenCalledOnce());
    expect(() => db()).toThrow('Database used before it was opened.');
    seed.resolve();
    await attempt;
    expect(db()).toBe(opened);
  });
});
