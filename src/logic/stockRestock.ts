import { predictExpiry } from '@/logic/expiry';
import type { CanonicalItem, Location, PantryItem, ShoppingListItem } from '@/types';

export interface ShoppingRestockPlan {
  shoppingItemId: string;
  item: {
    canonicalId: string;
    locationId: string;
    purchasedAt: string;
    expiresAt: string | null;
  };
  replacedItemIds: string[];
}

/**
 * Plans one explicit shopping-list restock without merging physical
 * containers (decisions 56 and 68). Requested shopping quantity is omitted:
 * it records buying intent, not an observed amount that pantry may repeat.
 */
export function restockFromShoppingItem(
  shoppingItem: Pick<ShoppingListItem, 'id' | 'canonicalId' | 'status'>,
  pantryItems: readonly Pick<PantryItem, 'id' | 'canonicalId' | 'status'>[],
  canonical: Pick<CanonicalItem, 'id' | 'defaultLocation' | 'shelfLifeDays' | 'openLifeDays'> | null,
  locations: readonly Pick<Location, 'id' | 'kind'>[],
  purchasedAt: string,
): ShoppingRestockPlan | null {
  if (
    shoppingItem.status !== 'purchased' ||
    !shoppingItem.canonicalId ||
    canonical?.id !== shoppingItem.canonicalId
  ) {
    return null;
  }

  const location =
    locations.find((candidate) => candidate.id === canonical.defaultLocation) ??
    locations[0];
  if (!location) return null;

  return {
    shoppingItemId: shoppingItem.id,
    item: {
      canonicalId: canonical.id,
      locationId: location.id,
      purchasedAt,
      expiresAt: predictExpiry(canonical, location.kind, purchasedAt, null),
    },
    replacedItemIds: pantryItems
      .filter((item) => item.canonicalId === canonical.id && item.status === 'out')
      .map((item) => item.id),
  };
}
