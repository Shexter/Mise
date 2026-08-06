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
- subtotal_cents: the printed pre-tax subtotal, in cents, or null if illegible or not printed separately from the total.
- tax_cents: the printed tax amount, in cents, or null if illegible or not shown.
- total_cents: the printed total, in cents, or null if illegible.

Per line, in the order printed:
- text: the line exactly as printed, including brand and size — do not clean it up.
- kind: one of "food", "non_food", "arithmetic", "discount", "deposit", "refund".
  - "food": anything edible or drinkable, including unfamiliar or foreign-language items. When a line is ambiguous, classify it as food — a misclassified food line disappears silently, while a misclassified non-food line is merely visible clutter during review.
  - "non_food": household goods, personal care, paper products, carrier bags, and similar — anything not food or drink.
  - "arithmetic": subtotal, tax, total, change due, card or payment tail lines. These are not purchases.
  - "discount": a coupon, loyalty discount, or markdown line, printed separately from the item it reduces.
  - "deposit": a container deposit or bag levy — real money, never an ingredient.
  - "refund": a returned or voided item, or a line explicitly marked refunded. Its price is negative or should be read as a reduction.
- qty: the quantity purchased. See quantity_kind below for what number to read here — never guess one to fill the field.
- unit: one of ${MEASURE_UNITS.join(', ')}, or null to match qty.
- quantity_kind: "count" or "measure", or null when the line carries no quantity (most non_food, arithmetic, discount, deposit, and refund lines).
  - "count": the line shows a number of separate containers or units, e.g. "2 GATORADE" or "3 @ $1.50". qty is that count.
  - "measure": the line is priced by weight or volume, e.g. "0.834 kg @ $12.99/kg" or "BANANAS 0.62 LB @ 0.59/LB". qty is the measured amount, converted to grams or millilitres — never the count of containers, because there usually is no container. A weight or volume this small is not "1 of something."
  - Tell them apart by what the unit price is per: a price per kg, lb, L, or oz means "measure"; a price per item or "@" a flat per-unit price means "count". If you cannot tell, leave qty and quantity_kind both null rather than guessing.
- line_total_cents: the full price paid for this line, in cents, or null if illegible. For a discount, deposit, or refund line, this is the amount printed (a discount or refund is typically shown as a negative number or with a minus sign — record it as negative).
- unit_price_cents: the per-unit or per-weight-unit price shown alongside a line total; null when only one price is shown.
- applies_to_text ("discount" lines only): the exact printed text of the line this discount reduces, copied verbatim, when the receipt shows the discount immediately under or clearly tied to one item. null for a basket-wide or loyalty discount that names no specific item, and null for every line that is not a discount.

Output format:
- Return raw JSON only. No prose, no explanation, no markdown code fences.
- All *_cents fields are integers.

Schema:
{
  "store": "string" | null,
  "purchased_at": "YYYY-MM-DD" | null,
  "receipt_type": "grocery" | "restaurant" | "other",
  "subtotal_cents": 0,
  "tax_cents": 0,
  "total_cents": 0,
  "lines": [
    {
      "text": "string",
      "kind": "food" | "non_food" | "arithmetic" | "discount" | "deposit" | "refund",
      "qty": 0,
      "unit": "g",
      "quantity_kind": "count" | "measure" | null,
      "line_total_cents": 0,
      "unit_price_cents": 0,
      "applies_to_text": "string" | null
    }
  ]
}`;

export const RECEIPT_USER_PROMPT =
  'Extract this receipt. Return raw JSON matching the schema.';
