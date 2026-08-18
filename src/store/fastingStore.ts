import { create } from 'zustand';

import { endFast, getActiveFast, listFastHistory, startFast } from '@/db/queries';
import type { Fast } from '@/types';

type Status = 'idle' | 'loading' | 'ready' | 'saving';

interface FastingState {
  status: Status;
  activeFast: Fast | null;
  history: Fast[];
  error: string | null;
  refresh: () => Promise<void>;
  start: (targetDurationMinutes: number | null) => Promise<void>;
  end: () => Promise<void>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Fasting history could not be updated.';
}

export const useFastingStore = create<FastingState>((set, get) => ({
  status: 'idle',
  activeFast: null,
  history: [],
  error: null,

  refresh: async () => {
    set({ status: 'loading', error: null });
    try {
      const [activeFast, history] = await Promise.all([
        getActiveFast(),
        listFastHistory(),
      ]);
      set({ activeFast, history, status: 'ready' });
    } catch (error) {
      set({ status: 'ready', error: messageOf(error) });
    }
  },

  start: async (targetDurationMinutes) => {
    set({ status: 'saving', error: null });
    try {
      await startFast(targetDurationMinutes);
      await get().refresh();
    } catch (error) {
      set({ status: 'ready', error: messageOf(error) });
    }
  },

  end: async () => {
    set({ status: 'saving', error: null });
    try {
      await endFast();
      await get().refresh();
    } catch (error) {
      set({ status: 'ready', error: messageOf(error) });
    }
  },
}));
