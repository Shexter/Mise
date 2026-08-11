import { VisionError } from '@/api/errors';
import { lookupOpenFoodFacts, type OpenFoodFactsProduct } from '@/api/openFoodFacts';
import { getBarcodeMiss, getProductByBarcode, recordBarcodeMiss, upsertProduct, type NewPantryItem } from '@/db/queries';
import type { MatchOutcome } from '@/logic/match';
import { confirmMatch, resolveIngredientReferences } from '@/logic/resolution';
import type { Product } from '@/types';

/** Validated barcode categories before any lookup or cache write. */
export type BarcodeDisposition = 'product' | 'unread' | 'store_local';

/** A remote catalogue miss may be retried after it has had time to change. */
export const BARCODE_MISS_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

/** Ignore repeated camera events for the same code only inside this window. */
export const BARCODE_SCAN_DEBOUNCE_MS = 1_250;

/**
 * Turns one scanned SKU into the pantry containers it physically contains.
 * A count is used only when the source or the person explicitly supplied it;
 * an unknown count remains one pantry item rather than a derived estimate.
 */
export function barcodePantryItems(
  product: Product,
  locationId: string,
  purchasedAt: string,
): (NewPantryItem & { productId: string })[] {
  const count = product.containerCount ?? 1;
  return Array.from({ length: count }, () => ({
    canonicalId: product.canonicalId,
    productId: product.id,
    locationId,
    purchasedAt,
    qtyRemaining: product.pkgQty,
    qtyUnit: product.pkgQty === null ? null : product.pkgUnit,
    qtySource: 'estimate',
  }));
}

export function isBarcodeScanDebounced(
  lastSeenAt: number | undefined,
  now: number = Date.now(),
): boolean {
  return lastSeenAt !== undefined && now - lastSeenAt < BARCODE_SCAN_DEBOUNCE_MS;
}

export function isFreshBarcodeMiss(
  fetchedAt: string,
  now: number = Date.now(),
): boolean {
  const fetchedMs = Date.parse(fetchedAt);
  return Number.isFinite(fetchedMs) && now - fetchedMs < BARCODE_MISS_TTL_MS;
}

/** Cache-aware barcode lookup shape, injectable so the policy stays testable. */
export interface BarcodeCache<TProduct, TRemote> {
  getProduct: (gtin: string) => Promise<TProduct | null>;
  getMiss: (gtin: string) => Promise<{ fetchedAt: string } | null>;
  lookup: (gtin: string) => Promise<TRemote | null>;
  recordMiss: (gtin: string) => Promise<unknown>;
}

export type BarcodeLookup<TProduct, TRemote> =
  | { kind: 'product'; product: TProduct; cached: true }
  | { kind: 'remote'; product: TRemote }
  | { kind: 'missing'; cached: boolean }
  | { kind: 'unread' }
  | { kind: 'store_local' };

/** Orders the free local checks and caches before the remote catalogue. */
export async function lookupBarcode<TProduct, TRemote>(
  raw: string,
  cache: BarcodeCache<TProduct, TRemote>,
): Promise<BarcodeLookup<TProduct, TRemote>> {
  const gtin = raw.replace(/\s/g, '');
  const disposition = classifyBarcode(gtin);
  if (disposition === 'unread') return { kind: 'unread' };
  if (disposition === 'store_local') return { kind: 'store_local' };
  const cachedProduct = await cache.getProduct(gtin);
  if (cachedProduct) return { kind: 'product', product: cachedProduct, cached: true };
  const cachedMiss = await cache.getMiss(gtin);
  if (cachedMiss && isFreshBarcodeMiss(cachedMiss.fetchedAt)) return { kind: 'missing', cached: true };
  const product = await cache.lookup(gtin);
  if (product) return { kind: 'remote', product };
  await cache.recordMiss(gtin);
  return { kind: 'missing', cached: false };
}

export type ResolvedBarcodeLookup =
  | { kind: 'product'; product: Product; cached: boolean }
  | { kind: 'needs_confirmation'; product: OpenFoodFactsProduct; match: MatchOutcome }
  | { kind: 'unresolved'; product: OpenFoodFactsProduct; match: MatchOutcome }
  | { kind: 'missing'; cached: boolean }
  | { kind: 'unread' }
  | { kind: 'store_local' };

