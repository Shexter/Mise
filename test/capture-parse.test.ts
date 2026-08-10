import { expect, test } from 'vitest';

import { parseCaptureResponse } from '../src/api/capture';

test('parses each capture kind and keeps several items separate', () => {
  expect(parseCaptureResponse('{"kind":"receipt","receipt_lines":[{"text":"MILK"}]}')).toEqual({ kind: 'receipt', lines: [{ text: 'MILK' }] });
  expect(parseCaptureResponse('{"kind":"items","items":[{"name":"Milk","quantity":1,"unit":"piece"},{"name":"Rice","quantity":2,"unit":"kg"}]}')).toEqual({ kind: 'items', items: [{ name: 'Milk', quantity: 1, unit: 'piece' }, { name: 'Rice', quantity: 2, unit: null }] });
  expect(parseCaptureResponse('{"kind":"other"}')).toEqual({ kind: 'unclear' });
  expect(parseCaptureResponse('{"kind":"nothing"}')).toEqual({ kind: 'nothing' });
});
