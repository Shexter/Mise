import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import { mergeReceiptFrameLines, type ReceiptFrameLineInput } from '@/logic/receiptFrames';
import { predictExpiry } from '@/logic/expiry';
import type { PantryChange } from '@/logic/receipt';
import type { LocationKind, MeasureUnit, PendingCapture, PendingCaptureKind, Receipt, ReceiptExtractionSource, ReceiptLineKind, ReceiptOcrPreference, ReceiptType, QuantityKind, ReceiptWithLines, ReceiptFrame } from '@/types';
import {
  TransactionHandle,
  CanonicalItemRow,
  toCanonicalItem,
  LocationRow,
  ReceiptRow,
  ReceiptLineRow,
  ReceiptFrameRow,
  ReceiptFrameLineRow,
  PendingCaptureRow,
  toPendingCapture,
  toReceipt,
  toReceiptLine,
  toReceiptFrame,
} from './types';



/**
 * The receipt-OCR preference. Absent means never chosen, which reads as
 * off — the local-first default, so a receipt's text is never sent to a
 * provider because nobody got round to answering a question.
 */
export const DEFAULT_RECEIPT_OCR_PREFERENCE: ReceiptOcrPreference = {
  cloudTextEnhancement: false,
};


export async function getReceiptOcrPreference(): Promise<ReceiptOcrPreference> {
  const row = await db().getFirstAsync<{ cloud_text_enhancement: number }>(
    'SELECT cloud_text_enhancement FROM receipt_ocr_preferences WHERE id = 1',
  );
  if (!row) return { ...DEFAULT_RECEIPT_OCR_PREFERENCE };
  return { cloudTextEnhancement: row.cloud_text_enhancement === 1 };
}


export async function saveReceiptOcrPreference(
  preference: ReceiptOcrPreference,
): Promise<void> {
  await db().runAsync(
    `INSERT INTO receipt_ocr_preferences (id, cloud_text_enhancement, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       cloud_text_enhancement = excluded.cloud_text_enhancement,
       updated_at = excluded.updated_at`,
    [preference.cloudTextEnhancement ? 1 : 0, new Date().toISOString()],
  );
}


/** A small, explicit bound prevents retained camera files growing forever. */
export const MAX_PENDING_CAPTURES = 20;


export class ReceiptFrameEditsLockedError extends Error {
  constructor() {
    super('Finish or discard this receipt before changing its photos.');
    this.name = 'ReceiptFrameEditsLockedError';
  }
}


export class PendingCaptureLimitError extends Error {
  constructor() {
    super(`Only ${MAX_PENDING_CAPTURES} captures can wait at once.`);
    this.name = 'PendingCaptureLimitError';
  }
}


export interface NewReceiptLine {
  rawText: string;
  kind: ReceiptLineKind;
  qty: number | null;
  unit: MeasureUnit | null;
  quantityKind: QuantityKind | null;
  lineTotalCents: number | null;
  unitPriceCents: number | null;
  /**
   * For a `discount` line only: the exact raw text of the food line it
   * reduces, resolved to that line's real id at insert time. Null for
   * every other kind, and for a discount naming no line.
   */
  appliesToText: string | null;
  /** The on-device engine's recognition confidence for this line, when local OCR read it. */
  ocrConfidence?: number | null;
}


export interface ExtractedReceiptHeader {
  store: string | null;
  purchasedAt: string;
  receiptType: ReceiptType;
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  lines: NewReceiptLine[];
  /** How these lines were produced. Defaults to the original cloud vision path. */
  extractionSource?: ReceiptExtractionSource;
}


/**
 * Records a receipt the moment it is captured, before extraction has run —
 * the shell a photograph taken offline is retained as (task 7.3). It has
 * no lines yet; `getReceipt` returning zero lines *is* "not yet extracted",
 * so no separate status is needed to say so. `purchasedAt` defaults to the
 * capture date and is overwritten if extraction reads a real one.
 */
