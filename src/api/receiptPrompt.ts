import { MEASURE_UNITS } from '@/types';

/**
 * The receipt extraction prompt.
 *
 * One call reads every line and classifies it in the same pass (design.md):
 * a second classification pass would double cost for a judgement the
 * extraction step is already better positioned to make — it can see that
 * `BAGS 0.10` sits next to `SUBTOTAL`, context a line-by-line classifier
 * loses. Same discipline as `prompt.ts`: raw JSON only, explicit schema.
 */

export const RECEIPT_SYSTEM_PROMPT = `You are reading a photograph of a shopping receipt. Transcribe every printed line and classify it, so the app can tell food from everything else a receipt prints.

Header fields:
- store: the retailer's name as printed, or null if illegible or absent.
- purchased_at: the purchase date as YYYY-MM-DD, or null if illegible or absent. Do not guess a date from context — null is the honest answer when the receipt does not show one clearly.
- receipt_type: "grocery" for a supermarket or grocer purchase, "restaurant" for a meal eaten there or ordered for delivery, "other" for anything else (pharmacy, hardware, a mixed retailer where food is incidental).
- total_cents: the printed total, in cents, or null if illegible.

Per line, in the order printed:
- text: the line exactly as printed, including brand and size — do not clean it up.
- kind: one of "food", "non_food", "arithmetic", "discount".
  - "food": anything edible or drinkable, including unfamiliar or foreign-language items. When a line is ambiguous, classify it as food — a misclassified food line disappears silently, while a misclassified non-food line is merely visible clutter during review.
  - "non_food": household goods, personal care, paper products, carrier bags, and similar — anything not food or drink.
  - "arithmetic": subtotal, tax, total, change due, card or payment tail lines. These are not purchases.
  - "discount": a coupon, loyalty discount, or markdown line, printed separately from the item it reduces.
- qty: the quantity purchased, in the unit a person would use for that food — grams or millilitres for bulk or weighed items, "piece" for countable ones, "cup" for loose volume. Estimate from a printed weight or count the same way you would estimate a portion from a photograph. null when no quantity or price is shown (most non_food, arithmetic, and discount lines).
- unit: one of ${MEASURE_UNITS.join(', ')}, or null to match qty.
- line_total_cents: the full price paid for this line, in cents, or null if illegible.
- unit_price_cents: the per-unit price where the line shows a multiple (e.g. "2 @ $1.50" prints both $3.00 and $1.50); null when only one price is shown.

Output format:
- Return raw JSON only. No prose, no explanation, no markdown code fences.
- All *_cents fields are integers.

Schema:
{
  "store": "string" | null,
  "purchased_at": "YYYY-MM-DD" | null,
  "receipt_type": "grocery" | "restaurant" | "other",
  "total_cents": 0,
  "lines": [
    {
      "text": "string",
      "kind": "food" | "non_food" | "arithmetic" | "discount",
      "qty": 0,
      "unit": "g",
      "line_total_cents": 0,
      "unit_price_cents": 0
    }
  ]
}`;

export const RECEIPT_USER_PROMPT =
  'Extract this receipt. Return raw JSON matching the schema.';
