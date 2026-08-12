import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const sharedCapture = readFileSync('app/pantry-capture.tsx', 'utf8');
const receiptCapture = readFileSync('app/receipt-capture.tsx', 'utf8');
const receiptReview = readFileSync('app/receipt-review.tsx', 'utf8');

describe('receipt entry through unified capture', () => {
  it('reuses an unclear shared photo when the user identifies it as a receipt', () => {
    expect(sharedCapture).toContain('reviewUnclearAsReceipt(photo!)');
    expect(sharedCapture).toContain('captureReceipt(');
    expect(sharedCapture).not.toContain("router.replace('/receipt-capture')");
  });

  it('keeps the receipt camera only as an existing-review frame handler', () => {
    expect(receiptCapture).toContain("if (!receiptId) router.replace('/pantry-capture')");
    expect(receiptCapture).not.toContain('captureReceipt(');
    expect(receiptCapture).toContain('addReceiptPhoto(');
    expect(receiptCapture).toContain('retakeReceiptPhoto(');
    expect(receiptReview).toContain("pathname: '/receipt-capture', params: { receiptId: receipt.id }");
  });
});
