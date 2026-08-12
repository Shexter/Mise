import { extractReceipt, type ExtractedReceipt } from '@/api/receipt';
import {
  applyReceiptChanges,
  attachExtractedLines,
  addReceiptFrame,
  clearReceiptPantryItems,
  deletePendingReceiptFrames,
  getAllCanonicals,
  getLocations,
  getReceipt,
  getReceiptFrames,
  insertCapturedReceipt,
  listPantryItems,
  listReceipts,
  setReceiptLineCanonical,
  setReceiptLineKind,
  setReceiptType,
  recordReceiptFrameExtraction,
  recordReceiptFrameFailure,
  removeReceiptFrame,
  replaceReceiptFrame,
  listShoppingItems,
  listShoppingReceiptMatches,
  matchShoppingItemToReceipt,
} from '@/db/queries';
import { localDateString } from '@/logic/dates';
import { deletePhoto, photoBase64 } from '@/media/photos';
import { confirmMatch, resolveIngredientReferences } from '@/logic/resolution';
import { planReceiptApply, referencesFromLines } from '@/logic/receipt';
import type {
  CanonicalItem,
  Receipt,
  ReceiptLineKind,
  ReceiptType,
  ReceiptWithLines,
} from '@/types';

/**
 * Binds the pure extraction, matching, and planning pieces to the database
 * — the receipt equivalent of `depletionService.ts` and
 * `suggestionService.ts`. Three moments matter: capture always succeeds
 * even offline, resolution runs once extraction lands, and nothing is
 * applied to the pantry until the review is explicitly accepted.
 */

/** A captured receipt with zero lines has not been extracted yet. */
export function needsExtraction(receipt: ReceiptWithLines): boolean {
  return receipt.lines.length === 0;
}

/**
 * Photographs a receipt and attempts extraction inline. On success the
 * lines are resolved immediately. Where extraction cannot run — no key,
 * no connection — the receipt is retained with no lines rather than
 * failing (decision 8, task 7.3); `retryExtraction` completes it later.
 */
export async function captureReceipt(
  base64Jpeg: string,
  imageUri: string,
  captureDate: string = localDateString(),
): Promise<ReceiptWithLines> {
  const receipt = await insertCapturedReceipt(imageUri, captureDate);
  const [frame] = await getReceiptFrames(receipt.id);
  return frame
    ? ((await tryExtractFrame(receipt.id, frame.id, base64Jpeg, captureDate)) ?? receipt)
    : receipt;
}

/** Persists a receipt already extracted by the unified one-request capture path. */
export async function captureExtractedReceipt(
  extracted: ExtractedReceipt,
  imageUri: string,
  captureDate: string = localDateString(),
): Promise<ReceiptWithLines> {
  const receipt = await insertCapturedReceipt(imageUri, captureDate);
  const [frame] = await getReceiptFrames(receipt.id);
  if (!frame) return receipt;
  return attachAndResolveReceipt(receipt.id, frame.id, extracted);
}

/** Adds one further receipt photo and extracts only that durable frame. */
export async function addReceiptPhoto(
  receiptId: string,
  base64Jpeg: string,
  imageUri: string,
  captureDate: string = localDateString(),
): Promise<ReceiptWithLines | null> {
  const frame = await addReceiptFrame(receiptId, imageUri);
  return (await tryExtractFrame(receiptId, frame.id, base64Jpeg, captureDate)) ?? getReceipt(receiptId);
}

/** Removes an unedited frame and its photo while retaining every other frame. */
export async function removeReceiptPhoto(receiptId: string, frameId: string): Promise<ReceiptWithLines | null> {
  const imageUri = await removeReceiptFrame(receiptId, frameId);
  deletePhoto(imageUri);
  return getReceipt(receiptId);
}

/** Retakes one unedited frame without disturbing the other captured sources. */
export async function retakeReceiptPhoto(
  receiptId: string,
  frameId: string,
  base64Jpeg: string,
  imageUri: string,
  captureDate: string = localDateString(),
): Promise<ReceiptWithLines | null> {
  const replacedImageUri = await replaceReceiptFrame(receiptId, frameId, imageUri);
  deletePhoto(replacedImageUri);
  return (await tryExtractFrame(receiptId, frameId, base64Jpeg, captureDate)) ?? getReceipt(receiptId);
}

/** Drops an unaccepted receipt and its image when review is abandoned. */
export async function abandonReceiptReview(receiptId: string): Promise<void> {
  for (const imageUri of await deletePendingReceiptFrames(receiptId)) deletePhoto(imageUri);
}

