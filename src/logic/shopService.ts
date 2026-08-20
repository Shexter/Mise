import { listNeededIngredients, listShops, rememberShop } from '@/db/queries';
import { hasLocationPermission, readCoarsePosition } from '@/logic/location';
import {
  nearestShop,
  orderNeeded,
  SHOP_RECENCY_WINDOW_MS,
  storeForNormalisation,
  withinRecencyWindow,
} from '@/logic/shops';
import type { NeededIngredient, Shop } from '@/types';

/**
 * Binds the pure shop logic to the database and to the one-shot position read
 * — the shop equivalent of `receiptService.ts` and `depletionService.ts`.
 *
 * Two moments use a position, and only two: importing a receipt, and the user
 * tapping "check this shop". Both are foreground, both are one shot, and both
 * do nothing at all when the permission is absent.
 */

/**
 * The last shop recognised in this app session, held in memory only.
 *
 * This is what "shortly after being at a known shop" means: a receipt
 * photographed in the car park and extracted a few minutes later can still
 * inherit the shop, without the position being read a second time. It is a
 * variable, not a row — it dies with the process, and nothing writes when the
 * user was anywhere to disk.
 */
let lastRecognised: { shop: Shop; readAtMs: number } | null = null;

/** Forgets the in-memory recognition. Called when shop data is cleared. */
export function forgetRecognisedShop(): void {
  lastRecognised = null;
}

/** The recognised shop, if one was matched inside the recency window. */
export function recentlyRecognisedShop(nowMs: number = Date.now()): Shop | null {
  if (!lastRecognised) return null;
  return withinRecencyWindow(lastRecognised.readAtMs, nowMs, SHOP_RECENCY_WINDOW_MS)
    ? lastRecognised.shop
    : null;
}

/**
 * Learns or recognises a shop while a receipt is being imported.
 *
 * With a legible store name, the shop is remembered at the current position —
 * the receipt is the thing that names the store, which is why learning happens
 * at import rather than at capture. Without one, an existing shop near the
 * current position is recognised instead, so its name can stand in.
 *
 * Returns null, having done nothing, when the permission is absent or no
 * position is available. The import proceeds exactly as it does today.
 */
export async function noteShopForReceipt(
  storeName: string | null,
  nowMs: number = Date.now(),
): Promise<Shop | null> {
  if (!(await hasLocationPermission())) return null;
  const position = await readCoarsePosition();
  if (!position) return recentlyRecognisedShop(nowMs);

  const printed = storeName?.trim();
  const shop = printed
    ? await rememberShop(printed, position)
    : nearestShop(await listShops(), position);
  if (shop) lastRecognised = { shop, readAtMs: nowMs };
  return shop;
}

/**
 * The store name receipt normalisation should use, given what the receipt
 * printed and what — if anything — was recognised from position. The printed
 * header always wins; see `storeForNormalisation`.
 */
export function storeForReceipt(
  receiptStore: string | null,
  recognised: Shop | null,
): string | null {
  return storeForNormalisation(receiptStore, recognised?.storeName ?? null);
}

/** The outcome of the user tapping "check this shop". */
export type ShopCheck =
  | { status: 'no_permission' }
  | { status: 'no_position' }
  | { status: 'unknown_shop' }
  | { status: 'nothing_needed'; shop: Shop }
  | { status: 'needed'; shop: Shop; items: NeededIngredient[] };

/**
 * Answers "what am I out of, here?" and does nothing else.
 *
 * Every branch is a read. No pantry item is created or changed, no receipt is
 * created, and no record of the check — or of when it happened — is written
 * anywhere. `unknown_shop` is a normal answer: a shop no receipt has been
 * imported from is simply unknown, and inventing a nearest guess would be
 * worse than saying so.
 */
export async function checkCurrentShop(): Promise<ShopCheck> {
  if (!(await hasLocationPermission())) return { status: 'no_permission' };
  const position = await readCoarsePosition();
  if (!position) return { status: 'no_position' };

  const shop = nearestShop(await listShops(), position);
  if (!shop) return { status: 'unknown_shop' };
  lastRecognised = { shop, readAtMs: Date.now() };

  const items = orderNeeded(await listNeededIngredients());
  return items.length === 0
    ? { status: 'nothing_needed', shop }
    : { status: 'needed', shop, items };
}