/** Resolves an Open Food Facts name without feeding its new GTIN back into step 1. */
export async function resolveBarcode(
  raw: string,
  signal?: AbortSignal,
  canLookupRemote: (() => Promise<boolean>) | undefined = undefined,
): Promise<ResolvedBarcodeLookup> {
  const result = await lookupBarcode(raw, {
    getProduct: getProductByBarcode,
    getMiss: getBarcodeMiss,
    lookup: async (gtin) => {
      if (canLookupRemote && !await canLookupRemote()) {
        throw new VisionError('network', 'No internet connection is available for barcode lookup.');
      }
      return lookupOpenFoodFacts(gtin, signal);
    },
    recordMiss: recordBarcodeMiss,
  });
  if (result.kind !== 'remote') return result;
  const [match] = await resolveIngredientReferences([{ raw: result.product.name }], 'barcode', signal);
  if (!match) return { kind: 'unresolved', product: result.product, match: { status: 'unresolved', raw: result.product.name, norm: result.product.name, queued: false } };
  if (match.status === 'resolved') {
    const product = await upsertProduct({ ...result.product, canonicalId: match.canonicalId, source: 'barcode' });
    return { kind: 'product', product, cached: false };
  }
  return match.status === 'needs_confirmation'
    ? { kind: 'needs_confirmation', product: result.product, match }
    : { kind: 'unresolved', product: result.product, match };
}

/**
 * Persists a human answer for a confirm-band product in both places that need
 * it: the shared name resolver and the SKU-specific barcode cache.
 */
export async function confirmBarcodeMatch(
  product: OpenFoodFactsProduct,
  canonicalId: string,
): Promise<Product> {
  await confirmMatch(product.name, canonicalId);
  return upsertProduct({ ...product, canonicalId, source: 'barcode' });
}

/** Binds a person-identified product to its GTIN for future offline scans. */
export async function identifyBarcode(
  gtin: string,
  name: string,
  canonicalId: string,
  brand: string | null = null,
): Promise<Product> {
  return upsertProduct({
    gtin,
    name,
    brand,
    pkgQty: null,
    pkgUnit: null,
    containerCount: null,
    canonicalId,
    source: 'user',
  });
}

/**
 * Validates EAN-13, EAN-8, UPC-A, and UPC-E. Other camera output is not a
 * product barcode and is treated as an unread scan rather than a remote miss.
 */
export function classifyBarcode(raw: string): BarcodeDisposition {
  const code = raw.replace(/\s/g, '');
  if (!/^\d+$/.test(code) || !hasValidCheckDigit(code)) return 'unread';
  return isRestrictedCirculation(code) ? 'store_local' : 'product';
}

export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
  const expanded = code.length === 8 ? expandUpcE(code) ?? code : code;
  return checkDigit(expanded.slice(0, -1)) === Number(expanded.at(-1));
}

/** GS1 prefixes 02 and 20–29 identify retailer-controlled variable items. */
export function isRestrictedCirculation(code: string): boolean {
  return code.length === 13 && (code.startsWith('02') || /^2\d/.test(code));
}

function checkDigit(body: string): number {
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const digit = Number(body[index]);
    sum += digit * ((body.length - 1 - index) % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Converts UPC-E (number system + six digits + check) to its UPC-A form. */
function expandUpcE(code: string): string | null {
  if (code.length !== 8 || !/^\d+$/.test(code)) return null;
  const numberSystem = code[0]!;
  const d1 = code[1]!;
  const d2 = code[2]!;
  const d3 = code[3]!;
  const d4 = code[4]!;
  const d5 = code[5]!;
  const d6 = code[6]!;
  const check = code[7]!;
  if (numberSystem !== '0' && numberSystem !== '1') return null;
  const body = d6 <= '2'
    ? `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`
    : d6 === '3'
      ? `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`
      : d6 === '4'
        ? `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`
        : `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${body}${check}`;
}