/**
 * Re-attempts extraction for a receipt still waiting on it, reading the
 * photo back from where capture stored it — the user never re-photographs.
 */
export async function retryExtraction(
  receiptId: string,
): Promise<ReceiptWithLines | null> {
  const receipt = await getReceipt(receiptId);
  if (!receipt) return null;
  if (receipt.frameEditsLocked) return receipt;
  const frames = await getReceiptFrames(receiptId);
  const retryable = frames.filter((frame) => frame.status !== 'extracted');
  if (retryable.length === 0) return receipt;
  for (const frame of retryable) {
    const base64Jpeg = await photoBase64(frame.imageUri);
    await tryExtractFrame(receiptId, frame.id, base64Jpeg, receipt.purchasedAt);
  }
  return getReceipt(receiptId);
}

/** Receipts still waiting for extraction to complete. */
export async function pendingReceipts(): Promise<Receipt[]> {
  const all = await listReceipts();
  const withFrames = await Promise.all(
    all.filter((r) => r.status === 'pending').map(async (receipt) => ({
      receipt: await getReceipt(receipt.id),
      frames: await getReceiptFrames(receipt.id),
    })),
  );
  return withFrames
    .filter((entry): entry is { receipt: ReceiptWithLines; frames: Awaited<ReturnType<typeof getReceiptFrames>> } =>
      entry.receipt !== null && entry.frames.some((frame) => frame.status !== 'extracted'))
    .map((entry) => entry.receipt);
}

/**
 * Retries every receipt still waiting on extraction — called when the app
 * returns to the foreground or a connection is noticed, the same shape as
 * `dayStore`'s `syncToToday`. Failures (still no key, still offline) are
 * silent; the receipt simply stays pending for the next attempt.
 */
export async function retryAllPending(): Promise<number> {
  const pending = await pendingReceipts();
  let completed = 0;
  for (const receipt of pending) {
    const result = await retryExtraction(receipt.id);
    if (result && !needsExtraction(result)) completed += 1;
  }
  return completed;
}

async function tryExtractFrame(
  receiptId: string,
  frameId: string,
  base64Jpeg: string,
  captureDate: string,
): Promise<ReceiptWithLines | null> {
  let extracted: ExtractedReceipt;
  try {
    extracted = await extractReceipt(base64Jpeg, captureDate);
  } catch {
    await recordReceiptFrameFailure(frameId, 'extraction_failed');
    return null;
  }

  return attachAndResolveReceipt(receiptId, frameId, extracted);
}

async function attachAndResolveReceipt(
  receiptId: string,
  frameId: string,
  extracted: ExtractedReceipt,
): Promise<ReceiptWithLines> {
  await recordReceiptFrameExtraction(frameId, {
    store: extracted.store,
    purchasedAt: extracted.purchasedAt,
    receiptType: extracted.receiptType,
    subtotalCents: extracted.subtotalCents,
    taxCents: extracted.taxCents,
    totalCents: extracted.totalCents,
    lines: extracted.lines.map((line) => ({
      rawText: line.text,
      kind: line.kind,
      qty: line.qty,
      unit: line.unit,
      quantityKind: line.quantityKind,
      lineTotalCents: line.lineTotalCents,
      unitPriceCents: line.unitPriceCents,
      appliesToText: line.appliesToText,
    })),
  });

  return resolveReceiptLines(receiptId, extracted.store);
}

/**
 * Resolves every food line of a receipt through the one matching entry
 * point (task 5.1) — a single batched call, never a receipt-specific
 * path. Both a resolved and a needs-confirmation outcome carry a
 * canonical id: review is the confirmation gate here, not the cascade
 * (mirrors decision 28's meal-log treatment).
 */
export async function resolveReceiptLines(
  receiptId: string,
  store: string | null,
): Promise<ReceiptWithLines> {
  const receipt = await getReceipt(receiptId);
  if (!receipt) throw new Error('Receipt not found.');

  const foodLines = receipt.lines.map((line) => ({
    text: line.rawText,
    kind: line.kind,
  }));
  const refs = referencesFromLines(foodLines, store ?? undefined);
  if (refs.length > 0) {
    const outcomes = await resolveIngredientReferences(
      refs.map((entry) => entry.reference),
      'receipt',
    );
    for (const [position, entry] of refs.entries()) {
      const outcome = outcomes[position];
      const line = receipt.lines[entry.lineIndex];
      if (!line || !outcome) continue;
      if (outcome.status === 'resolved' || outcome.status === 'needs_confirmation') {
        await setReceiptLineCanonical(line.id, outcome.canonicalId);
      }
      // 'unresolved': queued for review, canonical stays null — distinct
      // from a non-food line, which never reached the matcher at all.
    }
  }

  const updated = await getReceipt(receiptId);
  if (!updated) throw new Error('Receipt vanished during resolution.');
  return updated;
}

