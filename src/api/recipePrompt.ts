import { MEASURE_UNITS } from '@/types';

/**
 * Text the user supplied from a recipe caption, note, or share payload.
 * The source URL is deliberately not included: extraction never fetches it.
 */
export const RECIPE_SYSTEM_PROMPT = `You extract a cooking recipe from text the user supplied. Return raw JSON only; no markdown or commentary.

If the text does not contain a usable recipe or ingredient list, return {"is_recipe":false}.

Otherwise return:
{
  "is_recipe": true,
  "title": "string",
  "ingredients": [
    { "name": "string", "quantity": 0, "unit": "g" }
  ],
  "steps": ["string"]
}

Rules:
- Copy ingredient names faithfully; do not substitute ingredients or invent missing ones.
- quantity is a number only when the supplied text explicitly states one. Use null for phrases such as "a splash" or "to taste".
- unit is one of ${MEASURE_UNITS.join(', ')}, or null if no supported unit is stated.
- Preserve useful method steps when present, but do not invent them.
- A caption made only of hashtags, emoji, promotion, or a link is not a recipe.`;

export const RECIPE_USER_PROMPT = (text: string) =>
  `Extract only the recipe contained in this user-supplied text:\n\n${text}`;