export async function insertCapturedReceipt(
  imageUri: string,
  captureDate: string,
): Promise<ReceiptWithLines> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO receipts (id, type, store, purchased_at, subtotal_cents, tax_cents, total_cents, image_uri, status, created_at)
     VALUES (?, 'grocery', NULL, ?, NULL, NULL, NULL, ?, 'pending', ?)`,
    [id, captureDate, imageUri, now],
  );
  await db().runAsync(
    `INSERT INTO receipt_frames
       (id, receipt_id, image_uri, sort_order, status, last_error_kind, created_at, extracted_at)
     VALUES (?, ?, ?, 0, 'pending', NULL, ?, NULL)`,
    [randomUUID(), id, imageUri, now],
  );
  const stored = await getReceipt(id);
  if (!stored) throw new Error('Receipt vanished on insert.');
  return stored;
}


/** Frames are ordered photographs of one receipt, retained before extraction. */
export async function addReceiptFrame(
  receiptId: string,
  imageUri: string,
): Promise<ReceiptFrame> {
  await assertReceiptFramesEditable(receiptId);
  const next = await db().getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM receipt_frames WHERE receipt_id = ?',
    [receiptId],
  );
  const id = randomUUID();
  const now = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO receipt_frames
       (id, receipt_id, image_uri, sort_order, status, last_error_kind, created_at, extracted_at)
     VALUES (?, ?, ?, ?, 'pending', NULL, ?, NULL)`,
    [id, receiptId, imageUri, next?.next ?? 0, now],
  );
  const stored = await db().getFirstAsync<ReceiptFrameRow>('SELECT * FROM receipt_frames WHERE id = ?', [id]);
  if (!stored) throw new Error('Receipt frame vanished on insert.');
  return toReceiptFrame(stored);
}


async function assertReceiptFramesEditable(receiptId: string): Promise<void> {
  const receipt = await db().getFirstAsync<Pick<ReceiptRow, 'status' | 'frame_edits_locked'>>(
    'SELECT status, frame_edits_locked FROM receipts WHERE id = ?',
    [receiptId],
  );
  if (!receipt) throw new Error('Receipt not found.');
  if (receipt.status !== 'pending' || receipt.frame_edits_locked === 1) {
    throw new ReceiptFrameEditsLockedError();
  }
}


export async function getReceiptFrames(receiptId: string): Promise<ReceiptFrame[]> {
  const rows = await db().getAllAsync<ReceiptFrameRow>(
    'SELECT * FROM receipt_frames WHERE receipt_id = ? ORDER BY sort_order ASC',
    [receiptId],
  );
  return rows.map(toReceiptFrame);
}


export async function recordReceiptFrameFailure(frameId: string, errorKind: string): Promise<void> {
  await db().runAsync(
    "UPDATE receipt_frames SET status = 'failed', last_error_kind = ? WHERE id = ?",
    [errorKind, frameId],
  );
}


