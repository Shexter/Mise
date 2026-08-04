import { NON_FOOD_LINES, RECEIPT_LINES } from '@/logic/__fixtures__/receipt-lines';
import type { MeasureUnit, ReceiptLineKind, ReceiptType } from '@/types';

/**
 * Whole receipts, as the extraction call would return them — recorded raw
 * JSON, matching `receiptPrompt.ts`'s schema, so parsing and planning run
 * against real-shaped output with no provider in the loop.
 *
 * Food lines are drawn from `RECEIPT_LINES` (the matcher's own corpus)
 * rather than invented, so a fixture receipt resolves against the real
 * seed canonicals the way an actual receipt would (task 5.4's "extraction
 * stubbed, matching real"). Non-food lines reuse `NON_FOOD_LINES` per task
 * 1.3, rather than a second list drifting from the first.
 */

interface ExtractedLineJson {
  text: string;
  kind: ReceiptLineKind;
  qty: number | null;
  unit: MeasureUnit | null;
  line_total_cents: number | null;
  unit_price_cents: number | null;
}

interface ExtractedReceiptJson {
  store: string | null;
  purchased_at: string | null;
  receipt_type: ReceiptType;
  total_cents: number | null;
  lines: ExtractedLineJson[];
}

export interface ReceiptFixture {
  name: string;
  /** What extraction would return, if there were no legible date on the receipt. */
  captureDate: string;
  recordedResponse: string;
}

/** A food line at a plausible single price, no multiple. */
function food(
  text: string,
  qty: number,
  unit: MeasureUnit,
  cents: number,
): ExtractedLineJson {
  return {
    text,
    kind: 'food',
    qty,
    unit,
    line_total_cents: cents,
    unit_price_cents: null,
  };
}

/** A count-multiple food line, carrying both prices (spec's "a multiple records both prices"). */
function multiple(
  text: string,
  count: number,
  unitCents: number,
): ExtractedLineJson {
  return {
    text,
    kind: 'food',
    qty: count,
    unit: 'piece',
    line_total_cents: count * unitCents,
    unit_price_cents: unitCents,
  };
}

function nonFood(text: string): ExtractedLineJson {
  return {
    text,
    kind: 'non_food',
    qty: null,
    unit: null,
    line_total_cents: null,
    unit_price_cents: null,
  };
}

function arithmetic(text: string, cents: number | null = null): ExtractedLineJson {
  return { text, kind: 'arithmetic', qty: null, unit: null, line_total_cents: cents, unit_price_cents: null };
}

function discount(text: string, cents: number): ExtractedLineJson {
  return {
    text,
    kind: 'discount',
    qty: null,
    unit: null,
    line_total_cents: -Math.abs(cents),
    unit_price_cents: null,
  };
}

/** The standard arithmetic and payment tail every receipt fixture ends with (task 1.2). */
function tail(subtotalCents: number, taxCents: number): ExtractedLineJson[] {
  const totalCents = subtotalCents + taxCents;
  return [
    arithmetic('SUBTOTAL', subtotalCents),
    arithmetic('TAX', taxCents),
    arithmetic('TOTAL', totalCents),
    arithmetic('VISA ****4471'),
    arithmetic('CHANGE DUE 0.00', 0),
  ];
}

function byRaw(raw: string): { raw: string; slug: string | null } {
  const entry = RECEIPT_LINES.find((line) => line.raw === raw);
  if (!entry) throw new Error(`Fixture line not found in RECEIPT_LINES: ${raw}`);
  return entry;
}

