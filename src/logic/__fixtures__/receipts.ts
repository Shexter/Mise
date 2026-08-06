import { NON_FOOD_LINES, RECEIPT_LINES } from '@/logic/__fixtures__/receipt-lines';
import type {
  MeasureUnit,
  QuantityKind,
  ReceiptLineKind,
  ReceiptType,
} from '@/types';

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
  quantity_kind: QuantityKind | null;
  line_total_cents: number | null;
  unit_price_cents: number | null;
  applies_to_text: string | null;
}

interface ExtractedReceiptJson {
  store: string | null;
  purchased_at: string | null;
  receipt_type: ReceiptType;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  lines: ExtractedLineJson[];
}

export interface ReceiptFixture {
  name: string;
  /** What extraction would return, if there were no legible date on the receipt. */
  captureDate: string;
  recordedResponse: string;
}

/** A single-container food line — a measure (weight/volume) or a fixed content ("12 eggs in one carton"). */
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
    quantity_kind: 'measure',
    line_total_cents: cents,
    unit_price_cents: null,
    applies_to_text: null,
  };
}

/** A count-multiple food line: several separate containers, carrying both prices (spec's "a multiple records both prices"). */
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
    quantity_kind: 'count',
    line_total_cents: count * unitCents,
    unit_price_cents: unitCents,
    applies_to_text: null,
  };
}

function nonFood(text: string): ExtractedLineJson {
  return {
    text,
    kind: 'non_food',
    qty: null,
    unit: null,
    quantity_kind: null,
    line_total_cents: null,
    unit_price_cents: null,
    applies_to_text: null,
  };
}

function arithmetic(text: string, cents: number | null = null): ExtractedLineJson {
  return {
    text,
    kind: 'arithmetic',
    qty: null,
    unit: null,
    quantity_kind: null,
    line_total_cents: cents,
    unit_price_cents: null,
    applies_to_text: null,
  };
}

/** An unattributable, basket-wide discount — names no line. */
function discount(text: string, cents: number): ExtractedLineJson {
  return {
    text,
    kind: 'discount',
    qty: null,
    unit: null,
    quantity_kind: null,
    line_total_cents: -Math.abs(cents),
    unit_price_cents: null,
    applies_to_text: null,
  };
}

/** A line-attributed discount — reduces the named line's price specifically. */
function discountFor(text: string, cents: number, targetText: string): ExtractedLineJson {
  return {
    text,
    kind: 'discount',
    qty: null,
    unit: null,
    quantity_kind: null,
    line_total_cents: -Math.abs(cents),
    unit_price_cents: null,
    applies_to_text: targetText,
  };
}

/** A container deposit or bag levy — spending, never an ingredient. */
function deposit(text: string, cents: number): ExtractedLineJson {
  return {
    text,
    kind: 'deposit',
    qty: null,
    unit: null,
    quantity_kind: null,
    line_total_cents: cents,
    unit_price_cents: null,
    applies_to_text: null,
  };
}