/** Stores one frame's complete raw result, then rematerializes the review draft. */
export async function recordReceiptFrameExtraction(
  frameId: string,
  extracted: ExtractedReceiptHeader,
): Promise<void> {
  const now = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (txn) => {
    const frame = await txn.getFirstAsync<Pick<ReceiptFrameRow, 'receipt_id'>>(
      'SELECT receipt_id FROM receipt_frames WHERE id = ?',
      [frameId],
    );
    if (!frame) throw new Error('Receipt frame not found.');
    const receipt = await txn.getFirstAsync<Pick<ReceiptRow, 'frame_edits_locked'>>(
      'SELECT frame_edits_locked FROM receipts WHERE id = ?',
      [frame.receipt_id],
    );
    if (receipt?.frame_edits_locked === 1) throw new ReceiptFrameEditsLockedError();
    await txn.runAsync('DELETE FROM receipt_frame_lines WHERE frame_id = ?', [frameId]);
    await txn.runAsync(
      `UPDATE receipt_frames
       SET status = 'extracted', last_error_kind = NULL, store = ?, purchased_at = ?, receipt_type = ?,
           subtotal_cents = ?, tax_cents = ?, total_cents = ?, extraction_source = ?, extracted_at = ?
       WHERE id = ?`,
      [
        extracted.store,
        extracted.purchasedAt,
        extracted.receiptType,
        extracted.subtotalCents,
        extracted.taxCents,
        extracted.totalCents,
        extracted.extractionSource ?? 'cloud_vision',
        now,
        frameId,
      ],
    );
    for (const [position, line] of extracted.lines.entries()) {
      await txn.runAsync(
        `INSERT INTO receipt_frame_lines
           (id, frame_id, frame_position, raw_text, kind, qty, unit, quantity_kind, line_total_cents,
            unit_price_cents, applies_to_text, ocr_confidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), frameId, position, line.rawText, line.kind, line.qty, line.unit,
          line.quantityKind, line.lineTotalCents, line.unitPriceCents, line.appliesToText,
          line.ocrConfidence ?? null, now,
        ],
      );
    }
  });
  const frame = await db().getFirstAsync<Pick<ReceiptFrameRow, 'receipt_id'>>(
    'SELECT receipt_id FROM receipt_frames WHERE id = ?',
    [frameId],
  );
  if (!frame) throw new Error('Receipt frame not found.');
  await rebuildReceiptFromReceipt(frame.receipt_id);
}


/** Recreates unreviewed receipt lines from all extracted frames of one receipt. */
async function rebuildReceiptFromReceipt(receiptId: string): Promise<void> {
  await db().withExclusiveTransactionAsync(async (txn) => {
    const frames = await txn.getAllAsync<ReceiptFrameRow>(
      "SELECT * FROM receipt_frames WHERE receipt_id = ? AND status = 'extracted' ORDER BY sort_order ASC",
      [receiptId],
    );
    const rawLines = await txn.getAllAsync<ReceiptFrameLineRow>(
      `SELECT receipt_frame_lines.* FROM receipt_frame_lines
       JOIN receipt_frames ON receipt_frames.id = receipt_frame_lines.frame_id
       WHERE receipt_frames.receipt_id = ? AND receipt_frames.status = 'extracted'
       ORDER BY receipt_frames.sort_order ASC, receipt_frame_lines.frame_position ASC`,
      [receiptId],
    );
    const linesByFrame = new Map<string, ReceiptFrameLineInput[]>();
    for (const line of rawLines) {
      const lines = linesByFrame.get(line.frame_id) ?? [];
      lines.push({
        rawText: line.raw_text, kind: line.kind, qty: line.qty, unit: line.unit,
        quantityKind: line.quantity_kind, lineTotalCents: line.line_total_cents,
        unitPriceCents: line.unit_price_cents, appliesToText: line.applies_to_text,
        ocrConfidence: line.ocr_confidence,
      });
      linesByFrame.set(line.frame_id, lines);
    }
    const merged = mergeReceiptFrameLines(frames.map((item) => ({
      frameId: item.id,
      lines: linesByFrame.get(item.id) ?? [],
    })));
    const header = [...frames].reverse().find((item) => item.total_cents !== null) ?? frames.at(-1);
    const now = new Date().toISOString();
    await txn.runAsync('DELETE FROM receipt_lines WHERE receipt_id = ?', [receiptId]);
    if (!header) {
      await txn.runAsync(
        `UPDATE receipts SET store = NULL, type = 'grocery', subtotal_cents = NULL, tax_cents = NULL, total_cents = NULL
         WHERE id = ?`,
        [receiptId],
      );
      return;
    }
    const ids = merged.map(() => randomUUID());
    const idByRawText = new Map<string, string>();
    merged.forEach((line, index) => {
      if (!idByRawText.has(line.rawText)) idByRawText.set(line.rawText, ids[index]!);
    });
    await txn.runAsync(
      `UPDATE receipts SET store = ?, purchased_at = ?, type = ?, subtotal_cents = ?, tax_cents = ?, total_cents = ?
       WHERE id = ?`,
      [header.store, header.purchased_at, header.receipt_type, header.subtotal_cents,
        header.tax_cents, header.total_cents, receiptId],
    );
    for (const [index, line] of merged.entries()) {
      await txn.runAsync(
        `INSERT INTO receipt_lines
           (id, receipt_id, raw_text, kind, qty, unit, quantity_kind, line_total_cents,
            unit_price_cents, canonical_id, applies_to_line_id, pantry_item_id, excluded,
            ocr_confidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 0, ?, ?)`,
        [ids[index]!, receiptId, line.rawText, line.kind, line.qty, line.unit,
          line.quantityKind, line.lineTotalCents, line.unitPriceCents,
          line.appliesToText ? (idByRawText.get(line.appliesToText) ?? null) : null,
          line.ocrConfidence ?? null, now],
      );
    }
  });
}


/** Removes one retained frame and rematerializes the draft from the survivors. */
export async function removeReceiptFrame(receiptId: string, frameId: string): Promise<string> {
  await assertReceiptFramesEditable(receiptId);
  const frame = await db().getFirstAsync<ReceiptFrameRow>(
    'SELECT * FROM receipt_frames WHERE id = ? AND receipt_id = ?',
    [frameId, receiptId],
  );
  if (!frame) throw new Error('Receipt frame not found.');
  const count = await db().getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM receipt_frames WHERE receipt_id = ?',
    [receiptId],
  );
  if ((count?.count ?? 0) <= 1) throw new Error('A receipt needs at least one photo.');
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM receipt_frames WHERE id = ?', [frameId]);
    await txn.runAsync(
      `UPDATE receipt_frames
       SET sort_order = sort_order - 1
       WHERE receipt_id = ? AND sort_order > ?`,
      [receiptId, frame.sort_order],
    );
  });
  await rebuildReceiptFromReceipt(receiptId);
  return frame.image_uri;
}


/** Replaces one durable source image while retaining its place in the receipt. */
export async function replaceReceiptFrame(
  receiptId: string,
  frameId: string,
  imageUri: string,
): Promise<string> {
  await assertReceiptFramesEditable(receiptId);
  const frame = await db().getFirstAsync<ReceiptFrameRow>(
    'SELECT * FROM receipt_frames WHERE id = ? AND receipt_id = ?',
    [frameId, receiptId],
  );
  if (!frame) throw new Error('Receipt frame not found.');
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM receipt_frame_lines WHERE frame_id = ?', [frameId]);
    await txn.runAsync(
      `UPDATE receipt_frames
       SET image_uri = ?, status = 'pending', last_error_kind = NULL, store = NULL, purchased_at = NULL,
           receipt_type = NULL, subtotal_cents = NULL, tax_cents = NULL, total_cents = NULL, extracted_at = NULL
       WHERE id = ?`,
      [imageUri, frameId],
    );
  });
  await rebuildReceiptFromReceipt(receiptId);
  return frame.image_uri;
}


/** Retains an uninterpretable capture without storing a credential or result. */
export async function insertPendingCapture(
  imageUri: string,
  detectedKind: PendingCaptureKind | null = null,
): Promise<PendingCapture> {
  const count = await db().getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM pending_captures',
  );
  if ((count?.count ?? 0) >= MAX_PENDING_CAPTURES) throw new PendingCaptureLimitError();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO pending_captures
       (id, image_uri, detected_kind, status, retry_count, last_error_kind, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?)`,
    [id, imageUri, detectedKind, now, now],
  );
  return { id, imageUri, detectedKind, status: 'pending', retryCount: 0, lastErrorKind: null, createdAt: now, updatedAt: now };
}


export async function listPendingCaptures(): Promise<PendingCapture[]> {
  const rows = await db().getAllAsync<PendingCaptureRow>(
    'SELECT * FROM pending_captures ORDER BY created_at ASC',
  );
  return rows.map(toPendingCapture);
}


export async function getPendingCapture(id: string): Promise<PendingCapture | null> {
  const row = await db().getFirstAsync<PendingCaptureRow>(
    'SELECT * FROM pending_captures WHERE id = ?', [id],
  );
  return row ? toPendingCapture(row) : null;
}


export async function recordPendingCaptureAttempt(
  id: string,
  errorKind: string | null,
  failed: boolean,
): Promise<void> {
  await db().runAsync(
    `UPDATE pending_captures
     SET retry_count = retry_count + 1, last_error_kind = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [errorKind, failed ? 'failed' : 'pending', new Date().toISOString(), id],
  );
}


export async function removePendingCapture(id: string): Promise<string | null> {
  const capture = await db().getFirstAsync<PendingCaptureRow>(
    'SELECT * FROM pending_captures WHERE id = ?', [id],
  );
  if (!capture) return null;
  await db().runAsync('DELETE FROM pending_captures WHERE id = ?', [id]);
  return capture.image_uri;
}


/**
 * Attaches a completed extraction to a captured receipt: the header
 * fields extraction read (or corrected from the capture-time defaults)
 * and every line. Called once, when the receipt has no lines yet.
 *
 * Line ids are generated before the insert loop so a discount's
 * `appliesToText` can be resolved to a sibling line's real id in the same
 * pass — the attribution decision.md calls for, without a second query.
 */
export async function attachExtractedLines(
  receiptId: string,
  extracted: ExtractedReceiptHeader,
): Promise<void> {
  const frame = await db().getFirstAsync<ReceiptFrameRow>(
    'SELECT * FROM receipt_frames WHERE receipt_id = ? ORDER BY sort_order ASC LIMIT 1', [receiptId],
  );
  if (frame) {
    await recordReceiptFrameExtraction(frame.id, extracted);
    return;
  }
  const now = new Date().toISOString();
  const ids = extracted.lines.map(() => randomUUID());
  const idByRawText = new Map<string, string>();
  extracted.lines.forEach((line, index) => {
    if (!idByRawText.has(line.rawText)) idByRawText.set(line.rawText, ids[index]!);
  });

  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE receipts SET store = ?, purchased_at = ?, type = ?, subtotal_cents = ?, tax_cents = ?, total_cents = ?
       WHERE id = ?`,
      [
        extracted.store,
        extracted.purchasedAt,
        extracted.receiptType,
        extracted.subtotalCents,
        extracted.taxCents,
        extracted.totalCents,
        receiptId,
      ],
    );
    for (const [index, line] of extracted.lines.entries()) {
      const appliesToLineId = line.appliesToText
        ? (idByRawText.get(line.appliesToText) ?? null)
        : null;
      await txn.runAsync(
        `INSERT INTO receipt_lines
           (id, receipt_id, raw_text, kind, qty, unit, quantity_kind, line_total_cents,
            unit_price_cents, canonical_id, applies_to_line_id, pantry_item_id, excluded,
            ocr_confidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 0, ?, ?)`,
        [
          ids[index]!,
          receiptId,
          line.rawText,
          line.kind,
          line.qty,
          line.unit,
          line.quantityKind,
          line.lineTotalCents,
          line.unitPriceCents,
          appliesToLineId,
          line.ocrConfidence ?? null,
          now,
        ],
      );
    }
  });
}


