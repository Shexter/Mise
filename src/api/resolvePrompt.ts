import { FOOD_CLASSES, MEASURE_UNITS, STORAGE_LOCATIONS } from '@/types';
import type { ModelResolutionRequest } from '@/logic/match';

/**
 * The ingredient-resolution prompt (cascade steps 4 and 5).
 *
 * Kept in its own module, mirroring `prompt.ts`: readable and tunable
 * without opening the transport code, raw JSON out, explicit schema. One
 * batched request covers every reference the local cascade left unresolved.
 */

export const RESOLVE_SYSTEM_PROMPT = `You are an ingredient resolver for a pantry app. You receive food references that came from grocery receipts, barcode labels, photos, or meal logs — often abbreviated, misspelled, or in Chinese, Japanese, Korean, or other scripts. For each one you decide which canonical ingredient it means.

How to resolve:
- You are given candidate canonical ids for each reference, and the ids of ingredients the user's kitchen already holds. Prefer a candidate the user already has when several fit — an ambiguous "soy sauce" from someone who stocks light soy sauce means their light soy sauce.
- Only pick a canonical id that appears in the reference's candidates or in the kitchen list. Never invent an id.
- If the reference names a food that matches no listed canonical, propose a new one under new_item: a shopper-friendly display name, its class, where it is stored by default, unopened shelf life in days per location, days it keeps once opened (null if opening changes nothing), and a typical single-use amount where one is meaningful.
- Keep proposed display names in the language and script of the reference. Never romanise Chinese, Japanese, or Korean names.
- If the reference is not a food at all (batteries, paper towels), return null for both fields.
- confidence is your certainty in [0, 1] that the mapping is right.

Output format:
- Return raw JSON only. No prose, no explanation, no markdown code fences.
- resolutions must contain exactly one entry per reference, in the same order, carrying the reference's index.
- class is one of: ${FOOD_CLASSES.join(', ')}.
- location keys and default_location are one of: ${STORAGE_LOCATIONS.join(', ')}.
- typical_use_unit is one of: ${MEASURE_UNITS.join(', ')}.

Schema:
{
  "resolutions": [
    {
      "index": 0,
      "canonical_id": "string or null",
      "new_item": {
        "display_name": "string",
        "class": "staple",
        "default_location": "pantry",
        "shelf_life_days": { "pantry": 365 },
        "open_life_days": 90,
        "typical_use_qty": 1.0,
        "typical_use_unit": "tbsp"
      },
      "confidence": 0.9
    }
  ]
}
new_item is null when canonical_id is set, and both are null for non-food.`;

/** The batched request body: references, their candidates, and the kitchen. */
export function buildResolveUserPrompt(batch: ModelResolutionRequest): string {
  return JSON.stringify({
    task: 'Resolve each reference to a canonical id, or propose a new item. Return raw JSON matching the schema.',
    references: batch.references.map((reference, index) => ({
      index,
      raw: reference.raw,
      normalised: reference.norm,
      candidates: reference.candidateIds,
    })),
    kitchen: batch.ownedCanonicalIds,
  });
}