/** A correction made during review teaches the matcher, same as any other channel. */
export async function correctReceiptLine(
  lineId: string,
  rawText: string,
  canonicalId: string,
): Promise<void> {
  await confirmMatch(rawText, canonicalId);
  await setReceiptLineCanonical(lineId, canonicalId, true);
}

/**
 * Reclassifies a line — recovery from a wrong non-food call (task 8.3). A
 * line moved to `food` is re-resolved immediately, the same as it would
 * have been had extraction called it food to begin with.
 */
export async function reclassifyReceiptLine(
  receiptId: string,
  lineId: string,
  kind: ReceiptLineKind,
): Promise<ReceiptWithLines> {
  await setReceiptLineKind(lineId, kind);
  if (kind !== 'food') {
    const updated = await getReceipt(receiptId);
    if (!updated) throw new Error('Receipt vanished during reclassification.');
    return updated;
  }
  const receipt = await getReceipt(receiptId);
  return resolveReceiptLines(receiptId, receipt?.store ?? null);
}

export interface AcceptSummary {
  /** Canonical display names of items the review created. */
  names: string[];
  shoppingMatchIds: string[];
}

/**
 * Accepts a receipt's review: plans the pantry changes and applies them
 * in one transaction. Extraction never writes; this is the one place that
 * does (task 6.2, 6.3).
 */
export async function acceptReceiptReview(receiptId: string): Promise<AcceptSummary> {
  const receipt = await getReceipt(receiptId);
  if (!receipt) throw new Error('Receipt not found.');

  const [canonicalList, locations, catalogue] = await Promise.all([
    getAllCanonicals(),
    getLocations(),
    listPantryItems(),
  ]);
  const canonicals = new Map(canonicalList.map((c) => [c.id, c]));

  const changes = planReceiptApply(
    receipt.lines,
    catalogue,
    canonicals,
    locations,
    receipt.type,
    receipt.purchasedAt,
  );
  await applyReceiptChanges(receiptId, changes);

  // Receipt application owns pantry writes. Shopping reconciliation is a
  // separate, exact-identity transition that never reverses those effects.
  const shoppingItems = await listShoppingItems();
  for (const line of receipt.lines) {
    if (line.kind !== 'food' || line.excluded || line.canonicalId === null) continue;
    const item = shoppingItems.find((candidate) => candidate.canonicalId === line.canonicalId);
    if (item) await matchShoppingItemToReceipt(item.id, receiptId, line.id);
  }

  const names = new Set<string>();
  for (const change of changes) {
    if (change.kind !== 'create') continue;
    names.add(canonicals.get(change.item.canonicalId)?.displayName ?? change.item.canonicalId);
  }
  const shoppingMatches = await listShoppingReceiptMatches(receiptId);
  return { names: [...names], shoppingMatchIds: shoppingMatches.filter((match) => match.undoneAt === null).map((match) => match.id) };
}

/**
 * Changes a receipt's type, re-planning rather than undoing (task 8.4). A
 * receipt already applied has its created pantry items removed first —
 * the spec's "any pantry items it created are removed, spending is
 * retained" — then the new type re-plans and re-applies in one action, so
 * switching back to grocery recreates its items rather than requiring a
 * second accept.
 */
export async function changeReceiptType(
  receiptId: string,
  type: ReceiptType,
): Promise<void> {
  const receipt = await getReceipt(receiptId);
  if (!receipt) throw new Error('Receipt not found.');

  if (receipt.status === 'applied') {
    await clearReceiptPantryItems(receiptId);
  }
  await setReceiptType(receiptId, type);

  if (receipt.status !== 'applied') return;

  const refreshed = await getReceipt(receiptId);
  if (!refreshed) return;
  const [canonicalList, locations, catalogue] = await Promise.all([
    getAllCanonicals(),
    getLocations(),
    listPantryItems(),
  ]);
  const canonicals = new Map<string, CanonicalItem>(canonicalList.map((c) => [c.id, c]));
  const changes = planReceiptApply(
    refreshed.lines,
    catalogue,
    canonicals,
    locations,
    type,
    refreshed.purchasedAt,
  );
  await applyReceiptChanges(receiptId, changes);
}
