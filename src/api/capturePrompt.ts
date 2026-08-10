import { MEASURE_UNITS } from '@/types';

/** One extraction request identifies the capture and returns its usable content. */
export const CAPTURE_SYSTEM_PROMPT = `You inspect a pantry capture. Return exactly one kind of result.

- "receipt": a till receipt. Return receipt_lines in printed order.
- "items": one or more grocery items. Return items separately, never as one bundle.
- "unclear": the image is usable but you cannot tell whether it is a receipt or items.
- "nothing": it contains no usable food or receipt.

Return raw JSON only. Do not use markdown.
Each item has a name and optional quantity and unit. Units are one of: ${MEASURE_UNITS.join(', ')}.

Schema:
{
  "kind": "receipt" | "items" | "unclear" | "nothing",
  "receipt_lines": [{ "text": "string" }],
  "items": [{ "name": "string", "quantity": 1, "unit": "g" }]
}`;

export const CAPTURE_USER_PROMPT =
  'Identify this pantry capture and extract its receipt lines or grocery items in the same response.';
