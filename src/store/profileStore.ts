import { create } from 'zustand';

import { getProfile, saveProfile } from '@/db/queries';
import { energyTargets } from '@/logic/bmr';
import { DEFAULT_SPLIT } from '@/logic/macros';
import type { Profile } from '@/types';

type Status = 'idle' | 'loading' | 'ready';

interface ProfileState {
  status: Status;
  profile: Profile | null;
  load: () => Promise<void>;
  /** Writes the profile as given. Used at the end of onboarding. */
  create: (profile: Profile) => Promise<void>;
  /**
   * Applies a partial edit and recalculates the calorie target. Past days keep
   * the target that was active at the time — see `ensureDailyTarget`.
   */
  update: (patch: Partial<Profile>) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  status: 'idle',
  profile: null,

  load: async () => {
    set({ status: 'loading' });
    const profile = await getProfile();
    set({ profile, status: 'ready' });
  },

  create: async (profile) => {
    await saveProfile(profile);
    set({ profile, status: 'ready' });
  },

  update: async (patch) => {
    const current = get().profile;
    if (!current) return;

    const merged: Profile = { ...current, ...patch };
    const recalculated: Profile = {
      ...merged,
      targetCalories: energyTargets(
        {
          sex: merged.sex,
          age: merged.age,
          heightCm: merged.heightCm,
          weightKg: merged.weightKg,
        },
        merged.activityLevel,
        merged.goal,
      ).target,
    };

    await saveProfile(recalculated);
    set({ profile: recalculated });
  },
}));

/** A profile with the default split, ready to be filled in by onboarding. */
export function draftProfile(): Omit<
  Profile,
  'sex' | 'age' | 'heightCm' | 'weightKg' | 'activityLevel' | 'goal' | 'targetCalories'
> {
  return {
    proteinPct: DEFAULT_SPLIT.proteinPct,
    carbsPct: DEFAULT_SPLIT.carbsPct,
    fatPct: DEFAULT_SPLIT.fatPct,
    units: 'metric',
    onboardedAt: new Date().toISOString(),
  };
}
