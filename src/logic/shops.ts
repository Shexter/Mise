import type { NeededIngredient, Shop } from '@/types';

/**
 * Pure shop-location logic: coarsening a position, matching one to a known
 * shop, and deciding which store name receipt normalisation should use.
 *
 * Nothing here touches the database, the network, or the device. In
 * particular there is no places lookup anywhere in this module or in what
 * calls it — the shop list is learned from the user's own receipts, so it
 * works offline and carries no ODbL licensing question (decision 144).
 */

/**
 * Decimal places kept on a stored coordinate. Four places is roughly 11 m at
 * the equator — building-level, which is all "which shop is this" needs. A
 * supermarket is a large building; storing a metre-accurate trace of where
 * inside it the user stood buys nothing and stores more than is needed.
 */
export const COARSE_DECIMALS = 4;

/**
 * How close a read position must be to a known shop to count as being at it.
 * Generous on purpose: a coarse coordinate is only good to ~11 m, GPS indoors
 * is worse, and a supermarket footprint is tens of metres across. A wrong
 * match costs a dismissed screen, never a silent change.
 */
export const SHOP_MATCH_RADIUS_METRES = 150;

/**
 * "Shortly after being at a known shop", for the receipt-matching fallback.
 * A guess until there is usage: long enough to cover queueing, paying, and
 * walking out to photograph the receipt in the car park; short enough that
 * a receipt photographed at home that evening does not inherit the shop.
 *
 * Note this is a window over the *reading*, not a stored timestamp — nothing
 * in the database records when the user was anywhere.
 */
export const SHOP_RECENCY_WINDOW_MS = 30 * 60 * 1000;

/** Mean Earth radius, metres. */
const EARTH_RADIUS_M = 6_371_000;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Rounds a position to building-level precision before it is stored. */
export function coarsen(position: Coordinates): Coordinates {
  const factor = 10 ** COARSE_DECIMALS;
  return {
    latitude: Math.round(position.latitude * factor) / factor,
    longitude: Math.round(position.longitude * factor) / factor,
  };
}

/** Great-circle distance in metres between two positions. */
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The known shop the position is at, or null when none is close enough.
 *
 * Null is a real answer, not a failure: a shop no receipt has been imported
 * from is simply unknown, and the caller surfaces nothing rather than
 * guessing at the nearest thing it happens to have.
 */
export function nearestShop(
  shops: readonly Shop[],
  position: Coordinates,
  radiusMetres: number = SHOP_MATCH_RADIUS_METRES,
): Shop | null {
  let best: Shop | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const shop of shops) {
    const distance = distanceMetres(shop, position);
    if (distance <= radiusMetres && distance < bestDistance) {
      best = shop;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Whether a shop identity read `readAtMs` ago may still inform a receipt
 * imported now. Both arguments are in-memory milliseconds; neither is stored.
 */
export function withinRecencyWindow(
  readAtMs: number,
  nowMs: number,
  windowMs: number = SHOP_RECENCY_WINDOW_MS,
): boolean {
  const elapsed = nowMs - readAtMs;
  return elapsed >= 0 && elapsed <= windowMs;
}

/**
 * The store name normalisation should use.
 *
 * The receipt's own printed header always wins where it states one: it is
 * direct evidence, and a position match is circumstantial — someone can buy a
 * coffee at the shop next door, or shop at two places in one trip. The
 * recognised shop is the fallback the header never had.
 */
export function storeForNormalisation(
  receiptStore: string | null | undefined,
  shopStoreName: string | null | undefined,
): string | null {
  const printed = receiptStore?.trim();
  if (printed) return printed;
  const inferred = shopStoreName?.trim();
  return inferred ? inferred : null;
}

/**
 * What is worth buying, ordered out-of-stock first. Status only; the caller
 * cannot show a quantity because there is none here to show (decision 15).
 */
export function orderNeeded(
  needed: readonly NeededIngredient[],
): NeededIngredient[] {
  const rank = (status: NeededIngredient['status']) => (status === 'out' ? 0 : 1);
  return [...needed].sort(
    (a, b) => rank(a.status) - rank(b.status) || a.displayName.localeCompare(b.displayName),
  );
}

/**
 * A shop's default display name, from the store name a receipt printed.
 * The user can rename it afterwards; this is only the seed.
 */
export function defaultShopName(storeName: string): string {
  return storeName.trim();
}