export async function getReceipt(id: string): Promise<ReceiptWithLines | null> {
  const row = await db().getFirstAsync<ReceiptRow>(
    'SELECT * FROM receipts WHERE id = ?',
    [id],
  );
  if (!row) return null;
  const lineRows = await db().getAllAsync<ReceiptLineRow>(
    'SELECT * FROM receipt_lines WHERE receipt_id = ? ORDER BY rowid ASC',
    [id],
  );
  return { ...toReceipt(row), lines: lineRows.map(toReceiptLine) };
}


/** Every receipt, most recently purchased first. */
export async function listReceipts(): Promise<Receipt[]> {
  const rows = await db().getAllAsync<ReceiptRow>(
    'SELECT * FROM receipts ORDER BY purchased_at DESC, created_at DESC',
  );
  return rows.map(toReceipt);
}


/**
 * Sets a line's matched ingredient — written by resolution when a line
 * settles, and by the user correcting a match during review. The caller is
 * responsible for teaching the matcher a correction via `confirmMatch`;
 * this only updates the receipt's own record.
 */
export async function setReceiptLineCanonical(
  lineId: string,
  canonicalId: string | null,
  manual = false,
): Promise<void> {
  await db().runAsync('UPDATE receipt_lines SET canonical_id = ? WHERE id = ?', [
    canonicalId,
    lineId,
  ]);
  if (manual) await lockReceiptFrameEdits(lineId);
}


