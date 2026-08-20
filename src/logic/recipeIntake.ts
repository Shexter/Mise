import type { CaptureExtraction } from '@/api/capture';
import { extractRecipe } from '@/api/recipe';
import { insertRecipe, type NewRecipeIngredient } from '@/db/queries';
import { captureItemsFromReceiptLines } from '@/logic/captureItems';
import { resolveIngredientReferences } from '@/logic/resolution';
import type { RecipeWithIngredients } from '@/types';

/**
 * What the intake does with a payload, once, in one place.
 *
 * The screen holds none of this because there are three sources — a shared
 * link, pasted text, a screenshot — and only one of them is allowed to
 * differ in how it *reads* the content. Everything after reading is the
 * same: resolve the ingredient names through the one matcher, store the
 * recipe with its source link, hand it to review.
 *
 * The constraint the whole change is built around lives here too, as an
 * absence: nothing in this module fetches anything. A link is a string that
 * gets stored and shown. It is never opened, previewed, unfurled, resolved
 * to an oEmbed endpoint, or handed to a platform API — see
 * `test/recipe-links.test.ts`, which asserts that absence rather than
 * trusting it.
 */

export interface SharedPayload {
  /** The first http(s) URL in what the user handed over, if there is one. */
  link: string | null;
  /** Everything else — the caption, the pasted text, whatever came alongside. */
  content: string;
}

/**
 * Splits a share-sheet payload into its link and its text. Share sheets
 * deliver these glued together far more often than separately, and which
 * half is present decides whether there is anything to extract at all.
 */
export function splitSharedPayload(input: string): SharedPayload {
  const supplied = input.trim();
  const link = sourceLinkFrom(supplied);
  return { link, content: link ? supplied.replace(link, '').trim() : supplied };
}

/** The first http(s) URL in a payload, normalised, or null. */
export function sourceLinkFrom(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface SavedRecipeResult {
  recipe: RecipeWithIngredients;
  /** Ingredients matched well enough to store but worth a confirmation. */
  confirmations: number;
}

/**
 * Files a bare link. This is the degraded path and it is a success, not an
 * error: the user shared something worth cooking and the app kept it. The
 * ingredients arrive later, by paste or by screenshot.
 */
export async function saveLinkAwaitingContent(
  link: string,
  imageUri: string | null = null,
): Promise<RecipeWithIngredients> {
  return insertRecipe({
    title: 'Recipe to add later',
    sourceLink: link,
    status: 'awaiting_content',
    imageUri,
  });
}

/** Extracts a recipe from text the user supplied, then resolves and stores it. */
export async function saveRecipeFromText(
  content: string,
  link: string | null,
  imageUri: string | null = null,
): Promise<SavedRecipeResult> {
  const extracted = await extractRecipe(content);
  return storeResolvedRecipe(
    extracted.title,
    extracted.ingredients.map((ingredient) => ({ ...ingredient, canonicalId: null })),
    link,
    extracted.steps,
    imageUri,
  );
}

/**
 * Turns a unified-capture result into recipe ingredients.
 *
 * The capture pipeline already answers "what is in this image" for the
 * pantry, and an on-screen ingredient list is the same question — so a
 * screenshot reuses that answer rather than a second vision contract. A
 * receipt-shaped result is accepted too: a screenshot of a written list is
 * routinely read as one, and refusing it would be pedantry the user pays
 * for. `nothing` and `unclear` return nothing, which the caller turns into
 * the awaiting-content path rather than an error.
 */
export function recipeIngredientsFromCapture(
  capture: CaptureExtraction,
): NewRecipeIngredient[] {
  if (capture.kind === 'items') {
    return capture.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      canonicalId: null,
    }));
  }
  if (capture.kind === 'receipt') {
    return captureItemsFromReceiptLines(
      capture.receipt.lines.map((line, index) => ({
        id: `${index}`,
        receiptId: '',
        rawText: line.text,
        kind: line.kind,
        qty: line.qty,
        unit: line.unit,
        quantityKind: line.quantityKind,
        lineTotalCents: line.lineTotalCents,
        unitPriceCents: line.unitPriceCents,
        canonicalId: null,
        appliesToLineId: null,
        pantryItemId: null,
        excluded: false,
        ocrConfidence: null,
        createdAt: '',
      })),
    ).map((item) => ({ ...item, canonicalId: null }));
  }
  return [];
}

/**
 * The screenshot route: an image already read by the unified capture path,
 * stored as a recipe. A screenshot that turned out to hold no list still
 * produces a recipe — with the image attached — because throwing away what
 * the user handed over is the one outcome that is never helpful.
 */
export async function saveRecipeFromCapture(input: {
  capture: CaptureExtraction;
  imageUri: string;
  link: string | null;
  title?: string;
}): Promise<SavedRecipeResult> {
  const ingredients = recipeIngredientsFromCapture(input.capture);
  if (ingredients.length === 0) {
    return {
      recipe: await insertRecipe({
        title: input.title?.trim() || 'Recipe to add later',
        sourceLink: input.link,
        status: 'awaiting_content',
        imageUri: input.imageUri,
      }),
      confirmations: 0,
    };
  }
  return storeResolvedRecipe(
    input.title?.trim() || 'Recipe from a screenshot',
    ingredients,
    input.link,
    [],
    input.imageUri,
  );
}

/**
 * The shared tail of every populated path: one batched call to the single
 * matcher, then one insert. An ingredient the matcher could not place keeps
 * its text and a null canonical — decision-consistent with a receipt line
 * that did not resolve, and never reported as held.
 */
async function storeResolvedRecipe(
  title: string,
  ingredients: readonly NewRecipeIngredient[],
  link: string | null,
  steps: readonly string[],
  imageUri: string | null,
): Promise<SavedRecipeResult> {
  const outcomes = await resolveIngredientReferences(
    ingredients.map((ingredient) => ({ raw: ingredient.name })),
    'user',
  );
  const recipe = await insertRecipe({
    title,
    sourceLink: link,
    steps,
    imageUri,
    ingredients: ingredients.map((ingredient, index) => {
      const outcome = outcomes[index];
      return {
        ...ingredient,
        canonicalId: outcome?.status === 'resolved' ? outcome.canonicalId : null,
      };
    }),
  });
  return {
    recipe,
    confirmations: outcomes.filter((outcome) => outcome?.status === 'needs_confirmation').length,
  };
}
