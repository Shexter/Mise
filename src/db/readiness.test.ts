import { describe, expect, test, vi } from 'vitest';

import { createDatabaseReadinessController } from '@/db/readiness';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}

describe('database readiness', () => {
  test('a delayed open remains opening until the whole attempt resolves', async () => {
    const gate = deferred();
    const controller = createDatabaseReadinessController();
    const opening = controller.initialise(() => gate.promise);
    expect(controller.getSnapshot()).toMatchObject({ phase: 'opening', attempt: 1 });
    gate.resolve();
    await opening;
    expect(controller.getSnapshot()).toMatchObject({ phase: 'ready', attempt: 1 });
  });

  test('rejection becomes unavailable and retry creates a new successful attempt', async () => {
    const controller = createDatabaseReadinessController();
    await controller.initialise(() => Promise.reject(new Error('migration failed')));
    expect(controller.getSnapshot()).toMatchObject({ phase: 'unavailable', attempt: 1 });
    await controller.retry(() => Promise.resolve());
    expect(controller.getSnapshot()).toEqual({ phase: 'ready', attempt: 2, error: null });
  });

  test('concurrent callers share one attempt', async () => {
    const gate = deferred();
    const work = vi.fn(() => gate.promise);
    const controller = createDatabaseReadinessController();
    const first = controller.initialise(work);
    const second = controller.initialise(work);
    expect(first).toBe(second);
    expect(work).toHaveBeenCalledTimes(1);
    gate.resolve();
    await first;
  });

  test('subscribers observe unavailable then retry-pending', async () => {
    const controller = createDatabaseReadinessController();
    const phases: string[] = [];
    controller.subscribe(() => phases.push(controller.getSnapshot().phase));
    await controller.initialise(() => Promise.reject(new Error('open failed')));
    const retry = deferred();
    const pending = controller.retry(() => retry.promise);
    expect(phases).toEqual(['opening', 'unavailable', 'opening']);
    retry.resolve();
    await pending;
  });
});