/** A quantity or price correction made during review. */
export async function setReceiptLineDetails(
  lineId: string,
  details: { qty: number | null; unit: MeasureUnit | null; lineTotalCents: number | null },
): Promise<void> {
  await db().runAsync(
    'UPDATE receipt_lines SET qty = ?, unit = ?, line_total_cents = ? WHERE id = ?',
    [details.qty, details.unit, details.lineTotalCents, lineId],
  );
  await lockReceiptFrameEdits(lineId);
}


/** Excluding a line during review: it creates no pantry item and is not queued (spec). */
export async function setReceiptLineExcluded(
  lineId: string,
  excluded: boolean,
): Promise<void> {
  await db().runAsync('UPDATE receipt_lines SET excluded = ? WHERE id = ?', [
    excluded ? 1 : 0,
    lineId,
  ]);
  await lockReceiptFrameEdits(lineId);
}


/**
 * Reclassifies a line — recovery from a wrong non-food call (task 8.3). The
 * caller re-resolves afterward if the new kind is `food`; this only
 * updates the record.
 */
export async function setReceiptLineKind(
  lineId: string,
  kind: ReceiptLineKind,
): Promise<void> {
  await db().runAsync('UPDATE receipt_lines SET kind = ? WHERE id = ?', [kind, lineId]);
  await lockReceiptFrameEdits(lineId);
}


