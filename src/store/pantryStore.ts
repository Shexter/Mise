import { create } from 'zustand';

import {
  addLocation,
  applyShoppingRestock,
  discardItem,
  freezeItem,
  getAllCanonicals,
  getLocations,
  insertPantryItem,
  updatePantryItem,
  listPantryItems,
  markItemOpened,
  markItemRunningLow,
  markItemUsedUp,
  removeLocation,
  renameLocation,
  setItemFullness,
  undoShoppingRestock,
  type NewPantryItem,
  type ShoppingRestockUndo,
} from '@/db/queries';
import { isFreezable } from '@/logic/expiry';
import { shelfLifeKey } from '@/logic/expiry';
import type { ShoppingRestockPlan } from '@/logic/stockRestock';
import { daysUntil, stockStatusWithConfidence } from '@/logic/stockStatus';
import type {
  CanonicalItem,
  FoodClass,
  Fullness,
  Location,
  LocationKind,
  PantryItem,
  SourceId,
  StockStatus,
  ShoppingListStatus,
} from '@/types';

/**
 * The catalogue's view model. Deliberately narrow (decision 15): it carries
 * status, expiry, names, and locations — and NOT `qtyRemaining` or
 * `usesCount`, so no component can render a quantity the app cannot
 * defend. The one exception the spec allows — echoing a figure the user
 * typed themselves — travels as the explicitly-named `userEnteredQty`.
 */
export interface PantryEntry {
  id: string;
  canonicalId: string;
  /** The canonical ingredient's display name — never raw observed text. */
  name: string;
  foodClass: FoodClass;
  status: StockStatus;
  /**
   * False once the item has drifted past `DRIFT_LIMIT` estimated decrements
   * without an anchor. The interface qualifies rather than asserts — see
   * `statusLabel` (decision 53).
   */
  statusConfident: boolean;
  /** True when a fullness check is worth offering, on suspicion only. */
  suggestFullnessCheck: boolean;
  locationId: string;
  locationName: string;
  expiresAt: string | null;
  /** Negative when past. Null when there is no date. */
  daysLeft: number | null;
  /** True when predicted rather than user- or label-supplied. */
  expiryIsPredicted: boolean;
  /** Origin of the shelf-life figure used for a predicted date. */
  expiryDataSource: SourceId | null;
  opened: boolean;
  freezable: boolean;
  /** Uses-tracked items only; the user's own four-state setting. */
  fullness: Fullness | null;
  /** Retained photo if user captured this item with camera */
  photoUri: string | null;
  /** Set only when the user typed the figure themselves, e.g. "5000 g". */
  userEnteredQty: string | null;
}

/** One canonical ingredient's items, so twelve tins read as one row. */
export interface PantryGroup {
  canonicalId: string;
  name: string;
  foodClass: FoodClass;
  photoUri: string | null;
  count: number;
  entries: PantryEntry[];
  /** The most urgent expiry across the group's items. */
  soonestDaysLeft: number | null;
}

interface PantryState {
  loading: boolean;
  /** Monotonic signal for surfaces whose derived data depends on pantry stock. */
  revision: number;
  groups: PantryGroup[];
  locations: Location[];

  refresh: () => Promise<void>;
  addItem: (input: NewPantryItem) => Promise<void>;
  updateItem: (id: string, input: Parameters<typeof updatePantryItem>[1]) => Promise<void>;
  markOpened: (id: string) => Promise<void>;
  freeze: (id: string) => Promise<void>;
  setFullness: (id: string, fullness: Fullness) => Promise<void>;
  markUsedUp: (id: string) => Promise<void>;
  markRunningLow: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
  addLocation: (name: string, kind: LocationKind) => Promise<void>;
  renameLocation: (id: string, name: string) => Promise<void>;
  removeLocation: (id: string, destinationId: string) => Promise<void>;
  restock: (plan: ShoppingRestockPlan) => Promise<ShoppingRestockUndo>;
  undoRestock: (undo: ShoppingRestockUndo, shoppingItemId: string, previousStatus: ShoppingListStatus) => Promise<void>;
}

