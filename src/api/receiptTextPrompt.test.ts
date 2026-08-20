import { describe, expect, test } from 'vitest';

import {
  buildReceiptTextPrompt,
  parseReceiptTextResponse,
} from '@/api/receiptTextPrompt';
import type { OcrLine } from '@/types';

const ocrLine = (text: string, order: number): OcrLine => ({
  text,
  order,
  boundingBox: { x: 10, y: order * 20, width: 200, height: 16 },
  confidence: 0.9,
});

describe('buildReceiptTextPrompt', () => {
  test('includes the exact ReceiptExtracted fields and preserves string lines', () => {
    const lines = ['Mise Market', 'MILK 3.99'];
    const prompt = buildReceiptTextPrompt(lines);

    expect(prompt.system).toContain('"rawName"');
    expect(prompt.system).toContain('"lineTotalCents"');
    expect(prompt.system).toContain('"storeName"');
    expect(prompt.system).toContain('"subtotalCents"');
    expect(JSON.parse(prompt.user)).toMatchObject({ lines });
    expect(lines).toEqual(['Mise Market', 'MILK 3.99']);
  });

  test('accepts OcrLine input without serialising geometry or mutating it', () => {
    const lines = [ocrLine('BREAD 2.99', 2), ocrLine('TOTAL 2.99', 3)];
    const before = structuredClone(lines);
    const body = JSON.parse(buildReceiptTextPrompt(lines).user) as { lines: string[] };

    expect(body.lines).toEqual(['BREAD 2.99', 'TOTAL 2.99']);
    expect(lines).toEqual(before);
  });

  test('keeps an empty OCR input explicit', () => {
    const body = JSON.parse(buildReceiptTextPrompt([]).user) as { lines: string[] };
    expect(body.lines).toEqual([]);
  });
});

describe('parseReceiptTextResponse', () => {
  test('parses the full schema and keeps non-food flags', () => {
    const parsed = parseReceiptTextResponse(JSON.stringify({
      items: [
        { rawName: 'BANANAS', quantity: 500, unit: 'g', lineTotalCents: 149, isFood: true },
        { rawName: 'PAPER TOWELS', quantity: null, unit: null, lineTotalCents: 699, isFood: false },
      ],
      storeName: 'Mise Market',
      totalCents: 769,
      subtotalCents: 848,
      taxCents: 70,
      date: '2026-08-20',
    }));

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[1]?.isFood).toBe(false);
    expect(parsed.storeName).toBe('Mise Market');
    expect(parsed.date).toBe('2026-08-20');
  });

  test('extracts fenced JSON and defensively coerces numeric strings', () => {
    const parsed = parseReceiptTextResponse(`Here is the result:\n\`\`\`json
      {"items":[{"rawName":"  MILK  ","quantity":"2","unit":"piece","lineTotalCents":"798","isFood":"true"}],"totalCents":"798"}
      \`\`\``);

    expect(parsed.items[0]).toEqual({
      rawName: 'MILK', quantity: 2, unit: 'piece', lineTotalCents: 798, isFood: true,
    });
    expect(parsed.totalCents).toBe(798);
  });

  test('drops malformed items and never carries a unit without a quantity', () => {
    const parsed = parseReceiptTextResponse(JSON.stringify({
      items: [
        null,
        { rawName: '   ', quantity: 2, unit: 'piece', lineTotalCents: 100 },
        { rawName: 'UNKNOWN', quantity: 0, unit: 'kg', lineTotalCents: 'not money' },
      ],
      date: '2026-02-30',
    }));

    expect(parsed.items).toEqual([
      { rawName: 'UNKNOWN', quantity: null, unit: null, lineTotalCents: null, isFood: true },
    ]);
    expect(parsed.date).toBeNull();
  });

  test('returns an empty, unknown receipt for an empty object', () => {
    expect(parseReceiptTextResponse('{}')).toEqual({
      items: [], storeName: null, totalCents: null,
      subtotalCents: null, taxCents: null, date: null,
    });
  });

  test('throws a controlled malformed error for non-JSON content', () => {
    expect(() => parseReceiptTextResponse('no structured receipt here')).toThrow(
      'The receipt text could not be structured.',
    );
  });
});
