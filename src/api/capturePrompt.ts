import { RECEIPT_SYSTEM_PROMPT } from '@/api/receiptPrompt';
import { MEASURE_UNITS } from '@/types';

/** One extraction request identifies the capture and returns its usable content. */
export const CAPTURE_SYSTEM_PROMPT = `You inspect a pantry capture. Return exactly one kind of result.

- "receipt": a till receipt. Return its complete receipt draft under "receipt".
- "items": one or more grocery items. Return items separately, never as one bundle.
- "unclear": the image is usable but you cannot tell whether it is a receipt or items.
- "nothing": it contains no usable food or receipt.

Return raw JSON only. Do not use markdown.
Each item has a name and optional quantity and unit. Units are one of: ${MEASURE_UNITS.join(', ')}.

For a receipt draft, use this exact receipt extraction contract:
${RECEIPT_SYSTEM_PROMPT.slice(RECEIPT_SYSTEM_PROMPT.indexOf('Header fields:'))}

Schema:
{
  "kind": "receipt" | "items" | "unclear" | "nothing",
  "receipt": { "store": "string" | null, "purchased_at": "YYYY-MM-DD" | null, "receipt_type": "grocery", "subtotal_cents": 0, "tax_cents": 0, "total_cents": 0, "lines": [] },
  "items": [{ "name": "string", "quantity": 1, "unit": "g" }]
}`;

export const CAPTURE_USER_PROMPT =
  'Identify this pantry capture and extract its receipt lines or grocery items in the same response.';