export const usePantryStore = create<PantryState>((set, get) => {
  const act = async (work: () => Promise<unknown>): Promise<void> => {
    await work();
    await get().refresh();
    set((state) => ({ revision: state.revision + 1 }));
  };

  const actWithResult = async <T>(work: () => Promise<T>): Promise<T> => {
    const result = await work();
    await get().refresh();
    set((state) => ({ revision: state.revision + 1 }));
    return result;
  };

  return {
    loading: true,
    revision: 0,
    groups: [],
    locations: [],

    refresh: async () => {
      set({ loading: true });
      const [items, canonicals, locations] = await Promise.all([
        listPantryItems(),
        getAllCanonicals(),
        getLocations(),
      ]);
      const canonicalById = new Map(canonicals.map((c) => [c.id, c]));
      const locationById = new Map(locations.map((l) => [l.id, l]));

      const entries: PantryEntry[] = [];
      for (const item of items) {
        const canonical = canonicalById.get(item.canonicalId);
        const location = locationById.get(item.locationId);
        if (!canonical || !location) continue;
        entries.push(toEntry(item, canonical, location));
      }
      set({ groups: groupByCanonical(entries), locations, loading: false });
    },

    addItem: (input) => act(() => insertPantryItem(input)),
    updateItem: (id, input) => act(() => updatePantryItem(id, input)),
    markOpened: (id) => act(() => markItemOpened(id)),
    freeze: (id) => act(() => freezeToDefaultFreezer(id, get().locations)),
    setFullness: (id, fullness) => act(() => setItemFullness(id, fullness)),
    markUsedUp: (id) => act(() => markItemUsedUp(id)),
    markRunningLow: (id) => act(() => markItemRunningLow(id)),
    discard: (id) => act(() => discardItem(id)),
    addLocation: (name, kind) => act(() => addLocation(name, kind)),
    renameLocation: (id, name) => act(() => renameLocation(id, name)),
    removeLocation: (id, destinationId) =>
      act(() => removeLocation(id, destinationId)),
    restock: (plan) => actWithResult(() => applyShoppingRestock(plan)),
    undoRestock: (undo, shoppingItemId, previousStatus) =>
      act(() => undoShoppingRestock(undo, shoppingItemId, previousStatus)),
  };
});

function toEntry(
  item: PantryItem,
  canonical: CanonicalItem,
  location: Location,
): PantryEntry {
  const status = stockStatusWithConfidence(item, canonical);
  return {
    id: item.id,
    canonicalId: item.canonicalId,
    name: canonical.displayName,
    foodClass: canonical.foodClass,
    status: status.status,
    statusConfident: status.confident,
    suggestFullnessCheck: status.suggestFullnessCheck,
    locationId: location.id,
    locationName: location.name,
    expiresAt: item.expiresAt,
    daysLeft: daysUntil(item.expiresAt),
    expiryIsPredicted: item.expirySource === 'predicted',
    expiryDataSource:
      canonical.sources[`shelfLifeDays.${shelfLifeKey(location.kind)}`] ??
      canonical.sources.shelfLifeDays ??
      null,
    opened: item.openedAt !== null,
    freezable: isFreezable(canonical) && location.kind !== 'freezer',
    fullness: item.fullness,
    photoUri: item.photoUri,
    userEnteredQty:
      item.qtySource === 'user' && item.qtyRemaining !== null
        ? `${item.qtyRemaining} ${item.qtyUnit ?? ''}`.trim()
        : null,
  };
}

/** Groups entries by canonical, keeping the incoming soonest-first order. */
function groupByCanonical(entries: PantryEntry[]): PantryGroup[] {
  const groups = new Map<string, PantryGroup>();
  for (const entry of entries) {
    const existing = groups.get(entry.canonicalId);
    if (existing) {
      existing.entries.push(entry);
      existing.count += 1;
      if (!existing.photoUri && entry.photoUri) {
        existing.photoUri = entry.photoUri;
      }
    } else {
      groups.set(entry.canonicalId, {
        canonicalId: entry.canonicalId,
        name: entry.name,
        foodClass: entry.foodClass,
        photoUri: entry.photoUri,
        count: 1,
        entries: [entry],
        soonestDaysLeft: entry.daysLeft,
      });
    }
  }
  return [...groups.values()];
}

/** The freeze action targets the first freezer-kind location. */
async function freezeToDefaultFreezer(
  id: string,
  locations: Location[],
): Promise<void> {
  const freezer = locations.find((location) => location.kind === 'freezer');
  if (!freezer) return;
  await freezeItem(id, freezer.id);
}
