import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import type { MeasureUnit, Recipe, RecipeWithIngredients } from '@/types';
import {
  RecipeRow,
  RecipeIngredientRow,
  toRecipe,
  toRecipeIngredient,
} from './types';



/* -------------------------------------------------------------------------- */
/* Saved recipes                                                               */
/* -------------------------------------------------------------------------- */

export interface NewRecipeIngredient {
  name: string;
  quantity: number | null;
  unit: MeasureUnit | null;
  canonicalId: string | null;
}


export interface NewRecipe {
  title: string;
  sourceLink: string | null;
  steps?: readonly string[];
  imageUri?: string | null;
  status?: Recipe['status'];
  ingredients?: readonly NewRecipeIngredient[];
}


/** Creates the recipe and its stated ingredients as one local transaction. */
export async function insertRecipe(input: NewRecipe): Promise<RecipeWithIngredients> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const recipe: Recipe = {
    id,
    title: input.title.trim() || 'Untitled recipe',
    sourceLink: input.sourceLink?.trim() || null,
    steps: input.steps?.filter((step) => step.trim().length > 0) ?? [],
    imageUri: input.imageUri ?? null,
    status: input.status ?? 'ready',
    createdAt: now,
    updatedAt: now,
  };
  const ingredients = (input.ingredients ?? []).map((ingredient, sortOrder) => ({
    id: randomUUID(),
    recipeId: id,
    name: ingredient.name.trim(),
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    canonicalId: ingredient.canonicalId,
    sortOrder,
  }));

  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO recipes
         (id, title, source_link, steps_json, image_uri, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recipe.id, recipe.title, recipe.sourceLink, JSON.stringify(recipe.steps),
        recipe.imageUri, recipe.status, recipe.createdAt, recipe.updatedAt,
      ],
    );
    for (const ingredient of ingredients) {
      await txn.runAsync(
        `INSERT INTO recipe_ingredients
           (id, recipe_id, name, quantity, unit, canonical_id, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ingredient.id, ingredient.recipeId, ingredient.name, ingredient.quantity,
          ingredient.unit, ingredient.canonicalId, ingredient.sortOrder,
        ],
      );
    }
  });
  return { ...recipe, ingredients };
}


export async function getRecipe(id: string): Promise<RecipeWithIngredients | null> {
  const row = await db().getFirstAsync<RecipeRow>('SELECT * FROM recipes WHERE id = ?', [id]);
  if (!row) return null;
  const ingredients = await db().getAllAsync<RecipeIngredientRow>(
    'SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC',
    [id],
  );
  return { ...toRecipe(row), ingredients: ingredients.map(toRecipeIngredient) };
}


/** Lists saved recipes without loading their ingredients. */
export async function listRecipes(): Promise<Recipe[]> {
  const rows = await db().getAllAsync<RecipeRow>(
    'SELECT * FROM recipes ORDER BY updated_at DESC, created_at DESC',
  );
  return rows.map(toRecipe);
}


/** Replaces editable recipe content while preserving provenance and source link. */
export async function updateRecipe(
  recipe: RecipeWithIngredients,
): Promise<RecipeWithIngredients> {
  const now = new Date().toISOString();
  const ingredients = recipe.ingredients.map((ingredient, sortOrder) => ({
    ...ingredient,
    id: ingredient.id || randomUUID(),
    recipeId: recipe.id,
    sortOrder,
  }));
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE recipes SET title = ?, steps_json = ?, image_uri = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [recipe.title, JSON.stringify(recipe.steps), recipe.imageUri, recipe.status, now, recipe.id],
    );
    await txn.runAsync('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipe.id]);
    for (const ingredient of ingredients) {
      await txn.runAsync(
        `INSERT INTO recipe_ingredients
           (id, recipe_id, name, quantity, unit, canonical_id, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ingredient.id, ingredient.recipeId, ingredient.name, ingredient.quantity,
          ingredient.unit, ingredient.canonicalId, ingredient.sortOrder],
      );
    }
  });
  return { ...recipe, ingredients, updatedAt: now };
}


export async function deleteRecipe(id: string): Promise<string | null> {
  const recipe = await getRecipe(id);
  if (!recipe) return null;
  await db().runAsync('DELETE FROM recipes WHERE id = ?', [id]);
  return recipe.imageUri;
}