/** Any human line edit makes a whole-draft frame rebuild destructive. */
async function lockReceiptFrameEdits(lineId: string): Promise<void> {
  await db().runAsync(
    `UPDATE receipts SET frame_edits_locked = 1
     WHERE id = (SELECT receipt_id FROM receipt_lines WHERE id = ?)`,
    [lineId],
  );
}


export async function setReceiptType(
  receiptId: string,
  type: ReceiptType,
): Promise<void> {
  await db().runAsync('UPDATE receipts SET type = ? WHERE id = ?', [type, receiptId]);
}


export async function discardReceipt(id: string): Promise<void> {
  await db().runAsync("UPDATE receipts SET status = 'discarded' WHERE id = ?", [id]);
}


/** Removes an unaccepted receipt draft and returns its unshared image URI. */
export async function deletePendingReceiptDraft(id: string): Promise<string | null> {
  const receipt = await db().getFirstAsync<ReceiptRow>(
    "SELECT * FROM receipts WHERE id = ? AND status = 'pending'", [id],
  );
  if (!receipt) return null;
  await db().runAsync("DELETE FROM receipts WHERE id = ? AND status = 'pending'", [id]);
  return receipt.image_uri;
}


/** Removes a pending receipt draft and returns every distinct retained frame image. */
export async function deletePendingReceiptFrames(id: string): Promise<string[]> {
  const receipt = await db().getFirstAsync<ReceiptRow>(
    "SELECT * FROM receipts WHERE id = ? AND status = 'pending'", [id],
  );
  if (!receipt) return [];
  const frames = await db().getAllAsync<{ image_uri: string }>(
    'SELECT image_uri FROM receipt_frames WHERE receipt_id = ?', [id],
  );
  await db().runAsync("DELETE FROM receipts WHERE id = ? AND status = 'pending'", [id]);
  return [...new Set(frames.map((frame) => frame.image_uri).concat(receipt.image_uri))];
}


/**
 * Removes the pantry items this receipt's lines created, and forgets the
 * link — used when the receipt type changes away from grocery after
 * having already been applied (task 8.4's "re-planning rather than
 * undoing"). Reconciliation side effects on *other* items (a mark as
 * replaced, an asked-once flag) are not reversed: the spec asks only that
 * the created items go, not that the rest of the catalogue's history be
 * rewritten.
 */
