import { create } from 'zustand';

import {
  getCookingPreferences,
  getOwnedApplianceIds,
  getOwnedAppliances,
  saveCookingPreferences,
  saveOwnedAppliances,
  setApplianceOwnership,
} from '@/db/queries';
import type { ApplianceId, CookingPreferences, OwnedAppliance } from '@/types';

type Status = 'idle' | 'loading' | 'ready';

interface CookingPreferencesState {
  status: Status;
  cookingPreferences: CookingPreferences | null;
  ownedAppliances: readonly OwnedAppliance[];
  ownedApplianceIds: ReadonlySet<ApplianceId>;
  load: () => Promise<void>;
  savePreferences: (patch: Partial<CookingPreferences>) => Promise<void>;
  setAppliance: (applianceId: ApplianceId, owned: boolean) => Promise<void>;
  saveAppliances: (appliances: readonly { applianceId: ApplianceId; owned: boolean }[]) => Promise<void>;
  completeMealPrep: () => Promise<void>;
  deferMealPrep: () => Promise<void>;
}

export const useCookingPreferencesStore = create<CookingPreferencesState>((set, get) => ({
  status: 'idle',
  cookingPreferences: null,
  ownedAppliances: [],
  ownedApplianceIds: new Set<ApplianceId>(),

  load: async () => {
    set({ status: 'loading' });
    const [cookingPreferences, ownedAppliances, ownedApplianceIds] = await Promise.all([
      getCookingPreferences(),
      getOwnedAppliances(),
      getOwnedApplianceIds(),
    ]);
    set({
      cookingPreferences,
      ownedAppliances,
      ownedApplianceIds,
      status: 'ready',
    });
  },

  savePreferences: async (patch) => {
    const current = get().cookingPreferences;
    const now = new Date().toISOString();
    const merged: CookingPreferences = {
      intents: patch.intents ?? current?.intents ?? ['meal_prep'],
      mealPrepStatus: patch.mealPrepStatus ?? current?.mealPrepStatus ?? 'not_started',
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      completedAt: patch.completedAt !== undefined ? patch.completedAt : (current?.completedAt ?? null),
      deferredAt: patch.deferredAt !== undefined ? patch.deferredAt : (current?.deferredAt ?? null),
    };
    await saveCookingPreferences(merged);
    set({ cookingPreferences: merged });
  },

  setAppliance: async (applianceId, owned) => {
    const now = new Date().toISOString();
    await setApplianceOwnership(applianceId, owned, now);
    const [ownedAppliances, ownedApplianceIds] = await Promise.all([
      getOwnedAppliances(),
      getOwnedApplianceIds(),
    ]);
    set({ ownedAppliances, ownedApplianceIds });
  },

  saveAppliances: async (appliances) => {
    const now = new Date().toISOString();
    await saveOwnedAppliances(appliances, now);
    const [ownedAppliances, ownedApplianceIds] = await Promise.all([
      getOwnedAppliances(),
      getOwnedApplianceIds(),
    ]);
    set({ ownedAppliances, ownedApplianceIds });
  },

  completeMealPrep: async () => {
    const current = get().cookingPreferences;
    const now = new Date().toISOString();
    const merged: CookingPreferences = {
      intents: current?.intents ?? ['meal_prep'],
      mealPrepStatus: 'completed',
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      completedAt: now,
      deferredAt: null,
    };
    await saveCookingPreferences(merged);
    set({ cookingPreferences: merged });
  },

  deferMealPrep: async () => {
    const current = get().cookingPreferences;
    const now = new Date().toISOString();
    const merged: CookingPreferences = {
      intents: current?.intents ?? ['meal_prep'],
      mealPrepStatus: 'deferred',
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      completedAt: current?.completedAt ?? null,
      deferredAt: now,
    };
    await saveCookingPreferences(merged);
    set({ cookingPreferences: merged });
  },
}));
