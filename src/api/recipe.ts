import { completeWithAnthropic } from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import { completeWithGemini } from '@/api/gemini';
import { getApiKey, getOpenAIEndpoint, providerForKey } from '@/api/keyStore';
import { completeWithOpenAI } from '@/api/openai';
import { extractJsonObject } from '@/api/parse';
import { RECIPE_SYSTEM_PROMPT, RECIPE_USER_PROMPT } from '@/api/recipePrompt';
import { MEASURE_UNITS, type MeasureUnit } from '@/types';

export interface ExtractedRecipeIngredient {
  name: string;
  quantity: number | null;
  unit: MeasureUnit | null;
}

export interface ExtractedRecipe {
  title: string;
  ingredients: ExtractedRecipeIngredient[];
  steps: string[];
}

/** One provider request over text already handed to Mise by the user. */
export async function extractRecipe(text: string, signal?: AbortSignal): Promise<ExtractedRecipe> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new VisionError('no_key', 'No API key is set.');
  const provider = providerForKey(apiKey);
  const user = RECIPE_USER_PROMPT(text);
  let raw: string;
  if (provider === 'anthropic') {
    raw = await completeWithAnthropic(apiKey, RECIPE_SYSTEM_PROMPT, user, signal);
  } else if (provider === 'openai') {
    raw = await completeWithOpenAI(
      apiKey, RECIPE_SYSTEM_PROMPT, user, signal, await getOpenAIEndpoint(),
    );
  } else if (provider === 'gemini') {
    raw = await completeWithGemini(apiKey, RECIPE_SYSTEM_PROMPT, user, signal);
  } else {
    throw new VisionError('no_key', 'The saved API key is not recognised.');
  }
  return parseRecipeResponse(raw);
}

export function parseRecipeResponse(raw: string): ExtractedRecipe {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new VisionError('malformed', 'The recipe could not be read.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new VisionError('malformed', 'The recipe could not be read.');
  }
  const record = parsed as Record<string, unknown>;
  if (record['is_recipe'] !== true) {
    throw new VisionError('malformed', 'No recipe was found in that text.');
  }
  const title = text(record['title']);
  const ingredients = Array.isArray(record['ingredients'])
    ? record['ingredients'].map(toIngredient).filter((item): item is ExtractedRecipeIngredient => item !== null)
    : [];
  if (!title || ingredients.length === 0) {
    throw new VisionError('malformed', 'No recipe was found in that text.');
  }
  return {
    title,
    ingredients,
    steps: Array.isArray(record['steps'])
      ? record['steps'].map(text).filter((step): step is string => step !== null)
      : [],
  };
}

function toIngredient(value: unknown): ExtractedRecipeIngredient | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const name = text(record['name']);
  if (!name) return null;
  return { name, quantity: numberOrNull(record['quantity']), unit: unitOrNull(record['unit']) };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function unitOrNull(value: unknown): MeasureUnit | null {
  const unit = typeof value === 'string' ? value.toLowerCase() : '';
  return MEASURE_UNITS.includes(unit as MeasureUnit) ? unit as MeasureUnit : null;
}
