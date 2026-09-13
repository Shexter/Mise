import { useCallback } from 'react';

import { useToast } from '@/components/Toast';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import type { PlannerDraft } from '@/types';

/**
 * One place where an edited draft becomes a saved plan.
 *
 * The order matters and is the whole point: the draft is preserved first, then
 * the schedule is written. If the write fails the draft survives, the last
 * committed schedule stays on screen, and the person is told the change did not
 * save — they never see a success message for something that is not stored.
 */
export function usePlannerCommit() {
  const toast = useToast();
  const updateDraft = useMealScheduleStore((state) => state.updateDraft);
  const save = useMealScheduleStore((state) => state.save);

  return useCallback(async (draft: PlannerDraft, message: string) => {
    await updateDraft(draft);
    await save();
    const { status, error } = useMealScheduleStore.getState();
    if (status === 'error') {
      toast.show({
        kind: 'recoverable-error',
        message: error ?? "Couldn't save this change. Your edit is kept.",
        actionLabel: 'Retry',
        onAction: () => void save(),
        durationMs: 6_000,
      });
      return false;
    }
    toast.show({ kind: 'success', message });
    return true;
  }, [updateDraft, save, toast]);
}
