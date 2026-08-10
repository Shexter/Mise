import { expect, test } from 'vitest';

import { parseCaptureResponse } from '../src/api/capture';

test('parses each capture kind and keeps several items separate', () => {
  expect(parseCaptureResponse('{"kind":"receipt","receipt":{"store":"Test","purchased_at":"2026-08-09","receipt_type":"grocery","subtotal_cents":100,"tax_cents":5,"total_cents":105,"lines":[{"text":"MILK","kind":"food","qty":1,"unit":"piece","quantity_kind":"count","line_total_cents":100,"unit_price_cents":100,"applies_to_text":null}]}}')).toMatchObject({ kind: 'receipt', receipt: { store: 'Test', purchasedAt: '2026-08-09', lines: [{ text: 'MILK' }] } });
  expect(parseCaptureResponse('{"kind":"items","items":[{"name":"Milk","quantity":1,"unit":"piece"},{"name":"Rice","quantity":2,"unit":"kg"}]}')).toEqual({ kind: 'items', items: [{ name: 'Milk', quantity: 1, unit: 'piece' }, { name: 'Rice', quantity: 2, unit: null }] });
  expect(parseCaptureResponse('{"kind":"other"}')).toEqual({ kind: 'unclear' });
  expect(parseCaptureResponse('{"kind":"nothing"}')).toEqual({ kind: 'nothing' });
});
