import { useSyncExternalStore } from 'react';

export type DatabasePhase = 'opening' | 'ready' | 'unavailable';

export interface DatabaseReadiness {
  phase: DatabasePhase;
  attempt: number;
  error: unknown | null;
}

export interface DatabaseReadinessController {
  getSnapshot: () => DatabaseReadiness;
  subscribe: (listener: () => void) => () => void;
  initialise: (work: () => Promise<void>) => Promise<void>;
  retry: (work: () => Promise<void>) => Promise<void>;
  resetForTests: () => void;
}

export function createDatabaseReadinessController(): DatabaseReadinessController {
  let state: DatabaseReadiness = { phase: 'opening', attempt: 0, error: null };
  let active: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: DatabaseReadiness) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const start = (work: () => Promise<void>, force: boolean): Promise<void> => {
    if (active) return active;
    if (!force && state.phase === 'ready') return Promise.resolve();
    const attempt = state.attempt + 1;
    publish({ phase: 'opening', attempt, error: null });
    active = work()
      .then(() => publish({ phase: 'ready', attempt, error: null }))
      .catch((error: unknown) => publish({ phase: 'unavailable', attempt, error }))
      .finally(() => { active = null; });
    return active;
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    initialise: (work) => start(work, false),
    retry: (work) => start(work, true),
    resetForTests: () => { active = null; state = { phase: 'opening', attempt: 0, error: null }; listeners.clear(); },
  };
}

export const databaseReadiness = createDatabaseReadinessController();

export function useDbReadiness(): DatabaseReadiness {
  return useSyncExternalStore(databaseReadiness.subscribe, databaseReadiness.getSnapshot, databaseReadiness.getSnapshot);
}