export async function clearReceiptPantryItems(receiptId: string): Promise<void> {
  await db().withExclusiveTransactionAsync(async (txn) => {
    // The authoritative link: a count line's several containers all carry
    // receipt_line_id, where receipt_lines.pantry_item_id only ever named one.
    await txn.runAsync(
      `DELETE FROM pantry_items WHERE receipt_line_id IN
         (SELECT id FROM receipt_lines WHERE receipt_id = ?)`,
      [receiptId],
    );
    await txn.runAsync(
      `UPDATE receipt_lines SET pantry_item_id = NULL WHERE receipt_id = ?`,
      [receiptId],
    );
  });
}


/**
 * Applies a receipt's planned changes in one transaction: creates the
 * pantry items a grocery receipt's resolved lines call for, links each
 * line to the item it created, marks superseded items replaced, flags
 * running-low items for the asked-once prompt, and marks the receipt
 * applied. Nothing is applied before this runs (task 6.3) — an abandoned
 * review simply never calls it, leaving no trace.
 */
export async function applyReceiptChanges(
  receiptId: string,
  changes: readonly PantryChange[],
): Promise<void> {
  const now = new Date().toISOString();
  // A count line creates several items from one `create` change each; only
  // the first links back via receipt_lines.pantry_item_id (a single-item
  // pointer, kept for the common case). `pantry_items.receipt_line_id` is
  // the authoritative one-to-many link every item gets, count or not.
  const linkedLines = new Set<string>();

  await db().withExclusiveTransactionAsync(async (txn) => {
    for (const change of changes) {
      if (change.kind === 'create') {
        const itemId = randomUUID();
        const { item } = change;
        const expiresAt = await predictExpiryWithin(txn, item.canonicalId, item.locationId, item.purchasedAt);
        await txn.runAsync(
          `INSERT INTO pantry_items
             (id, canonical_id, product_id, location_id, qty_remaining, qty_unit,
              qty_source, fullness, uses_count, purchased_at, opened_at, expires_at,
              expiry_source, price_cents, photo_uri, status, receipt_line_id, created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, 0, ?, NULL, ?, ?, ?, NULL, 'in_stock', ?, ?, ?)`,
          [
            itemId,
            item.canonicalId,
            item.locationId,
            item.qtyRemaining,
            item.qtyUnit,
            item.qtyRemaining != null ? 'estimate' : null,
            item.purchasedAt,
            expiresAt,
            expiresAt != null ? 'predicted' : null,
            item.priceCents,
            change.lineId,
            now,
            now,
          ],
        );
        if (!linkedLines.has(change.lineId)) {
          linkedLines.add(change.lineId);
          await txn.runAsync(
            'UPDATE receipt_lines SET pantry_item_id = ? WHERE id = ?',
            [itemId, change.lineId],
          );
        }
      } else if (change.kind === 'mark_replaced') {
        await txn.runAsync(
          "UPDATE pantry_items SET status = 'replaced', updated_at = ? WHERE id = ?",
          [now, change.pantryItemId],
        );
      } else {
        await txn.runAsync(
          'UPDATE pantry_items SET replacement_asked = 1, updated_at = ? WHERE id = ?',
          [now, change.pantryItemId],
        );
      }
    }

    await txn.runAsync("UPDATE receipts SET status = 'applied' WHERE id = ?", [receiptId]);
  });
}


/** Expiry prediction for a receipt-created item, read fresh within the transaction. */
async function predictExpiryWithin(
  txn: TransactionHandle,
  canonicalId: string,
  locationId: string,
  purchasedAt: string,
): Promise<string | null> {
  const canonical = await txn.getFirstAsync<CanonicalItemRow>(
    'SELECT * FROM canonical_items WHERE id = ?',
    [canonicalId],
  );
  const location = await txn.getFirstAsync<LocationRow>(
    'SELECT * FROM locations WHERE id = ?',
    [locationId],
  );
  if (!canonical || !location) return null;
  return predictExpiry(
    toCanonicalItem(canonical),
    location.kind as LocationKind,
    purchasedAt,
    null,
  );
}