/** A returned or voided line — negative, and never resolved as an ingredient. */
function refund(text: string, cents: number): ExtractedLineJson {
  return {
    text,
    kind: 'refund',
    qty: null,
    unit: null,
    quantity_kind: null,
    line_total_cents: -Math.abs(cents),
    unit_price_cents: null,
    applies_to_text: null,
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
    subtotal_cents: 2752,
    tax_cents: 275,
    total_cents: 3027,
    lines: [
      food(byRaw('KIKKO SOY 500ML').raw, 500, 'ml', 389),
      food(byRaw('SESAME OIL 250ML').raw, 250, 'ml', 599),
      food(byRaw('JASMINE RICE 5LB').raw, 2268, 'g', 799),
      food(byRaw('BANANAS 0.62 LB @ 0.59/LB').raw, 281, 'g', 37),
      food(byRaw('GRND PORK 1LB').raw, 454, 'g', 499),
      food(byRaw('LRG EGGS 12CT').raw, 12, 'piece', 429),
      nonFood('PAPER TOWELS 6CT'),
      ...tail(2752, 275),
    ],
  },

  supermarketTwo: {
    store: 'Kroger',
    purchased_at: '2026-06-03',
    receipt_type: 'grocery',
    subtotal_cents: 1465,
    tax_cents: 115,
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
    subtotal_cents: 2205,
    tax_cents: 182,
    total_cents: 2387,
    lines: [
      food(byRaw('白菜').raw, 1, 'piece', 349),
      food(byRaw('豆腐').raw, 396, 'g', 229),
      food(byRaw('海天生抽').raw, 500, 'ml', 379),
      food(byRaw('冷凍餃子').raw, 454, 'g', 599),
      food(byRaw('고추장 500G').raw, 500, 'g', 649),
      nonFood('DISH SOAP REFILL'),
      ...tail(2205, 182),
    ],
  },

  warehouseClub: {
    store: 'Costco Wholesale',
    purchased_at: '2026-06-08',
    receipt_type: 'grocery',
    subtotal_cents: 9493,
    tax_cents: 566,
    total_cents: 10059,
    lines: [
      food(byRaw('KS ORG EVOO 2L').raw, 2000, 'ml', 1899),
      food(byRaw('ORG CHKN BRST BNLS').raw, 2268, 'g', 1899),
      multiple('KS BOTTLED WATER 40CT', 2, 999),
      multiple('FRZ DUMPLINGS 3LB BAG', 2, 1299),
      food(byRaw('SHREDDED CHED CHSE').raw, 907, 'g', 1099),
      ...tail(9493, 566),
    ],
  },

  restaurant: {
    store: 'Golden Wok',
    purchased_at: '2026-06-10',
    receipt_type: 'restaurant',
    subtotal_cents: 4190,
    tax_cents: 335,
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
    subtotal_cents: 928,
    tax_cents: 74,
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
    subtotal_cents: 399,
    tax_cents: 269,
    total_cents: 668,
    lines: [
      food(byRaw('SRIRACHA 17OZ').raw, 482, 'ml', 449),
      ...NON_FOOD_LINES.map((raw) => nonFood(raw)),
      discount('MFR COUPON -0.50', 50),
      ...tail(399, 269),
    ],
  },

  multiQuantity: {
    store: 'ValueMart',
    purchased_at: '2026-06-17',
    receipt_type: 'grocery',
    subtotal_cents: 2987,
    tax_cents: 176,
    total_cents: 3163,
    lines: [
      multiple('CANNED BLACK BEANS', 4, 129),
      multiple('GREEK YOGURT 5.3OZ', 6, 119),
      multiple(byRaw('LRG EGGS 12CT').raw, 2, 429),
      food(byRaw('ATLANTIC SALMON FIL').raw, 340, 'g', 899),
      ...tail(2987, 176),
    ],
  },

  // Task 1.4: the money-shaped cases in one receipt — a weight-priced line,
  // a line-attributed discount, an unattributable basket discount, a
  // multi-buy, a bottle deposit, a bag levy, and a refunded line sitting
  // among otherwise normal purchases.
  moneyShaped: {
    store: 'Green Grocer',
    purchased_at: '2026-06-19',
    receipt_type: 'grocery',
    // 247 - 50 + 798 - 100 + 25 + 10 + 499 - 350 = 1079
    subtotal_cents: 1079,
    tax_cents: 0,
    total_cents: 1079,
    lines: [
      food(byRaw('BOK CHOY 1.24 LB @ 1.99/LB').raw, 563, 'g', 247), // weight-priced (0.834 kg's cousin)
      discountFor('MEMBER PRICE -0.50', 50, byRaw('BOK CHOY 1.24 LB @ 1.99/LB').raw),
      multiple(byRaw('WHL MILK 1GAL').raw, 2, 399), // multi-buy: two separate jugs
      discount('BASKET SAVER -1.00', 100), // unattributable, basket-wide
      deposit('BOTTLE DEPOSIT', 25),
      deposit('BAG FEE', 10),
      food(byRaw('GRND PORK 1LB').raw, 454, 'g', 499),
      refund('RETURNED: LAST WEEK ITEM', 350),
      ...tail(1079, 0),
    ],
  },

  // Task 1.4: one whole return receipt — nothing bought, only refunded.
  wholeReturn: {
    store: 'Fresh Market',
    purchased_at: '2026-06-20',
    receipt_type: 'grocery',
    subtotal_cents: -848,
    tax_cents: 0,
    total_cents: -848,
    lines: [
      refund(byRaw('KIKKO SOY 500ML').raw, 389),
      refund(byRaw('JASMINE RICE 5LB').raw, 459),
      arithmetic('SUBTOTAL', -848),
      arithmetic('REFUND TOTAL', -848),
      arithmetic('VISA ****4471 REFUND'),
    ],
  },

  // Task 1.5: lines that deliberately do not sum to the printed subtotal.
  arithmeticMismatch: {
    store: 'Corner Grocer',
    purchased_at: '2026-06-21',
    receipt_type: 'grocery',
    subtotal_cents: 1500, // printed — does not match the lines below (1188)
    tax_cents: 95,
    total_cents: 1595,
    lines: [
      food(byRaw('SHAOXING WINE 640ML').raw, 640, 'ml', 699),
      food(byRaw('MIRIN 300ML').raw, 300, 'ml', 489),
      ...tail(1500, 95),
    ],
  },

  // Task 1.6: the same ingredient on two separate lines, plus a `2 @` multiple.
  duplicateIngredient: {
    store: 'ValueMart',
    purchased_at: '2026-06-23',
    receipt_type: 'grocery',
    // 599 + 599 + (2 * 429) = 2056
    subtotal_cents: 2056,
    tax_cents: 0,
    total_cents: 2056,
    lines: [
      food(byRaw('SESAME OIL 250ML').raw, 250, 'ml', 599), // sesame oil, line one
      food(byRaw('SESAME OIL 250ML').raw, 250, 'ml', 599), // sesame oil again — a second, separate bottle
      multiple(byRaw('LRG EGGS 12CT').raw, 2, 429), // "2 @" — two separate cartons
      ...tail(2056, 0),
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
  toFixture('moneyShaped', '2026-06-19'),
  toFixture('wholeReturn', '2026-06-20'),
  toFixture('arithmeticMismatch', '2026-06-21'),
  toFixture('duplicateIngredient', '2026-06-23'),
];