const RESPONSES: Record<string, ExtractedReceiptJson> = {
  supermarketOne: {
    store: 'Fresh Market',
    purchased_at: '2026-06-01',
    receipt_type: 'grocery',
    total_cents: 3427,
    lines: [
      food(byRaw('KIKKO SOY 500ML').raw, 500, 'ml', 389),
      food(byRaw('SESAME OIL 250ML').raw, 250, 'ml', 599),
      food(byRaw('JASMINE RICE 5LB').raw, 2268, 'g', 799),
      food(byRaw('BANANAS 0.62 LB @ 0.59/LB').raw, 281, 'g', 37),
      food(byRaw('GRND PORK 1LB').raw, 454, 'g', 499),
      food(byRaw('LRG EGGS 12CT').raw, 12, 'piece', 429),
      nonFood('PAPER TOWELS 6CT'),
      ...tail(3152, 275),
    ],
  },

  supermarketTwo: {
    store: 'Kroger',
    purchased_at: '2026-06-03',
    receipt_type: 'grocery',
    total_cents: 2216,
    lines: [
      food(byRaw('GV SOY SAUCE 15OZ').raw, 443, 'ml', 289),
      food(byRaw('OYSTER SAUCE 510G').raw, 510, 'g', 449),
      food(byRaw('SPAGHETTI 16OZ').raw, 454, 'g', 179),
      food(byRaw('WHL MILK 1GAL').raw, 3785, 'ml', 399),
      food(byRaw('GRN ONION BNCH').raw, 1, 'piece', 149),
      nonFood('AA BATTERIES 4PK'),
      ...tail(1465, 115),
    ],
  },

  asianGrocer: {
    store: "H Mart",
    purchased_at: '2026-06-05',
    receipt_type: 'grocery',
    total_cents: 2887,
    lines: [
      food(byRaw('白菜').raw, 1, 'piece', 349),
      food(byRaw('豆腐').raw, 396, 'g', 229),
      food(byRaw('海天生抽').raw, 500, 'ml', 379),
      food(byRaw('冷凍餃子').raw, 454, 'g', 599),
      food(byRaw('고추장 500G').raw, 500, 'g', 649),
      nonFood('DISH SOAP REFILL'),
      ...tail(2705, 182),
    ],
  },

  warehouseClub: {
    store: 'Costco Wholesale',
    purchased_at: '2026-06-08',
    receipt_type: 'grocery',
    total_cents: 7659,
    lines: [
      food(byRaw('KS ORG EVOO 2L').raw, 2000, 'ml', 1899),
      food(byRaw('ORG CHKN BRST BNLS').raw, 2268, 'g', 1899),
      multiple('KS BOTTLED WATER 40CT', 2, 999),
      multiple('FRZ DUMPLINGS 3LB BAG', 2, 1299),
      food(byRaw('SHREDDED CHED CHSE').raw, 907, 'g', 1099),
      ...tail(7093, 566),
    ],
  },

  restaurant: {
    store: 'Golden Wok',
    purchased_at: '2026-06-10',
    receipt_type: 'restaurant',
    total_cents: 4850,
    lines: [
      food('Gochujang Pork Belly', 1, 'serving', 1895),
      food('Kimchi Fried Rice', 1, 'serving', 1595),
      food('Iced Tea x2', 2, 'serving', 700),
      arithmetic('SUBTOTAL', 4190),
      arithmetic('TAX', 335),
      arithmetic('TIP', 325),
      arithmetic('TOTAL', 4850),
      arithmetic('MASTERCARD ****9910'),
    ],
  },

  noLegibleDate: {
    store: 'Corner Grocer',
    purchased_at: null,
    receipt_type: 'grocery',
    total_cents: 1247,
    lines: [
      food(byRaw('FISH SAUCE 24OZ').raw, 710, 'ml', 549),
      food(byRaw('RICE VINEGAR 296ML').raw, 296, 'ml', 379),
      ...tail(928, 74),
    ],
  },

  heavyNonFood: {
    store: 'Super Value',
    purchased_at: '2026-06-14',
    receipt_type: 'grocery',
    total_cents: 4218,
    lines: [
      food(byRaw('SRIRACHA 17OZ').raw, 482, 'ml', 449),
      ...NON_FOOD_LINES.map((raw) => nonFood(raw)),
      discount('MFR COUPON -0.50', 50),
      ...tail(3899, 269),
    ],
  },

  multiQuantity: {
    store: 'ValueMart',
    purchased_at: '2026-06-17',
    receipt_type: 'grocery',
    total_cents: 2156,
    lines: [
      multiple('CANNED BLACK BEANS', 4, 129),
      multiple('GREEK YOGURT 5.3OZ', 6, 119),
      multiple(byRaw('LRG EGGS 12CT').raw, 2, 429),
      food(byRaw('ATLANTIC SALMON FIL').raw, 340, 'g', 899),
      ...tail(1980, 176),
    ],
  },
};

function toFixture(name: string, captureDate: string): ReceiptFixture {
  const response = RESPONSES[name];
  if (!response) throw new Error(`Unknown receipt fixture: ${name}`);
  return {
    name,
    captureDate,
    recordedResponse: JSON.stringify(response),
  };
}

export const RECEIPTS: readonly ReceiptFixture[] = [
  toFixture('supermarketOne', '2026-06-01'),
  toFixture('supermarketTwo', '2026-06-03'),
  toFixture('asianGrocer', '2026-06-05'),
  toFixture('warehouseClub', '2026-06-08'),
  toFixture('restaurant', '2026-06-10'),
  toFixture('noLegibleDate', '2026-06-12'),
  toFixture('heavyNonFood', '2026-06-14'),
  toFixture('multiQuantity', '2026-06-17'),
];
